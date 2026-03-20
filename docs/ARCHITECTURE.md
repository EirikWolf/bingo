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
              └─────────┬─────────┘
                        │
              ┌─────────┴─────────┐
              │  Cloud Functions   │
              │    (v2 / Gen 2)    │
              └────────────────────┘
```

Klientlogikk er primær — spillere og admin samhandler direkte med Firestore via Security Rules.
Cloud Functions (v2) kjører server-side for validering, sikkerhet, statistikk, push-varsler og planlagte oppgaver.
Firestore Security Rules er fortsatt førstelinjeforsvaret for autorisasjon og datavalidering.

## Tekniske valg og begrunnelser

| Valg | Begrunnelse |
|------|-------------|
| Cloud Functions v2 (Gen 2) | Server-side validering, juks-deteksjon, push-varsler, statistikk, backup. Blaze-plan (pay-as-you-go). |
| Firestore (ikke Realtime DB) | Bedre queries, security rules, offline-cache. |
| Zustand (ikke Redux/Context) | Minimalt API, ingen boilerplate, bra med Firestore-lyttere. |
| Framer Motion | Myke animasjoner for storskjerm og Bingo-varsler uten tung bundle. |
| Vite (ikke CRA) | Raskere bygg, bedre HMR, native ESM. |
| PWA med Service Worker | Offline-cache av kupongdata for ustabilt nett i lokaler. |
| Tailwind dark mode (`class`) | Mørk modus via Zustand-store med `light`/`dark`/`system`-valg. |

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
  couponPricing: CouponPricing | null; // Prisbasert kupongkjøp
  reminderEnabled: boolean;       // Push/SMS-påminnelser aktive
  speech: SpeechSettings;         // Taleannonsering av tall
}

interface SpeechSettings {
  enabled: boolean;
  voiceURI: string | null;
  rate: number;     // 0.5 - 2.0
  volume: number;   // 0.0 - 1.0
}

interface CouponPricing {
  enabled: boolean;
  pricePerCoupon: number;  // NOK
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
  autoDrawActive: boolean;        // Auto-trekning aktiv
  autoDrawIntervalMs: number;     // Intervall i ms (f.eks. 5000)
  lastDrawAt: Timestamp | null;   // Sist trukne tidspunkt
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
  numbers: number[];              // Flat 25 elementer, row-major (unngår Firestore nested-array)
  markedCells: boolean[];         // Flat 25 elementer, row-major
  commitmentId: string;
  isWinner: boolean;
  winCondition: WinCondition | null;
  paymentMethod: 'commitment' | 'vipps';
  paymentStatus: 'pending' | 'paid' | 'failed';
  purchasedAt: Timestamp;
}
```

**Kupong-tallfordeling:**
| Kolonne | B | I | N | G | O |
|---------|---|---|---|---|---|
| Område | 1-15 | 16-30 | 31-45 | 46-60 | 61-75 |
| Ruter | 5 | 5 | 4+fri | 5 | 5 |

### `locations/{locationId}/games/{gameId}/bingo_claims/{claimId}`

Spillere sender rop, admin godkjenner manuelt. Cloud Function (`onBingoClaimCreated`) validerer automatisk server-side.

```typescript
interface BingoClaim {
  id: string;
  userId: string;
  userDisplayName: string;
  couponId: string;
  status: 'pending' | 'approved' | 'rejected';
  suggestedWinCondition: WinCondition | null;
  approvedWinCondition: WinCondition | null;
  serverValidated: boolean;                    // Satt av Cloud Function
  serverValidatedCondition: WinCondition | null; // Bekreftet gevinsttype fra server
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

### `locations/{locationId}/tournaments/{tournamentId}`

```typescript
interface Tournament {
  id: string;
  name: string;
  status: 'active' | 'finished';
  totalRounds: number;
  completedRounds: number;
  currentGameId: string | null;
  standings: TournamentStanding[];  // Sortert etter totalPoints desc
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface TournamentStanding {
  userId: string;
  displayName: string;
  totalPoints: number;    // 3-2-1 poeng for 1./2./3. plass
  roundsPlayed: number;
}
```

### `locations/{locationId}/stats` (singleton)

```typescript
interface LocationStats {
  totalGames: number;
  totalCoupons: number;
  totalWinners: number;
  totalPlayers: number;
  averagePlayersPerGame: number;
  averageCouponsPerGame: number;
  lastGameAt: Timestamp | null;
  updatedAt: Timestamp;
}
```

### `locations/{locationId}/leaderboard/{userId}`

```typescript
interface LeaderboardEntry {
  userId: string;
  displayName: string;
  wins: number;
  gamesPlayed: number;
  lastWinAt: Timestamp | null;
  updatedAt: Timestamp;
}
```

---

## Cloud Functions (v2 / Gen 2)

Alle Cloud Functions ligger i `functions/src/index.ts` og kjører på Node.js 20.
Firebase Blaze-plan (pay-as-you-go) kreves.

### Firestore-triggere

| Funksjon | Trigger | Beskrivelse |
|----------|---------|-------------|
| `onBingoClaimCreated` | `onCreate` bingo_claims | Server-side validering av bingo-rop. Sjekker kupong mot trukne tall og finner gevinsttype. |
| `onGameStatusChanged` | `onUpdate` games | Sender FCM push-varsel til lokasjonsmedlemmer ved spillstart/avslutning. |
| `onBingoClaimNotify` | `onCreate` bingo_claims | Sender FCM push til admin ved nytt bingo-rop. |
| `onPaymentConfirmed` | `onUpdate` coupons | Sender FCM push til spiller ved betalingsbekreftelse. |
| `onGameStatsUpdate` | `onUpdate` games | Oppdaterer `LocationStats`-aggregat ved spillendringer. |
| `onWinnerLeaderboardUpdate` | `onUpdate` games | Oppdaterer leaderboard ved nye vinnere. |
| `onGameFinishedUpdateLeaderboard` | `onUpdate` games | Oppdaterer `gamesPlayed` for alle spillere ved spillslutt. |
| `onClaimServerValidated` | `onUpdate` bingo_claims | Logger avvik mellom klient-foreslått og server-validert gevinsttype. |
| `onCouponCheatCheck` | `onCreate` coupons | **Sikkerhet:** Sjekker for duplikattall, ugyldige tallområder og feil kolonneplassering. Flagger til admin. |
| `onClaimCheatCheck` | `onCreate` bingo_claims | **Sikkerhet:** Flagger brukere med >3 bingo-rop i samme spill. |
| `onCouponRateLimit` | `onCreate` coupons | **Sikkerhet:** Flagger brukere som kjøper >10 kuponger på 5 minutter. |
| `onTournamentRoundFinished` | `onUpdate` games | Beregner turneringspoeng (3-2-1) og oppdaterer standings ved rundeslutt. |

### Planlagte funksjoner (Scheduler)

| Funksjon | Tidsplan | Beskrivelse |
|----------|----------|-------------|
| `autoDrawScheduler` | Hvert minutt | Trekker neste tall for spill med `autoDrawActive: true`. |
| `dailyCleanup` | Daglig kl 03:00 CET | Rydder opp utløpte/ferdige spill og gammel data. |
| `dailyFirestoreBackup` | Daglig kl 02:00 CET | Eksporterer hele Firestore til Cloud Storage via REST API. |

### Mappestruktur

```
functions/
├── src/
│   ├── index.ts            # Alle Cloud Functions (15 stk)
│   └── bingoValidator.ts   # Server-side gevinst-sjekk (delt logikk med klient)
├── package.json            # firebase-admin + firebase-functions v5
└── tsconfig.json
```

---

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

## Firebase-kostnader (Blaze-plan, pay-as-you-go)

Prosjektet kjører på Blaze-plan med budsjettvarsel. Cloud Functions krever Blaze.

| Tjeneste | Gratiskvote/mnd | Typisk bruk per kveld |
|----------|----------------|-----------------------|
| Firestore lese | 50 000/dag | ~10 000 |
| Firestore skrive | 20 000/dag | ~2 000 |
| Authentication | 10K brukere/mnd | ~200 |
| Hosting | 10 GB/mnd | ~1 GB |
| Cloud Functions invocations | 2M/mnd | ~500 |
| Cloud Functions compute | 400K GB-sek/mnd | Minimal |
| Cloud Storage (backup) | 5 GB | ~100 MB/dag |
| Cloud Scheduler | 3 jobber gratis | 3 (autoDraw, cleanup, backup) |
| FCM push-varsler | Ubegrenset | ~100/kveld |
