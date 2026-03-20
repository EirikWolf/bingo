# BACKLOG — BingoPortalen

> Revisjon 1: 2026-03-19. Alle 40+ punkter fikset.
> Revisjon 2: 2026-03-19. Ny gjennomgang etter bugfikser, profilredigering, telefonnummerkrav, norske tegn og bakgrunnsmusikk.
> Fase 9: 2026-03-19. 13 av 19 forbedringer implementert.
> Fase 10: 2026-03-19. Cloud Functions, FCM, Vipps-betaling, auto-trekking, auto-godkjenning, daglig opprydding.
> Kategorier: BUG, SIKKERHET, LOGIKK, UX, UI, YTELSE, MANGLER

---

## Revisjon 1 — ✅ ALLE FIKSET

<details>
<summary>Klikk for å se alle 40+ løste punkter fra revisjon 1</summary>

### Kritisk
- ✅ BUG-001: Checkbox for forpliktelsesbekreftelse koblet opp
- ✅ BUG-002: Admin-tilgangskontroll — sjekker `user?.uid` eksplisitt
- ✅ BUG-003: SuperAdminPage implementert med tilgangskontroll
- ✅ SIKKERHET-001: maxCouponsPerPlayer håndhevet klientside
- ✅ SIKKERHET-002: Rolle sikret i Firestore-regler
- ✅ BUG-004: `writeBatch()` for statusovergang til `finished`
- ✅ BUG-005: `initializeFirestore` + `persistentLocalCache` erstatter deprecated API

### Høy prioritet
- ✅ LOGIKK-001 til LOGIKK-005: Statusvalidering, store-reset, token-refresh, tale-duplikater
- ✅ BUG-006: ProfilePage viser melding i stedet for spinner
- ✅ UX-001 til UX-003: Bekreftelsesdialog, admin-snarvei, lydinnstillinger

### Middels prioritet
- ✅ LOGIKK-006 til LOGIKK-013: Batch-operasjoner, chunking, imports, validator, persistence
- ✅ UX-004 til UX-008: Loading-states, veiledning, glemt passord, spillerstatus

### Lav prioritet
- ✅ UI-001 til UI-012: Responsive, animasjoner, modal, badge, DrawnNumbers tom-tilstand
- ✅ UX-009 til UX-010: Redirect, forpliktelseslenker

</details>

---

## Revisjon 2 — ✅ ALLE FIKSET

<details>
<summary>Klikk for å se alle 8 løste punkter fra revisjon 2</summary>

- ✅ BUG-007: `userPhone: undefined` krasjer kupongkjøp
- ✅ BUG-008: Norske tegn (æ, ø, å) mangler i all brukersynlig tekst
- ✅ BUG-009: BingoButton — "naermeste" mangler æ
- ✅ UI-013: Profilsiden mangler redigeringsfunksjonalitet
- ✅ LOGIKK-014: Telefonnummer ikke påkrevd for kupongkjøp
- ✅ UI-014: Bakgrunnsmusikk er generert oscillator-lyd
- ✅ SIKKERHET-003: Firestore user-update tillater endring av uid og email
- ✅ BUG-010: Firestore-indekser ikke deployet til produksjon

</details>

---

## Fase 9: Videreutvikling — ✅ 13 av 19 implementert

### 9.1 HØYT — Spillopplevelse

- ✅ **NY-001: Sanntids kupong-markering med glow-animasjon.** Celler lyser opp med puls-glow når et trukket tall matcher. CSS-animasjon `bingo-cell-glow`.
- ✅ **NY-002: Confetti-animasjon ved bingo.** `canvas-confetti`-biblioteket. Confetti på spillerens enhet ved godkjent seier + storskjerm-variant med 6s regneffekt.
- ✅ **NY-003: Lydeffekter for hendelser.** Syntetiserte lyder via Web Audio API: `draw` (pling), `match` (dobbeltbeep), `nearBingo` (stigende), `fanfare` (C-E-G-C). Separat volum fra stemme og musikk. Admin-kontroll.
- ✅ **NY-004: Storskjerm — Vinnerbilde med spotlight.** Initialer-avatar med pulserende spotlight-animasjon. Confetti + animert inngang per vinner.

### 9.2 HØYT — Administrasjon

- ✅ **NY-005: Spilleroversikt med forpliktelsesteller.** Ny "Spillere"-fane i AdminPage. Aggregerer forpliktelser per spiller med sortering (flest totalt, flest ventende, navn).
- ⬜ **NY-006: Push-varsler (FCM).** Ikke implementert — krever service worker-konfigurasjon og FCM-oppsett.
- ✅ **NY-007: QR-kode for rask tilgang.** `qrcode.react` SVG-generering i AdminPage med nedlasting og direkte URL-visning.

### 9.3 MIDDELS — Sikkerhet og robusthet

- ✅ **NY-008: Telefonnummervalidering.** Norsk format (8 siffer ± +47). Sanntidsvalidering i ProfilePage. Auto-normalisering til +47-format ved lagring.
- ✅ **NY-009: Forfalt-status beregning.** Klientside beregning: forpliktelser eldre enn 30 dager med status `pending` vises som `overdue`. Synlig i CommitmentsTable med forfalt-filter og oppsummering.
- ⬜ **NY-010: Rate limiting på kupongkjøp.** Ikke implementert — Firestore-regler mangler god primitiv for tidbasert rate limiting. `maxCouponsPerPlayer` gir tilstrekkelig beskyttelse.

### 9.4 MIDDELS — Brukeropplevelse

- ✅ **NY-011: Historikk — Se tidligere spill.** Ny side `/historikk/:locationId`. Viser avsluttede spill med vinnere, statistikk, og utvidbare trukne tall. Tilgjengelig fra spillersiden.
- ⬜ **NY-012: Mørk modus.** Ikke implementert — krever gjennomgående `dark:`-klasser på alle komponenter.
- ⬜ **NY-013: Flerspråklig støtte (i18n).** Ikke implementert — krever refaktorering av alle strenger.
- ⬜ **NY-014: Onboarding-wizard.** Ikke implementert.

### 9.5 LAVT — Teknisk gjeld og polish

- ✅ **NY-015: Loading-state på forpliktelse-statusendring.** Per-rad loading med `processingIds` Set. Viser "Lagrer..." under operasjon.
- ⬜ **NY-016: Vipps deep-link verifisering.** Ikke verifisert.
- ✅ **NY-017: SettingsPanel input-validering.** Inline feilmeldinger for ugyldige verdier (negativ maxCoupons, intervall utenfor 3–30s, tom forpliktelse, negativt beløp).
- ✅ **NY-018: Code splitting.** `React.lazy()` + `Suspense` for alle sider. Separate chunks i produksjonsbygg.
- ⬜ **NY-019: E2E-tester med Playwright.** Ikke implementert.

---

## Fase 10: Cloud Functions & serverlogikk — ✅ IMPLEMENTERT

### 10.1 Grunnlag
- ✅ **CF-001: Cloud Functions v2 infrastruktur.** `functions/` katalog med TypeScript, firebase-admin, firebase-functions v5.
- ✅ **CF-002: Server-side bingo-validering.** `onBingoClaimCreated` — validerer kupongen mot trukne tall, setter `serverValidated` og `serverValidatedCondition`.
- ✅ **CF-003: FCM push-varsler.** `onGameStatusChanged` (spillstart/åpent/vinner), `onBingoClaimNotify` (admin-varsel ved bingo-rop). Service worker + klient-side token-håndtering.
- ✅ **CF-004: Vipps-betaling.** Kupongprising per lokasjon, admin velger forpliktelse ELLER Vipps per spill, Vipps-betalingsinstruksjoner med kopier-nummer. `onPaymentConfirmed` auto-bekrefter forpliktelse.

### 10.2 Automatisering
- ✅ **CF-005: Automatisk vinnerverifisering.** `onClaimServerValidated` — godkjenner gyldige bingo-rop automatisk uten admin-inngrep. Oppdaterer claim, kupong og game.winners i batch.
- ✅ **CF-006: Serverbasert auto-trekking.** `autoDrawScheduler` — kjører hvert minutt, trekker tall for aktive spill med `autoDrawActive=true` basert på `autoDrawIntervalMs`.
- ✅ **CF-007: Daglig opprydding.** `dailyCleanup` — kjører 03:00 CET. Markerer forpliktelser >30 dager som forfalt, sletter stale FCM-tokens, avslutter forlatte spill >7 dager.

---

## Fase 11: Fremtidige Cloud Function-forbedringer (planlagt)

### 11.1 HØYT — Betaling
| ID | Beskrivelse | Status |
|----|-------------|--------|
| CF-010 | **Vipps Checkout API-integrasjon.** Ekte Vipps-betaling med webhook for automatisk bekreftelse (krever Vipps-merchantavtale) | ⬜ |
| CF-011 | **Betalingspåminnelser.** Scheduled function som sender push-varsel til spillere med ubetalte Vipps-kuponger | ⬜ |

### 11.2 MIDDELS — Kommunikasjon
| ID | Beskrivelse | Status |
|----|-------------|--------|
| CF-014 | **E-postvarsler.** Bekreftelse ved kupongkjøp, påminnelse om forpliktelser (via SendGrid/Mailgun) | ⬜ |
| CF-015 | **SMS-varsler.** For spillere uten push-støtte (via Twilio) | ⬜ |
| CF-017 | **Smartere push-varsler.** "Spillet starter om 10 min", "Du har 1 umarkert tall igjen!" | ⬜ |

### 11.3 LAVT — Teknisk
| ID | Beskrivelse | Status |
|----|-------------|--------|
| CF-019 | **Bildeprosessering.** Automatisk resize/komprimering av profilbilder ved opplasting | ⬜ |

---

## Fase 12: Sikkerhet, turneringsmodus, mørk modus og polish — 🔄 PÅGÅR

> Se `CLAUDE_STEPS_PROMPT.md` for detaljert oppgaveliste.

---

## Gjenstående fra Fase 9 (fremtidig arbeid)

| ID | Beskrivelse | Prioritet |
|----|-------------|-----------|
| ~~NY-006~~ | ~~Push-varsler via FCM~~ | ✅ Fase 10 |
| ~~NY-010~~ | ~~Rate limiting~~ → CF-009, Fase 12 | ✅ Fase 12 |
| ~~NY-012~~ | ~~Mørk modus~~ → Fase 12 | ✅ Fase 12 |
| NY-013 | Flerspråklig støtte (i18n) | Middels |
| ~~NY-014~~ | ~~Onboarding-wizard~~ → Fase 12 | ✅ Fase 12 |
| ~~NY-016~~ | ~~Vipps deep-link~~ → erstattet med betalingsinstruksjoner | ✅ Fase 10 |
| NY-019 | E2E-tester med Playwright | Lav |

---

## Teknisk gjeld (vedvarende)

- `locationStore.initialize()` har ingen guard mot dobbelt-initialisering i StrictMode (lav prioritet)
- CommitmentsTable bruker rå HTML-knapper i stedet for Button-komponenten (kosmetisk)
- Framer Motion `ref`-advarsel i konsollen (kosmetisk, fra AnimatePresence)
