# Firestore Datamodell — Digitalt Bingosystem

## Arkitekturnotat

Prosjektet bruker **ingen Cloud Functions** (gratis Spark-plan). All skrivelogikk kjører på klienten
og valideres av Firestore Security Rules. Bingo-validering håndteres av bingovert via `bingo_claims`-samlingen.

## Samlinger (Collections)

### `users`

Brukerdata. Dokument-ID = Firebase Auth UID.

```typescript
interface User {
  uid: string;
  displayName: string;
  email: string | null;
  photoURL: string | null;
  role: 'player' | 'admin' | 'superadmin';
  activeLocationId: string | null;
  createdAt: Timestamp;
  lastActiveAt: Timestamp;
}
```

### `locations`

Bingolokasjoner. Toppnivå-samling.

```typescript
interface Location {
  id: string;
  name: string;
  description: string;
  imageURL: string | null;
  pinCode: string | null;
  adminUids: string[];
  activeGameId: string | null;
  settings: LocationSettings;
  playerCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### `locations/{locationId}/games`

Bingospill/runder for en lokasjon.

```typescript
interface Game {
  id: string;
  status: 'setup' | 'open' | 'active' | 'paused' | 'finished';
  drawnNumbers: number[];
  currentNumber: number | null;
  totalNumbers: number;              // 75
  winConditions: WinCondition[];
  winners: Winner[];
  couponCount: number;
  playerCount: number;
  commitment: string;
  createdAt: Timestamp;
  startedAt: Timestamp | null;
  finishedAt: Timestamp | null;
}
```

**Statustransisjoner:**
```
setup → open → active ↔ paused → finished
                  ↓
              finished
```

### `locations/{locationId}/games/{gameId}/coupons`

Bingokuponger. **Opprettes av klienten, valideres av Security Rules.**

```typescript
interface Coupon {
  id: string;
  userId: string;
  userDisplayName: string;
  numbers: number[][];              // 5x5 matrise, sentrum = 0 (fri rute)
  markedCells: boolean[][];         // 5x5 matrise, sentrum alltid true
  commitmentId: string;
  isWinner: boolean;
  winCondition: WinCondition | null;
  purchasedAt: Timestamp;
}
```

**Security Rules validerer:**
- 5×5-matrise med riktige tallområder (B:1-15, I:16-30, N:31-45, G:46-60, O:61-75)
- Unike tall per kolonne
- Fri rute (0) i sentrum
- Spillet må ha status `open`
- userId matcher autentisert bruker

### `locations/{locationId}/games/{gameId}/bingo_claims` (NY)

Bingo-rop fra spillere. **Erstatter Cloud Function-validering.**
Admin/bingovert godkjenner eller avviser manuelt.

```typescript
interface BingoClaim {
  id: string;
  userId: string;
  userDisplayName: string;
  couponId: string;
  status: 'pending' | 'approved' | 'rejected';
  suggestedWinCondition: WinCondition | null;  // Klientens forslag
  approvedWinCondition: WinCondition | null;   // Satt av admin ved godkjenning
  reviewedBy: string | null;                   // Admin UID
  reviewedAt: Timestamp | null;
  claimedAt: Timestamp;
}
```

**Flyt:**
1. Spiller trykker "Bingo!" → klient sjekker kupong lokalt → oppretter `bingo_claims`-dokument med status `pending`
2. Bingovert ser innkommende claim i kontrollpanelet (onSnapshot-lytter)
3. Bingovert godkjenner → klient oppdaterer claim + kupong + game.winners i batch
4. Eller avviser → klient setter status `rejected`

### `commitments`

Forpliktelser. Toppnivå for enkel query på tvers.

```typescript
interface Commitment {
  id: string;
  userId: string;
  userDisplayName: string;
  locationId: string;
  locationName: string;
  gameId: string;
  couponId: string;
  description: string;
  status: 'pending' | 'confirmed' | 'overdue' | 'cancelled';
  dueDate: Timestamp | null;
  confirmedAt: Timestamp | null;
  confirmedBy: string | null;
  createdAt: Timestamp;
}
```

## Indekser

Definert i `firestore.indexes.json`:

| Samling | Felt | Bruk |
|---------|------|------|
| commitments | userId, createdAt | Mine forpliktelser |
| commitments | locationId, status, createdAt | Admin: forpliktelser per lokasjon |
| commitments | status, dueDate | Forfalt-sjekk |
| games | status, createdAt | Aktive/seneste spill |
| coupons | userId, purchasedAt | Mine kuponger |
| bingo_claims | status | Ventende claims for admin |

## Denormalisering

For å minimere Firestore-lesninger:

- `Game.couponCount` og `Game.playerCount` inkrementeres ved kupongkjøp
- `Location.activeGameId` peker direkte på pågående spill
- `Winner.displayName` lagres direkte i game.winners-arrayet
- `Coupon.userDisplayName` lagres for admin-oversikt
- `Commitment.locationName` og `userDisplayName` lagres for enkel listing
- `BingoClaim.userDisplayName` lagres for kontrollpanelet

## Skriveoperasjoner uten Cloud Functions

| Operasjon | Hvem | Hva skjer |
|-----------|------|-----------|
| Kjøp kupong | Spiller | Batch: kupong + forpliktelse + game.couponCount++ |
| Trekk tall | Admin | updateDoc med arrayUnion(tall) + currentNumber |
| Send Bingo-rop | Spiller | addDoc til bingo_claims med status 'pending' |
| Godkjenn Bingo | Admin | Batch: claim→approved + coupon.isWinner + game.winners |
| Avvis Bingo | Admin | updateDoc claim→rejected |
| Endre spillstatus | Admin | updateDoc med statusvalidering på klient |
| Bekreft forpliktelse | Admin | updateDoc commitment→confirmed |
