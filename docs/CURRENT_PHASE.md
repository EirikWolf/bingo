# Fase 14: Konfigurerbar auto/manuell trekning og utfylling — ✅ FULLFØRT

> Startet: 2026-04-26 | Fullført: 2026-04-26

## Oppgaver

- [x] **Datamodell.** `LocationSettings.autoMarkEnabled` (default for nye spill, default `true`) og `Game.autoMarkEnabled` (immutable etter opprettelse).
- [x] **Validator.** `computeMarks(numbers, drawn, playerMarks, autoMark)`, `findWinConditionFromMarks`, `countRemainingFromMarks`. Manuell modus intersekter defensivt med trukne tall.
- [x] **CouponGrid.** Ny `autoMark`-prop og `onToggleMark`-callback. Klikkbare celler i manuell modus med tastaturstøtte. Gyllen ring (`bingo-cell-drawn-hint`) på umarkerte celler hvis nummer er trukket.
- [x] **GamePage.** Velger validator-variant ut fra `game.autoMarkEnabled`. Ny `handleToggleMark` som kaller `toggleCouponMark`-action; viser toast hvis tallet ikke er trukket.
- [x] **Admin: spillopprettelse.** To checkbokser ("Automatisk trekning" + "Automatisk utfylling av kuponger") forhåndsutfylt fra lokasjons-defaults.
- [x] **Admin: lokasjonsinnstillinger.** `SettingsPanel` har defaults for begge moduser.
- [x] **Firestore-regler.** Eier kan oppdatere kun `markedCells` på egen kupong når `game.autoMarkEnabled == false`.
- [x] **Seed-data.** Alle locations og spill får `autoMarkEnabled: true` (preserve current behavior).
- [x] **Verifisering.** Typecheck OK, 25 unit-tester grønne, build OK.

# Tidligere faser

# Fase 13: Stabilisering, oppgraderinger og smarte varsler — ✅ FULLFØRT

> Startet: 2026-03-26 | Fullført: 2026-03-26

## Oppgaver

- [x] **Fiks auto-trekning.** Global `useAutoDraw`-hook i App.tsx erstatter per-side auto-draw loops. Fungerer uavhengig av hvilken side admin befinner seg på. BigScreen og AdminPage viser kun countdown.
- [x] **Oppgrader Node.js runtime til 22.** Cloud Functions oppgradert fra Node.js 20 til 22 (Node 20 deprekeres 2026-04-30).
- [x] **Oppgrader firebase-functions.** Oppdatert fra v5 til v6, firebase-admin fra v12 til v13.
- [x] **CF-017: Smartere push-varsler.** `onGameStartedNotify` — personlig push ved trekkingstart ("Du har X kuponger. Lykke til!"). `unmarkedNumbersReminder` — hvert 5. minutt, push til spillere med 3+ umarkerte treff.
- [x] **Teknisk gjeld.** Double-init guard i locationStore. CommitmentsTable brukte allerede Button-komponent. Framer Motion ref-advarsel er kosmetisk (løst i v12).

## Fullførte faser

- Fase 0–8: Prosjektskjelett → PWA + offline + polish
- Fase 9: Videreutvikling (13/19)
- Fase 10: Cloud Functions & serverlogikk
- Fase 12: Sikkerhet, turneringsmodus, mørk modus og polish
- Fase 13: Stabilisering, oppgraderinger og smarte varsler

## Gjenstående (fremtidig / krever ekstern oppsett)

- CF-010: Vipps Checkout API (krever merchantavtale)
- CF-011: Betalingspåminnelser (avhenger av CF-010)
- CF-014: E-postvarsler (krever SendGrid/Mailgun-konto)
- CF-015: SMS-varsler (krever Twilio-konto)
- CF-019: Bildeprosessering
- NY-013: Flerspråklig støtte (i18n) — stor refaktorering
- NY-019: E2E-tester med Playwright
