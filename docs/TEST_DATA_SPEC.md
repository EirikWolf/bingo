# Testdata-spesifikasjon — BingoPortalen

## Formål

Seed-skriptet (`scripts/seed.ts`) og `/dev-admin`-ruten skal kunne populere Firestore med
realistiske testdata for utvikling og demonstrasjon. Skriptet kjøres mot Firebase-emulatorer.

## Kommando

```bash
npm run seed      # Populer emulator med all testdata
```

I dev-admin UI:
- "Seed testdata" — kjør alt under
- "Nullstill alt" — slett alle samlinger og seed på nytt
- "Simuler trekning" — trekk N tall for aktivt spill
- "Simuler Bingo-rop" — opprett et pending bingo_claim

## Testbrukere

| # | UID | Navn | Rolle | E-post | Lokasjon |
|---|-----|------|-------|--------|----------|
| 1 | `user-admin-gneist` | Kari Nordmann | admin | kari@test.no | Gneist |
| 2 | `user-admin-aurora` | Per Hansen | admin | per@test.no | Aurora |
| 3 | `user-super` | Admin Superbruker | superadmin | super@test.no | — |
| 4 | `user-player-1` | Ole Olsen | player | ole@test.no | Gneist |
| 5 | `user-player-2` | Lisa Berg | player | lisa@test.no | Gneist |
| 6 | `user-player-3` | Mona Lie | player | mona@test.no | Aurora |
| 7 | `user-player-4` | Tarjei Vik | player | tarjei@test.no | Gneist |
| 8 | `user-player-5` | Ingrid Dahl | player | ingrid@test.no | — (inaktiv) |

Alle testbrukere opprettes i Firebase Auth-emulatoren med passord `test1234`.

## Testlokasjoner

### Lokasjon 1: Idrettslaget Gneist
```json
{
  "name": "Idrettslaget Gneist",
  "description": "Bingo hver onsdag kl. 19:00",
  "adminUids": ["user-admin-gneist"],
  "activeGameId": "game-gneist-active",
  "settings": {
    "maxCouponsPerPlayer": 5,
    "defaultCommitment": "1 time dugnad per kupong",
    "winConditions": ["row", "column", "diagonal"],
    "vippsNumber": "12345678",
    "vippsDefaultAmount": 50
  },
  "playerCount": 4
}
```

### Lokasjon 2: Kulturhuset Aurora
```json
{
  "name": "Kulturhuset Aurora",
  "description": "Bingokveld første fredag i måneden",
  "adminUids": ["user-admin-aurora"],
  "activeGameId": "game-aurora-active",
  "settings": {
    "maxCouponsPerPlayer": 3,
    "defaultCommitment": "Bake kake til neste arrangement",
    "winConditions": ["row", "column", "diagonal", "full_board"]
  },
  "playerCount": 1
}
```

### Lokasjon 3: Sportsklubben Frisk (inaktiv)
```json
{
  "name": "Sportsklubben Frisk",
  "description": "Sesongavslutning — bingo!",
  "adminUids": ["user-super"],
  "activeGameId": null,
  "playerCount": 0
}
```

## Testspill

### Gneist — Aktivt spill (pågår trekning)
```json
{
  "id": "game-gneist-active",
  "status": "active",
  "drawnNumbers": [7, 22, 35, 42, 47, 48, 51, 56, 61, 68, 72, 3, 12, 28],
  "currentNumber": 28,
  "totalNumbers": 75,
  "winConditions": ["row", "column", "diagonal"],
  "winners": [],
  "couponCount": 6,
  "playerCount": 3,
  "commitment": "1 time dugnad — loppemarked 5. april"
}
```

### Gneist — Historisk spill (avsluttet med vinner)
```json
{
  "id": "game-gneist-finished",
  "status": "finished",
  "drawnNumbers": [4, 17, 33, 46, 62, 8, 21, 38, 54, 71, 2, 29, 41, 59, 65, 11, 24, 37, 48, 73],
  "currentNumber": 73,
  "winners": [{
    "userId": "user-player-1",
    "displayName": "Ole Olsen",
    "couponId": "coupon-ole-hist",
    "winCondition": "row"
  }],
  "couponCount": 4,
  "playerCount": 2,
  "commitment": "Vaske garderober"
}
```

### Aurora — Aktivt spill (åpent for kjøp)
```json
{
  "id": "game-aurora-active",
  "status": "open",
  "drawnNumbers": [],
  "currentNumber": null,
  "winners": [],
  "couponCount": 1,
  "playerCount": 1,
  "commitment": "Bake kake til neste arrangement"
}
```

## Testkuponger

Generer med `couponGenerator.ts`. Minst 6 kuponger for Gneist (aktiv spill):
- Ole: 2 kuponger (én der rad 2 nesten er ferdig — kun 1 tall igjen)
- Lisa: 2 kuponger
- Tarjei: 2 kuponger

For den nesten-ferdig kupongen, velg tall slik at alle unntatt ett i rad 2
finnes i spillets `drawnNumbers`. Dette tester "nesten-bingo"-indikatoren.

## Testforpliktelser

| Spiller | Lokasjon | Status | Beskrivelse |
|---------|----------|--------|-------------|
| Ole Olsen | Gneist | pending | 1 time dugnad — loppemarked 5. april (kupong 1) |
| Ole Olsen | Gneist | pending | 1 time dugnad — loppemarked 5. april (kupong 2) |
| Lisa Berg | Gneist | confirmed | 1 time dugnad — julemarked (fra forrige spill) |
| Lisa Berg | Gneist | pending | 1 time dugnad — loppemarked 5. april (kupong 1) |
| Tarjei Vik | Gneist | overdue | Vaske garderober — frist 1. mars (forfalt!) |
| Tarjei Vik | Gneist | pending | 1 time dugnad — loppemarked 5. april |
| Mona Lie | Aurora | pending | Bake kake til neste arrangement |

## Test Bingo-claims

Opprett ett `pending` bingo_claim for det aktive Gneist-spillet:
```json
{
  "userId": "user-player-4",
  "userDisplayName": "Tarjei Vik",
  "couponId": "coupon-tarjei-1",
  "status": "pending",
  "suggestedWinCondition": "row"
}
```

Dette lar utvikleren teste godkjenning/avvisning i admin-panelet umiddelbart.

## Dev-admin UI (`/dev-admin`)

Vises kun når `import.meta.env.DEV === true` (Vite dev-modus).

Skjermbilder:
1. **Oversikt** — antall dokumenter per samling, knapp for seed/nullstill
2. **Simuler trekning** — velg lokasjon + spill, slider for antall tall, "Trekk"-knapp
3. **Simuler Bingo** — velg spiller + kupong, "Send Bingo-rop"-knapp
4. **Lag bruker** — raskt opprette ny testbruker med valgfri rolle
