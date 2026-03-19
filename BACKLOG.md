# BACKLOG — BingoPortalen

> Revisjon 1: 2026-03-19. Alle 40+ punkter fikset.
> Revisjon 2: 2026-03-19. Ny gjennomgang etter bugfikser, profilredigering, telefonnummerkrav, norske tegn og bakgrunnsmusikk.
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

## Revisjon 2 — Fikset 2026-03-19

### ✅ BUG-007: `userPhone: undefined` krasjer kupongkjøp
**Status:** Fikset — `userPhone ?? null` i `purchaseCoupon`. Firestore godtar ikke `undefined`.

### ✅ BUG-008: Norske tegn (æ, ø, å) mangler i all brukersynlig tekst
**Status:** Fikset — 30+ tekststrenger rettet i GamePage, AdminPage, BigScreenPage, LoginPage, ProfilePage, SuperAdminPage, DrawnNumbers, CommitmentsTable, InstallPrompt, SettingsPanel, BingoButton.

### ✅ BUG-009: BingoButton — "naermeste" mangler æ
**Status:** Fikset — "nærmeste gevinst".

### ✅ UI-013: Profilsiden mangler redigeringsfunksjonalitet
**Status:** Fikset — redigeringsmodus med navn og telefonnummer. `updateUserProfile()` i actions.ts.

### ✅ LOGIKK-014: Telefonnummer ikke påkrevd for kupongkjøp
**Status:** Fikset — banner på spillsiden, advarsel i kjøpsmodal, knapp deaktivert, guard i handlePurchase.

### ✅ UI-014: Bakgrunnsmusikk er generert oscillator-lyd
**Status:** Fikset — erstattet med ekte MP3-fil (`public/audio/background-music.mp3`). HTML Audio med loop. Volumslider alltid synlig.

### ✅ SIKKERHET-003: Firestore user-update tillater endring av uid og email
**Status:** Fikset — regel strammet: `request.resource.data.uid == resource.data.uid && request.resource.data.email == resource.data.email`.

### ✅ BUG-010: Firestore-indekser ikke deployet til produksjon
**Status:** Fikset — `firebase deploy --only firestore:indexes` kjørt.

---

## Fase 9: Videreutvikling — Gjør appen til en vinner

> Nye forbedringsmuligheter identifisert i revisjon 2. Sortert etter forventet brukerverdi.

### 9.1 HØYT — Spillopplevelse

#### NY-001: Sanntids kupong-markering ved trekking
**Kategori:** UX / Spillopplevelse
**Beskrivelse:** Når tall trekkes, marker automatisk matchende celler på kupongen med animasjon (blink/highlight). Gi spilleren visuell feedback uten at de trenger å skjønne reglene.
**Verdi:** Gjør spillet engasjerende og intuitivt, spesielt for nye spillere.

#### NY-002: Confetti-animasjon ved bingo
**Kategori:** UI / Spillopplevelse
**Beskrivelse:** Canvas-basert confetti-animasjon når BINGO godkjennes — både på spillerens enhet og storskjerm. Bruk `canvas-confetti`-biblioteket.
**Verdi:** Feiring som gir følelsesmessig klimaks.

#### NY-003: Lydeffekter for hendelser
**Kategori:** UX / Spillopplevelse
**Beskrivelse:** Korte lydeffekter for: tall trukket (pling), tall matcher din kupong (klikk), nær bingo (spenningsmusikk), bingo ropt (fanfare). Separat volumkontroll fra bakgrunnsmusikk.
**Verdi:** Gjør spillet morsommere og mer immersivt.

#### NY-004: Storskjerm — Vinnerbilde og animert spotlight
**Kategori:** UI / Storskjerm
**Beskrivelse:** Vis vinnerens profilbilde (eller initialer-avatar) i spotlight-animasjon på storskjerm ved godkjent bingo. Firebase Storage for bildeopplasting.
**Verdi:** Sosialt element som motiverer spillere.

### 9.2 HØYT — Administrasjon

#### NY-005: Spilleroversikt med forpliktelsesteller
**Kategori:** LOGIKK / Admin
**Beskrivelse:** Ny samling `commitmentCounters` per lokasjon med antall forpliktelser per spiller. Admin kan se hvem som har flest forpliktelser, nullstille tellere. Vises i egen fane i AdminPage.
**Verdi:** Gir admin oversikt og kontroll over hvem som bidrar.

#### NY-006: Push-varsler for bingo-rop og spillstart
**Kategori:** UX / Varsler
**Beskrivelse:** Web Push via Firebase Cloud Messaging (FCM) med service worker. Varsle spillere når spill åpner for kjøp, og admin når noen roper bingo. Krever ikke Cloud Functions — kan trigges klientside.
**Verdi:** Spillere trenger ikke holde appen åpen for å få med seg at spillet starter.

#### NY-007: QR-kode for rask tilgang til lokasjon
**Kategori:** UX / Onboarding
**Beskrivelse:** Generer QR-kode i AdminPage som lenker direkte til `/spill/:locationId`. Kan skrives ut og henges opp i lokalet. Bruk `qrcode`-biblioteket.
**Verdi:** Eliminerer manuell URL-deling. Spillere skanner og er i gang.

### 9.3 MIDDELS — Sikkerhet og robusthet

#### NY-008: Telefonnummervalidering (format)
**Kategori:** SIKKERHET / Validering
**Beskrivelse:** Valider at telefonnummer matcher norsk format (8 siffer, evt. +47-prefiks) i ProfilePage og i Firestore-regler. Vis formatfeil i sanntid.
**Verdi:** Forhindrer ugyldige data og SMS-feil.

#### NY-009: Forfalt-status ("overdue") beregning
**Kategori:** LOGIKK / Forpliktelser
**Beskrivelse:** `CommitmentStatus: 'overdue'` er definert men aldri satt. Legg til `dueDate` i spillopprettelse og beregn forfalt-status klientside i lyttere (sammenlign `dueDate` med `Date.now()`).
**Verdi:** Gir admin og spillere oversikt over forpliktelser som har gått over tid.

#### NY-010: Rate limiting på kupongkjøp
**Kategori:** SIKKERHET
**Beskrivelse:** Firestore-regel som forhindrer at samme bruker kjøper mer enn X kuponger per minutt (bruk `request.time` og `resource.data.purchasedAt`). Forhindrer misbruk.
**Verdi:** Beskyttelse mot automatiserte/ondsinnede kjøp.

### 9.4 MIDDELS — Brukeropplevelse

#### NY-011: Historikk — Se tidligere spill og kuponger
**Kategori:** UX / Historikk
**Beskrivelse:** Ny side `/historikk/:locationId` som viser avsluttede spill med vinnere, trukne tall, og spillerens egne kuponger. Lenke fra admin og spillerside.
**Verdi:** Gir verdi utover selve spillet — spillere kan se tilbake på sine spill.

#### NY-012: Mørk modus
**Kategori:** UI / Tilgjengelighet
**Beskrivelse:** Tailwind `dark:`-klasser med systempreferanse-deteksjon og manuell toggle. Spesielt nyttig for storskjerm i mørke lokaler.
**Verdi:** Bedre leseopplevelse i mørke omgivelser, moderne preg.

#### NY-013: Flerspråklig støtte (i18n)
**Kategori:** UX / Tilgjengelighet
**Beskrivelse:** Alle brukersynlige strenger flyttes til `i18n/nb.json` med `react-i18next`. Legg til engelsk (`en.json`) som sekundærspråk.
**Verdi:** Åpner for bruk i flerkulturelle foreninger og internasjonal interesse.

#### NY-014: Onboarding-wizard for nye lokasjoner
**Kategori:** UX / Admin
**Beskrivelse:** Steg-for-steg wizard i SuperAdminPage: opprett lokasjon → legg til admins → konfigurer innstillinger → opprett første spill. Visuell fremdriftsindikator.
**Verdi:** Reduserer friksjonen for nye brukere av systemet.

### 9.5 LAVT — Teknisk gjeld og polish

#### NY-015: Loading-state på enkelt-forpliktelse statusendring
**Kategori:** UX
**Beskrivelse:** ✓/✕-knappene i CommitmentsTable har ingen loading-indikator. Legg til per-rad loading state.

#### NY-016: Vipps deep-link format-verifisering
**Kategori:** LOGIKK
**Beskrivelse:** Verifiser at Vipps deep-link-formatet (`vipps://send?number=...&amount=...`) stemmer med gjeldende Vipps-dokumentasjon.

#### NY-017: SettingsPanel input-validering
**Kategori:** UX
**Beskrivelse:** Vis valideringsfeil for ugyldige verdier (negativ maxCoupons, for kort intervall, etc.) med inline feilmeldinger.

#### NY-018: Code splitting for ruter
**Kategori:** YTELSE
**Beskrivelse:** Lazy-load sider med `React.lazy()` + `Suspense`. Firebase-chunken er 577 KB — split til per-rute bundles. Reduserer initial load.

#### NY-019: E2E-tester med Playwright
**Kategori:** KVALITET
**Beskrivelse:** Automatiserte tester for kritiske flyter: registrering → kjøp → trekking → bingo → godkjenning. Kjøres mot Firebase-emulatorer.
**Verdi:** Sikrer at fremtidige endringer ikke brekker kjernefunksjonalitet.

---

## Teknisk gjeld (vedvarende)

- SettingsPanel validerer ikke input-verdier synlig for brukeren (lav prioritet)
- `locationStore.initialize()` har ingen guard mot dobbelt-initialisering i StrictMode (lav prioritet)
- CommitmentsTable bruker rå HTML-knapper i stedet for Button-komponenten (kosmetisk)
- Framer Motion `ref`-advarsel i konsollen (kosmetisk, fra AnimatePresence)
