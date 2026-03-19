# Arkitektur — BingoPortalen

## Overordnet arkitektur

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ Spillerapp  │  │ Storskjerm  │  │ Admin/Kass. │
│   (mobil)   │  │ (projektor) │  │  (nettbrett) │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       └────────────────┼────────────────┘
                        │
              Firestore onSnapshot (sanntid)
                        │
              ┌─────────┴─────────┐
              │   Cloud Firestore  │
              │  (Security Rules)  │
              └────────────────────┘
```

All logikk kjører på klienten. Firestore Security Rules er eneste sikkerhetsbarriere.
Det finnes ingen mellomlag (Cloud Functions, API-server, etc.).

## Tekniske valg og begrunnelser

| Valg | Begrunnelse |
|------|-------------|
| Ingen Cloud Functions | Gratis Spark-plan. Reduserer kompleksitet og latens. |
| Firestore (ikke Realtime DB) | Bedre queries, security rules, offline-cache. |
| Zustand (ikke Redux/Context) | Minimalt API, ingen boilerplate, bra med Firestore-lyttere. |
| Framer Motion | Myke animasjoner for storskjerm og Bingo-varsler uten tung bundle. |
| Vite (ikke CRA) | Raskere bygg, bedre HMR, native ESM. |
| PWA med Service Worker | Offline-cache av kupongdata for ustabilt nett i lokaler. |

## Brukerroller

| Rolle | Opprettes av | Rettigheter |
|-------|-------------|-------------|
| `player` | Selv (ved registrering) | Velg lokasjon, kjøp kuponger, send bingo-rop, se egne forpliktelser |
| `admin` | Superadmin | Alt player kan + styre spill, trekke tall, godkjenne bingo, administrere forpliktelser, eksportere CSV, konfigurere Vipps/SMS |
| `superadmin` | Manuelt i Firestore | Alt admin kan + opprette lokasjoner, tildele admin-roller |

## Firestore datamodell

### `users/{uid}`

```typescript
interface User {
  uid: string;
  displayName: string;
  email: string | null;
  phone: string | null;           // For SMS-påminnelser
  photoURL: string | null;
  role: 'player' | 'admin' | 'superadmin';
  activeLocationId: string | null;
  createdAt: Timestamp;
  lastActiveAt: Timestamp;
}
```

### `locations/{locationId}`

```typescript
interface Location {
  id: string;
  name: string;                   // "Idrettslaget Gneist"
  description: string;
  imageURL: string | null;
  pinCode: string | null;         // Valgfri PIN for tilgang
  adminUids: string[];
  activeGameId: string | null;
  settings: LocationSettings;
  playerCount: number;            // Denormalisert
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface LocationSettings {
  maxCouponsPerPlayer: number;    // 0 = ubegrenset
  defaultCommitment: string;      // "1 time dugnad per kupong"
  commitmentLevels: CommitmentLevel[];
  allowAnonymous: boolean;
  autoDrawEnabled: boolean;
  autoDrawIntervalMs: number;     // f.eks. 5000 (5 sek)
  winConditions: WinCondition[];
  vippsNumber: string | null;     // Vipps-mottaker
  vippsDefaultAmount: number | null;
  reminderEnabled: boolean;       // Push/SMS-påminnelser aktive
}
```

### `locations/{locationId}/games/{gameId}`

```typescript
interface Game {
  id: string;
  status: 'setup' | 'open' | 'active' | 'paused' | 'finished';
  drawnNumbers: number[];         // Trukne tall i rekkefølge
  currentNumber: number | null;
  totalNumbers: number;           // 75
  winConditions: WinCondition[];
  winners: Winner[];
  couponCount: number;            // Denormalisert
  playerCount: number;
  commitment: string;
  createdAt: Timestamp;
  startedAt: Timestamp | null;
  finishedAt: Timestamp | null;
}

// Status-maskin:
// setup → open → active ↔ paused
//                   ↓         ↓
//               finished  finished
```

### `locations/{locationId}/games/{gameId}/coupons/{couponId}`

```typescript
interface Coupon {
  id: string;
  userId: string;
  userDisplayName: string;
  numbers: number[][];            // 5×5, sentrum = 0 (fri rute)
  markedCells: boolean[][];       // 5×5, sentrum alltid true
  commitmentId: string;
  isWinner: boolean;
  winCondition: WinCondition | null;
  purchasedAt: Timestamp;
}
```

**Kupong-tallfordeling:**
| Kolonne | B | I | N | G | O |
|---------|---|---|---|---|---|
| Område | 1-15 | 16-30 | 31-45 | 46-60 | 61-75 |
| Ruter | 5 | 5 | 4+fri | 5 | 5 |

### `locations/{locationId}/games/{gameId}/bingo_claims/{claimId}`

Spillere sender rop, admin godkjenner manuelt (erstatter Cloud Function-validering).

```typescript
interface BingoClaim {
  id: string;
  userId: string;
  userDisplayName: string;
  couponId: string;
  status: 'pending' | 'approved' | 'rejected';
  suggestedWinCondition: WinCondition | null;
  approvedWinCondition: WinCondition | null;
  reviewedBy: string | null;
  reviewedAt: Timestamp | null;
  claimedAt: Timestamp;
}
```

### `commitments/{commitmentId}`

Toppnivå-samling for enkel query på tvers av lokasjoner.

```typescript
interface Commitment {
  id: string;
  userId: string;
  userDisplayName: string;
  userPhone: string | null;       // For SMS deep link
  locationId: string;
  locationName: string;
  gameId: string;
  couponId: string;
  description: string;            // "1 time dugnad — loppemarked 5. april"
  status: 'pending' | 'confirmed' | 'overdue' | 'cancelled';
  dueDate: Timestamp | null;
  confirmedAt: Timestamp | null;
  confirmedBy: string | null;
  createdAt: Timestamp;
}
```

## Skriveoperasjoner (alle klientsiden)

| Operasjon | Utfører | Firestore-operasjon |
|-----------|---------|---------------------|
| Kjøp kupong | Spiller | Batch: kupong + forpliktelse + game.couponCount++ |
| Trekk tall | Admin | updateDoc: arrayUnion(tall) + currentNumber |
| Rop Bingo | Spiller | addDoc: bingo_claims med status 'pending' |
| Godkjenn Bingo | Admin | Batch: claim→approved + coupon.isWinner + game.winners |
| Avvis Bingo | Admin | updateDoc: claim→rejected |
| Endre spillstatus | Admin | updateDoc med statustransisjonsvalidering |
| Bekreft forpliktelse | Admin | updateDoc: commitment→confirmed |
| Massebekreft | Admin | Batch: flere commitments→confirmed |
| Opprett lokasjon | Superadmin | setDoc |
| Opprett spill | Admin | Batch: game + location.activeGameId |

## Sanntidslyttere (onSnapshot)

| Lytter | Brukes av | Hva |
|--------|-----------|-----|
| `listenToLocations` | Lokasjonsvelger | Alle lokasjoner med status |
| `listenToGame` | Alle spillvisninger | Spillstatus, drawnNumbers, winners |
| `listenToUserCoupons` | Spillerapp | Spillerens kuponger |
| `listenToPendingClaims` | Admin-panel | Innkommende bingo-rop |
| `listenToLocation` | Storskjerm, admin | Lokasjonens config og activeGameId |

## Vipps deep linking

Ingen API-integrasjon. Bruker `vipps://`-protokoll for å åpne Vipps-appen:
```
vipps://send?number={vippsNumber}&amount={amount}&message={message}
```
Fallback til mobil browser: `https://qr.vipps.no/...`

## SMS deep linking

Ingen SMS-API. Åpner telefonens SMS-app med ferdig utfylt melding:
```
sms:{phone}?body={encodedMessage}
```
Kasserer trykker "Send SMS" → telefonens SMS-app åpnes med mottaker og tekst ferdig utfylt.

## PWA og offline

- Service Worker cacher app-shell og statiske ressurser
- IndexedDB/localStorage cacher aktiv kupong ved nettverksbrudd
- Ved reconnect synkroniserer Firestore automatisk (innebygd offline-støtte)
- `manifest.json` med ikoner, theme-color, standalone display-mode

## Firebase-kostnader (Spark-plan, gratis)

| Tjeneste | Gratiskvote/dag | Typisk bruk per kveld |
|----------|----------------|-----------------------|
| Firestore lese | 50 000 | ~10 000 |
| Firestore skrive | 20 000 | ~2 000 |
| Authentication | 10K brukere/mnd | ~200 |
| Hosting | 10 GB/mnd | ~1 GB |
