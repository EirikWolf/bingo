# Konfigurerbar auto/manuell trekning og utfylling

**Dato:** 2026-04-26
**Status:** Godkjent design

## Bakgrunn

I dag er kupongmarkering automatisk i klienten — `CouponGrid` regner ut markerte celler fra `drawnNumbers ∩ coupon.numbers`. Trekning kan allerede være auto eller manuell per spill (`game.autoDrawActive`). Brukere ønsker å kunne velge **manuell utfylling** også, slik at spilleren selv må tappe celler — som tradisjonell fysisk bingo.

## Beslutninger

1. **To uavhengige brytere** (auto-trekning, auto-utfylling) — kan kombineres fritt.
2. **Default i `LocationSettings`, overstyrbar per spill ved opprettelse.**
3. **Streng manuell markering** — spiller kan kun markere celler hvis nummeret faktisk er trukket.
4. **Bingo-knapp i manuell modus aktiveres av spillerens markeringer**, ikke av trukne tall. Server-validering uendret (sikkerhet i bunn).

## Datamodell

`LocationSettings`:
```ts
autoMarkEnabled: boolean;  // default for nye spill, default true
```

`Game`:
```ts
autoMarkEnabled: boolean;  // immutable etter opprettelse
```

`Coupon.markedCells` (eksisterer allerede) tas i bruk i manuell modus.

## Komponenter som endres

| Fil | Endring |
|---|---|
| `src/types/index.ts` | Nye felt på `LocationSettings` og `Game` |
| `src/services/actions.ts` | `createGame` får `autoMarkEnabled`-param; ny `toggleCouponMark`-action |
| `src/components/bingo/CouponGrid.tsx` | Prop `autoMark`; klikk-handler i manuell modus |
| `src/utils/bingoValidator.ts` | `computeMarks(coupon, drawnNumbers, autoMark)` |
| `src/pages/GamePage.tsx` | Sender `autoMark` videre, kall `toggleCouponMark` |
| `src/pages/AdminPage.tsx` | Checkbokser ved spillopprettelse |
| `src/components/admin/SettingsPanel.tsx` | Innstilling for lokasjons-default |
| `firestore.rules` | Regel for `markedCells`-oppdatering |
| `src/services/seed.ts` | Sett `autoMarkEnabled` på seed-data |

## Firestore Security Rules

Oppdatering av `markedCells` på en kupong krever:
- `request.auth.uid == resource.data.userId`
- Tilhørende `game.autoMarkEnabled == false`
- Cellens nummer ∈ `game.drawnNumbers`

## Bakoverkompatibilitet

Eksisterende dokumenter uten `autoMarkEnabled` leses som `true` (preserve current behavior). Ingen backfill-jobb nødvendig.

## Tester

- Unit: `bingoValidator.computeMarks` — manuell modus respekterer `markedCells`, ignorerer udrukne.
- Integration (emulator): `toggleCouponMark` avvises hvis spillet er i auto-modus eller nummeret ikke er trukket.
