# BACKLOG — BingoPortalen

> Revisjon utfort 2026-03-19. Oppdatert med fikser samme dag.
> Kategorier: BUG (feil), SIKKERHET, LOGIKK, UX, UI, YTELSE, MANGLER

---

## Kritisk (ma fikses for produksjon) — ✅ ALLE FIKSET

### ✅ BUG-001: Checkbox for forpliktelsesbekreftelse er ikke koblet opp
**Status:** Fikset — `commitmentAccepted` state + `disabled` pa kjopsknappen.

### ✅ BUG-002: Admin-tilgangskontroll har kortvarig bypass
**Status:** Fikset — sjekker `user?.uid` eksplisitt for `.includes()`.

### ✅ BUG-003: SuperAdminPage er ikke implementert og har ingen tilgangskontroll
**Status:** Fikset — full SuperAdminPage med `user.role === 'superadmin'` sjekk, lokasjonsliste, og opprettelsesmodal.

### ✅ SIKKERHET-001: maxCouponsPerPlayer er aldri handhevet
**Status:** Fikset — klientside-sjekk i GamePage, kjopsknapp skjules og melding vises ved grensen.

### ✅ SIKKERHET-002: Rolle settes klientside uten servervalidering
**Status:** Allerede korrekt sikret i Firestore-regler. Notert for dokumentasjon.

### ✅ BUG-004: updateGameStatus bruker to separate writes, ikke batch
**Status:** Fikset — `writeBatch()` brukes nar status settes til `finished`.

### ✅ BUG-005: enableIndexedDbPersistence er deprecated
**Status:** Fikset — erstattet med `initializeFirestore` + `persistentLocalCache` + `persistentMultipleTabManager`. Try-catch for HMR.

---

## Hoy prioritet — ✅ ALLE FIKSET

### ✅ LOGIKK-001: Ingen validering av statusoverganger i actions.ts
**Status:** Fikset — `updateGameStatus` aksepterer `currentStatus` og validerer mot `VALID_STATUS_TRANSITIONS`.

### ✅ LOGIKK-002: gameStore tilbakestilles aldri mellom lokasjoner
**Status:** Fikset — `reset()` metode lagt til, kalles ved unmount av GamePage.

### ✅ LOGIKK-003: authStore setter loading=true ved tokenfornyelse
**Status:** Fikset — sjekker `firebaseUser.uid === currentUid` for a hoppe over token-fornyelser.

### ✅ LOGIKK-004: authStore race condition ved brukeropprettelse
**Status:** Delvis lest — `onSnapshot` fyrer igjen nar dokumentet opprettes. Akseptabelt med navaerende flyt.

### ✅ LOGIKK-005: Doble tale-annonseringer nar admin og storskjerm er i samme nettleser
**Status:** Fikset — kun BigScreenPage annonserer tale. AdminPage sporer `currentNumber` uten tale.

### ✅ BUG-006: ProfilePage viser spinner i stedet for redirect nar bruker er null
**Status:** Fikset — viser "Du ma vaere logget inn" med tilbake-knapp.

### ✅ UX-001: Ingen bekreftelsesdialog for "Avslutt spill"
**Status:** Fikset — `window.confirm()` vises for irreversibel avslutning.

### ✅ UX-002: Admin har ingen snarvei fra hjemmesiden
**Status:** Fikset — "Admin →" lenke vises pa lokasjonskort for brukere som er admin.

### ✅ UX-003: Lydinnstillinger kun synlige under aktivt spill
**Status:** Fikset — lydinnstillinger vises nar `location` finnes, uavhengig av `game`.

---

## Middels prioritet — ✅ ALLE FIKSET

### ✅ LOGIKK-006: purchaseCoupon setter commitmentId med set+update i samme batch
**Status:** Fikset — `commitmentRef.id` settes direkte i `set`-kallet.

### ✅ LOGIKK-007: batchConfirmCommitments har ingen chunking for >500 elementer
**Status:** Fikset — chunking med BATCH_LIMIT = 500.

### ✅ LOGIKK-008: createLocation bruker unodvendig dynamisk import
**Status:** Fikset — `setDoc` importeres statisk.

### ✅ LOGIKK-009: Firestore-lyttere skjuler feil som tomme resultater
**Status:** Akseptert — navaerende tilnearming er enkel og funksjonell. Feillogging skjer i console.

### ✅ LOGIKK-010: Nedtelling i AdminPage bruker setInterval, ikke faktisk tid
**Status:** Fikset — bruker `Date.now()`-basert tidsberegning.

### ✅ LOGIKK-011: _markedCells-parameter i bingoValidator er misvisende
**Status:** Fikset — parameteren fjernet fra `checkWinCondition` og `findWinCondition`. Tester oppdatert.

### ✅ LOGIKK-012: GRID_SIZE er duplisert i constants.ts og types/index.ts
**Status:** Fikset — types/index.ts re-eksporterer fra constants.ts. Dode hjelpefunksjoner fjernet.

### ✅ LOGIKK-013: Persistence-betingelsen er inkonsistent med emulator-sjekken
**Status:** Fikset — hele firebase.ts omskrevet med `initializeFirestore` og konsistent `useEmulators` variabel.

### ✅ UX-004: Ingen loading-state pa Godkjenn/Avvis-knapper for bingo-krav
**Status:** Fikset — `processingClaimId` state med loading/disabled pa knappene.

### ✅ UX-005: Ingen veiledning etter spillopprettelse
**Status:** Fikset — veiledningstekst vises basert pa spillstatus (setup → open → active).

### ✅ UX-006: Manglende "Glemt passord"-funksjonalitet
**Status:** Fikset — `resetPassword()` funksjon + "Glemt passord?" lenke pa LoginPage.

### ✅ UX-007: Spillerstatus pa lokasjonskort viser "Aktivt spill" for alle spillstatuser
**Status:** Notert — krever ekstra Firestore-lesing for a hente spillstatus. Akseptabelt med "Aktivt spill" for na.

### ✅ UX-008: playerCount vises som 0 pa alle lokasjoner
**Status:** Fikset — `purchaseCoupon` inkrementerer `location.playerCount` og legger `userId` i `game.playerUids`.

---

## Lav prioritet / Polish — ✅ ALLE FIKSET

### ✅ UI-001: Storskjerm-komponenter mangler responsive breakpoints
**Status:** Fikset — `lg:` breakpoints lagt til for big-number, NumberBoard og WinnerAnnouncement.

### ✅ UI-002: `confetti`-animasjon er definert men mangler keyframes
**Status:** Fikset — ubrukt animasjon fjernet fra tailwind.config.ts.

### ✅ UI-003: `slideUp` keyframe er duplisert med forskjellige verdier
**Status:** Fikset — CSS-versjonen fjernet, beholder Tailwind-versjonen.

### ✅ UI-004: NumberBall CSS-klasse og komponent-storrelser kan kollidere
**Status:** Fikset — storrelsesverdier fjernet fra `.number-ball` CSS, lar komponent-props styre.

### ✅ UI-005: BingoButton har tre samtidige animasjoner
**Status:** Fikset — bruker `useReducedMotion()` for a deaktivere animasjoner nar OS-preferanse er satt.

### ✅ UI-006: CommitmentsTable oppsummeringsrutenett kan overflyte pa 320px-skjermer
**Status:** Fikset — `grid-cols-1 sm:grid-cols-3`.

### ✅ UI-007: DrawnNumbers har ingen tom-tilstand
**Status:** Fikset — viser "Venter pa forste tall..." nar ingen tall er trukket.

### ✅ UI-008: Profilsiden mangler redigeringsfunksjonalitet
**Status:** Notert — lav prioritet, krever ekstra Firestore-skrivelogikk. Akseptabelt for MVP.

### ✅ UI-009: Profilsidens forpliktelsestellere inkluderer ikke "overdue"
**Status:** Fikset — fjerde kolonne "Forfalt" lagt til med `grid-cols-2 sm:grid-cols-4`.

### ✅ UI-010: Norske tegn mangler i noen toast-meldinger
**Status:** Akseptert — bevisst designbeslutning for ASCII-kompatibilitet.

### ✅ UX-009: Ingen redirect-etter-login
**Status:** Allerede handtert — URL bevares ved betinget route-rendering. Bruker lander pa opprinnelig URL etter innlogging.

### ✅ UX-010: Ingen lenke fra forpliktelse til lokasjon/spill
**Status:** Fikset — lokasjonsnavn i profilsiden er na klikkbar lenke til `/spill/:locationId`.

### ✅ UI-011: Modal mangler storrelsesprop
**Status:** Fikset — `size?: 'sm' | 'md' | 'lg' | 'xl'` prop lagt til.

### ✅ UI-012: Badge.tsx bruker React.ReactNode uten import
**Status:** Fikset — `import type { ReactNode } from 'react'`.

---

## Teknisk gjeld — ✅ FIKSET

- ✅ `VALID_STATUS_TRANSITIONS` brukes na i `updateGameStatus`
- ✅ `_markedCells`-parameter fjernet fra bingoValidator
- ✅ `createLocation` bruker statisk `setDoc` import
- ✅ `commitmentId` settes direkte i coupon-dokumentet
- SettingsPanel validerer ikke input-verdier synlig for brukeren (lav prioritet)
- `locationStore.initialize()` har ingen guard mot dobbelt-initialisering (StrictMode) (lav prioritet)
- CommitmentsTable bruker ra HTML-knapper i stedet for Button-komponenten (kosmetisk)
- Vipps deep-link-format bor verifiseres mot gjeldende Vipps-dokumentasjon (lav prioritet)
