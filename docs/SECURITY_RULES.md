# Firestore Security Rules — Spesifikasjon

## Hvorfor dette er kritisk

Firestore Security Rules er **førstelinjeforsvaret** for autorisasjon og datavalidering.
Enhver klient kan sende vilkårlige skriveforespørsler — reglene må fange alt.

Cloud Functions gir **andrelinje sikkerhet** med server-side validering:
- `onBingoClaimCreated` — validerer bingo-rop server-side
- `onCouponCheatCheck` — sjekker for juks ved kupongkjøp
- `onClaimCheatCheck` — oppdager mistenkelig mange bingo-rop
- `onCouponRateLimit` — flagger unormalt kjøpstempo

## Prinsipp: Defense in depth

1. **Autentisering** — er brukeren innlogget?
2. **Autorisasjon** — har brukeren riktig rolle for denne operasjonen?
3. **Datavalidering** — har dataene korrekt format og gyldige verdier?
4. **Tilstandssjekk** — er systemet i riktig tilstand for denne operasjonen?
5. **Server-validering** — Cloud Functions bekrefter og flagger mistenkelig aktivitet

## Regler per samling

### `users/{userId}`

| Operasjon | Hvem | Betingelser |
|-----------|------|-------------|
| read | Alle autentiserte | — |
| create | Eier | `userId == auth.uid`, rolle MÅ være `player`, påkrevde felt finnes |
| update | Eier | Kan IKKE endre `role`-feltet |
| update | Superadmin | Kan endre alt inkl. rolle |
| delete | Ingen | — |

### `locations/{locationId}`

| Operasjon | Hvem | Betingelser |
|-----------|------|-------------|
| read | Alle autentiserte | — |
| create | Superadmin | — |
| update | Lokasjonsadmin eller superadmin | `auth.uid in location.adminUids` |
| delete | Superadmin | — |

### `locations/{lid}/games/{gid}`

| Operasjon | Hvem | Betingelser |
|-----------|------|-------------|
| read | Alle autentiserte | — |
| create | Lokasjonsadmin | Status MÅ være `setup`, drawnNumbers MÅ være tom |
| update | Lokasjonsadmin | (se detaljer under) |
| delete | Ingen | — |

**Update-regler for games (detaljer):**

Admin kan oppdatere følgende felt:
- `status` — kun gyldige transisjoner (se status-maskin i ARCHITECTURE.md)
- `drawnNumbers` — kun via arrayUnion, kun når status er `active`
- `currentNumber` — settes sammen med drawnNumbers
- `winners` — kun via arrayUnion, kun når status er `active`
- `startedAt` — settes én gang ved overgang til `active`
- `finishedAt` — settes én gang ved overgang til `finished`
- `couponCount` — kun increment

### `locations/{lid}/games/{gid}/coupons/{cid}`

| Operasjon | Hvem | Betingelser |
|-----------|------|-------------|
| read | Eier av kupongen ELLER lokasjonsadmin | — |
| create | Autentisert spiller | Se valideringskrav under |
| update | Ingen | Kupongdata er immutable etter opprettelse |
| delete | Ingen | — |

**Valideringskrav ved create (kupong):**

Disse reglene erstatter kupong-generering i Cloud Functions:

1. `userId == auth.uid`
2. Spillet MÅ ha status `open`
3. `numbers` er en 5×5-matrise (liste med 5 lister à 5 elementer)
4. Sentrum `numbers[2][2] == 0` (fri rute)
5. Kolonne 0 (B): alle tall mellom 1-15, alle unike
6. Kolonne 1 (I): alle tall mellom 16-30, alle unike
7. Kolonne 2 (N): rad 0,1,3,4 mellom 31-45, alle unike (rad 2 = 0)
8. Kolonne 3 (G): alle tall mellom 46-60, alle unike
9. Kolonne 4 (O): alle tall mellom 61-75, alle unike
10. `markedCells` er 5×5 boolsk matrise, sentrum `markedCells[2][2] == true`
11. `isWinner == false` og `winCondition == null`
12. Påkrevde felt: userId, userDisplayName, numbers, markedCells, commitmentId, isWinner, winCondition, purchasedAt

### `locations/{lid}/games/{gid}/bingo_claims/{claimId}`

| Operasjon | Hvem | Betingelser |
|-----------|------|-------------|
| read | Eier ELLER lokasjonsadmin | — |
| create | Autentisert spiller | `userId == auth.uid`, status MÅ være `pending`, spill MÅ være `active` |
| update | Lokasjonsadmin | Status kun til `approved` eller `rejected` |
| delete | Ingen | — |

**Viktig:** Spillere kan IKKE endre status på sine egne claims. Kun admin kan godkjenne/avvise.

### `commitments/{commitmentId}`

| Operasjon | Hvem | Betingelser |
|-----------|------|-------------|
| read | Eier, lokasjonsadmin for relevant lokasjon, eller superadmin | — |
| create | Autentisert spiller | `userId == auth.uid`, status MÅ være `pending` |
| update | Lokasjonsadmin for relevant lokasjon | Status kun til `confirmed` eller `cancelled`, kan IKKE endre userId |
| update | Superadmin | Kan endre alt |
| delete | Ingen | — |

**Viktig:** Spillere kan IKKE endre status på sine egne forpliktelser.

## Hjelpefunksjoner i reglene

```
isAuthenticated()           → request.auth != null
isOwner(userId)             → auth.uid == userId
isSuperAdmin()              → user.role == 'superadmin'
isLocationAdmin(locationId) → auth.uid in location.adminUids
isValidCouponGrid(numbers)  → format + tallområde + unikhet
isValidMarkedGrid(marked)   → format + sentrum markert
```

## Tester som MÅ bestå

Skriv rules-tester med Firebase Emulator som verifiserer:

1. Spiller kan IKKE opprette kupong med tall utenfor gyldig område
2. Spiller kan IKKE opprette kupong når spill ikke er `open`
3. Spiller kan IKKE endre status på eget bingo_claim
4. Spiller kan IKKE endre status på egen commitment
5. Spiller kan IKKE lese andres kuponger
6. Admin KAN godkjenne bingo_claim
7. Admin kan IKKE opprette kupong for en annen bruker
8. Ikke-admin kan IKKE trekke tall (oppdatere game.drawnNumbers)
9. Admin fra lokasjon A kan IKKE styre lokasjon B
