# Implementeringsplan — BingoPortalen

## Faseoversikt

| Fase | Navn | Estimat | Avhenger av |
|------|------|---------|-------------|
| 0 | Prosjektskjelett | 1 økt | — |
| 1 | Auth + lokasjoner | 1-2 økter | Fase 0 |
| 2 | Kupongkjøp + spillflyt | 2-3 økter | Fase 1 |
| 3 | Storskjerm + trekning | 1-2 økter | Fase 2 |
| 4 | Bingo-rop + vinner | 1-2 økter | Fase 3 |
| 5 | Kasserer + forpliktelser | 1-2 økter | Fase 4 |
| 6 | Vipps + SMS + varsler | 1 økt | Fase 5 |
| 7 | Dev-admin + testdata | 1 økt | Fase 2 |
| 8 | PWA + offline + polish | 1-2 økter | Fase 6 |
| 9 | Videreutvikling | 3-4 økter | Fase 8 |
| 10 | Cloud Functions & serverlogikk | 2-3 økter | Fase 9 |
| 12 | Sikkerhet, turneringsmodus, mørk modus, polish | 2-3 økter | Fase 10 |

---

## Fase 0 — Prosjektskjelett

Alt som må på plass før funksjonell kode skrives.

- [ ] Initier Vite + React + TypeScript-prosjektet (`npm create vite@latest`)
- [ ] Installer avhengigheter: firebase, react-router-dom, zustand, tailwindcss, framer-motion, react-hot-toast, qrcode.react
- [ ] Konfigurer Tailwind med bingo-fargepalett (ball-b/i/n/g/o) og animasjoner
- [ ] Sett opp Firebase-init (`src/services/firebase.ts`) med emulatorstøtte
- [ ] Sett opp `firebase.json` (Hosting + Firestore-emulatorer + Functions)
- [ ] Skriv alle TypeScript-typer i `src/types/index.ts`
- [ ] Opprett `couponGenerator.ts` og `bingoValidator.ts` med enhetstester
- [ ] Opprett `constants.ts` med kolonnefarger, tallområder, labels
- [ ] Sett opp React Router med alle ruter (placeholder-sider)
- [ ] Opprett tom `globals.css` med Tailwind-direktiver og bingo-klasser
- [ ] Skriv `firestore.rules` basert på `docs/SECURITY_RULES.md`
- [ ] Skriv `firestore.indexes.json`
- [ ] Verifiser at `npm run dev` og `npm run emulators` fungerer

**Ferdig-kriterium:** Appen starter, ruter fungerer, emulatorer kjører, alle typer kompilerer.

---

## Fase 1 — Autentisering + lokasjoner

- [ ] Implementer `src/services/auth.ts` (Google, e-post/passord, anonym)
- [ ] Bygg authStore (Zustand) med onAuthStateChanged-lytter
- [ ] Lag innloggingsside med Google-knapp og e-post/passord-skjema
- [ ] Implementer `src/services/firestore.ts` med lyttere og refs
- [ ] Bygg locationStore med `listenToLocations`
- [ ] Lag `HomePage.tsx` — lokasjonsvelger med søk og statusbadges
- [ ] Lag UI-komponenter: Button, Card, Modal, Badge, Spinner, Toast
- [ ] Implementer navigasjonsflyt: velg lokasjon → redirect til `/spill/:id`
- [ ] Verifiser at Firestore-regler blokkerer uautorisert tilgang

**Ferdig-kriterium:** Bruker kan logge inn, se lokasjoner, velge én, og bli redirectet.

---

## Fase 2 — Kupongkjøp + spillflyt

- [ ] Implementer `src/services/actions.ts` med `purchaseCoupon()`
- [ ] Bygg gameStore med `listenToActiveGame` og `listenToUserCoupons`
- [ ] Lag kupongkjøp-flow: vis forpliktelse → velg antall → bekreft avkrysning → kjøp
- [ ] Lag `CouponGrid`-komponent med 5×5 rutenett, B-I-N-G-O header, fri rute
- [ ] Implementer automarkering: reager på `game.drawnNumbers` endringer via onSnapshot
- [ ] Lag "nesten-bingo"-indikator (gjenstående-teller for nærmeste gevinst)
- [ ] Støtt flere kuponger med tabs/swipe
- [ ] Lag `GamePage.tsx` som binder alt sammen
- [ ] Test at Firestore-regler avviser ugyldige kuponger

**Ferdig-kriterium:** Spiller kan kjøpe kupong, se den, og tall markeres automatisk.

---

## Fase 3 — Storskjerm + trekning + lyd

- [ ] Implementer `drawNumber()` i actions.ts (arrayUnion + currentNumber + lastDrawAt)
- [ ] Lag `BigScreenPage.tsx` med fullskjermmodus
- [ ] Bygg `BigNumber`-komponent med Framer Motion bounce-in animasjon
- [ ] Bygg `NumberBoard`-komponent (1-75 rutenett med fargekoding)
- [ ] Vis siste trukne tall som kuleliste
- [ ] Vis lokasjonsnavn, spillinfo og spillertellermetrikk
- [ ] Lag admin-trekkekontroll: Start, Pause og Neste tall (manuelt)
- [ ] Implementer auto-trekning med konfigurerbar timer (3-20 sekunder) og visuell nedtelling
- [ ] Synk nedtelling til storskjerm via `game.autoDrawActive`, `autoDrawIntervalMs`, `lastDrawAt`
- [ ] Implementer statusoverganger i admin: setup → open → active ↔ paused → finished
- [ ] Stemme-annonsering via Web Speech API (`speechSynthesis`) — norsk opplesning av hvert tall
- [ ] Konfigurerbar stemme, hastighet og volum i admin-panelet
- [ ] "Test stemme"-knapp i admin slik at verten kan sjekke lyd for spillet starter
- [ ] Ko-handtering: forrige annonsering avbrytes ved ny (cancel + speak)
- [ ] Smart Stopp: auto-trekning pauser automatisk ved innkommende bingo-rop
- [ ] Bakgrunnsmusikk: generative ambient-toner med start/stopp og volumkontroll
- [ ] Test at kun admin kan trekke tall (Firestore-regler)

**Ferdig-kriterium:** Storskjerm viser trekning live med nedtelling, admin kan styre fra kontrollpanel med stemme og lyd.

---

## Fase 4 — Bingo-rop + vinner

- [ ] Implementer `submitBingoClaim()` i actions.ts
- [ ] Lag Bingo-knapp i spillerapp (aktiveres kun ved gyldig klientside-sjekk)
- [ ] Implementer `listenToPendingClaims()` i firestore.ts
- [ ] Lag admin-panel for innkommende claims: vis kupong, foreslått gevinsttype, godkjenn/avvis
- [ ] Implementer `approveBingoClaim()` og `rejectBingoClaim()` i actions.ts
- [ ] Lag `WinnerAnnouncement`-komponent for storskjerm (konfetti + Framer Motion)
- [ ] Vis vinnere i spillerapp og storskjerm
- [ ] Spill av lyd ved godkjent Bingo (valgfri, konfigurerbar)
- [ ] Test at spillere IKKE kan godkjenne egne claims

**Ferdig-kriterium:** Komplett bingo-flyt fra rop til godkjenning til vinnerannonsering.

---

## Fase 5 — Kasserer + forpliktelser

- [ ] Bygg kasserer-tabell i admin: alle forpliktelser med status, bruker, dato
- [ ] Implementer statusendring: pending → confirmed / cancelled
- [ ] Implementer massehandlinger: velg flere → "Marker som fullført"
- [ ] Implementer filtrering: status, dato, bruker
- [ ] Implementer sortering: dato, navn, status
- [ ] Implementer CSV-eksport av forpliktelsesliste
- [ ] Lag profil-side der spiller ser egne forpliktelser med status
- [ ] Verifiser at spillere IKKE kan endre egne forpliktelser

**Ferdig-kriterium:** Admin kan se, filtrere, massebekrefte og eksportere forpliktelser.

---

## Fase 6 — Vipps + SMS + varsler

- [ ] Implementer Vipps deep link i lokasjonens innstillinger (nummer + standardbeløp)
- [ ] Lag "Betal via Vipps"-knapp som åpner `vipps://send?...`
- [ ] Implementer SMS deep link: "Send SMS"-knapp i kasserer-tabell
- [ ] SMS-knapp åpner `sms:{phone}?body={encoded message}` med ferdig utfylt påminnelse
- [ ] Implementer Firebase Cloud Messaging (FCM) push-varsler for PWA-installerte brukere
- [ ] Admin kan sende push til spillere med utestående forpliktelser
- [ ] Admin-innstilling for å slå på/av påminnelser per lokasjon

**Ferdig-kriterium:** Kasserer kan sende SMS-påminnelser, spillere kan betale via Vipps.

---

## Fase 7 — Dev-admin + testdata

- [ ] Lag `/dev-admin`-rute med testdata-verktøy (kun synlig i utviklingsmodus)
- [ ] Lag seed-skript (`scripts/seed.ts`) som populerer Firestore med testdata
- [ ] Opprett testdata iht. `docs/TEST_DATA_SPEC.md`
- [ ] Lag "Nullstill testdata"-knapp i dev-admin
- [ ] Lag "Simuler trekning"-verktøy (trekk N tall automatisk)
- [ ] Lag "Simuler Bingo-rop"-verktøy

**Ferdig-kriterium:** Utvikler kan raskt populere og nullstille data for testing.

---

## Fase 8 — PWA + offline + polish

- [ ] Konfigurer Service Worker (Workbox via Vite PWA-plugin)
- [ ] Cache app-shell og statiske ressurser
- [ ] Offline-cache for aktive kuponger (Firestore innebygd offline)
- [ ] Legg til "Installer app"-prompt
- [ ] WCAG-gjennomgang: kontrast, fokusring, aria-labels, tastaturnavigasjon
- [ ] Responsivitetstest på ulike skjermstørrelser
- [ ] Ytelsesjekk med Lighthouse (mål: >90 på alle kategorier)
- [ ] Oppdater manifest.json med endelige ikoner

**Ferdig-kriterium:** PWA installerbar, offline-kapabel, tilgjengelig, og performant.

---

## Fase 9 — Videreutvikling

Diverse forbedringer og nye funksjoner etter MVP.

- [x] Spillhistorikk-side
- [x] Aggregert statistikk og leaderboard
- [x] Auto-trekning med konfigurerbar timer
- [x] Admin-administrasjon i innstillinger
- [x] Storskjermkontroller for innloggede admins
- [x] QR-kode på storskjerm for enkel tilgang

**Ferdig-kriterium:** Forbedret brukeropplevelse med statistikk, auto-trekning og storskjermkontroll.

---

## Fase 10 — Cloud Functions & serverlogikk

Firebase Cloud Functions v2 for server-side validering, push-varsler og automatisering.

- [x] `onBingoClaimCreated` — Server-side bingo-validering
- [x] `onGameStatusChanged` — FCM push ved spillstart/avslutning
- [x] `onBingoClaimNotify` — FCM push til admin ved bingo-rop
- [x] `onPaymentConfirmed` — FCM push ved betalingsbekreftelse
- [x] `onGameStatsUpdate` — Aggregert lokasjonsstatistikk
- [x] `onWinnerLeaderboardUpdate` — Leaderboard-oppdatering ved vinnere
- [x] `onGameFinishedUpdateLeaderboard` — Oppdater gamesPlayed ved spillslutt
- [x] `onClaimServerValidated` — Logg avvik mellom klient/server-validering
- [x] `autoDrawScheduler` — Server-side auto-trekning (hvert minutt)
- [x] `dailyCleanup` — Daglig opprydding av gammel data

**Ferdig-kriterium:** 10 Cloud Functions deployet og aktive i produksjon.

---

## Fase 12 — Sikkerhet, turneringsmodus, mørk modus og polish

- [x] `onCouponCheatCheck` — Juks-deteksjon ved kupongkjøp
- [x] `onClaimCheatCheck` — Flagging av mistenkelige bingo-rop
- [x] `onCouponRateLimit` — Rate limiting på kupongkjøp (>10/5min)
- [x] `onTournamentRoundFinished` — Turneringsmodus med 3-2-1 poengberegning
- [x] `dailyFirestoreBackup` — Daglig Firestore-backup til Cloud Storage
- [x] Mørk modus (Tailwind `darkMode: 'class'`, theme store, globale CSS-overrides)
- [x] Onboarding-wizard (5-trinns veiviser for ny lokasjon)
- [x] Firebase-chunk splitting (4 separate chunks + vendor-chunk)

**Ferdig-kriterium:** 15 Cloud Functions totalt, mørk modus, onboarding, og optimalisert bundle.
