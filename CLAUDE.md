# CLAUDE.md — BingoPortalen

## Hva er dette

BingoPortalen er en PWA for digitale bingoarrangementer med flerlokasjonsstøtte og forpliktelsesbasert betaling. Ingen penger — spillere forplikter seg til dugnad/tjenester for å kjøpe kuponger.

**URL:** https://bingo.web.app/  
**Plan:** Firebase Spark (gratis) — ALDRI bruk Cloud Functions.

## Les disse filene FØR du koder

| Fil | Innhold | Les når |
|-----|---------|---------|
| `docs/CURRENT_PHASE.md` | Hva du jobber med NÅ | Alltid først |
| `docs/ARCHITECTURE.md` | Datamodell, tekniske valg, mappestruktur | Ved ny funksjonalitet |
| `docs/SECURITY_RULES.md` | Firestore Security Rules-spesifikasjon | Ved nye skriveoperasjoner |
| `docs/IMPLEMENTATION_PLAN.md` | Alle faser med oppgaver og avhengigheter | Ved faseovergang |
| `docs/TEST_DATA_SPEC.md` | Testdata og dev-admin | Ved testing |

## Teknisk stack

- **Frontend:** React 18 + TypeScript + Vite
- **Styling:** Tailwind CSS 3 + Framer Motion (animasjoner)
- **State:** Zustand
- **Backend:** Firebase Firestore (sanntid) + Firebase Auth + Firebase Hosting
- **Testing:** Vitest + React Testing Library + Firebase Emulator Suite

## Ufravikelige regler

1. **Ingen Cloud Functions.** All logikk på klienten. Firestore Security Rules er eneste sikkerhetslinje.
2. **Firestore-regler oppdateres FØRST.** Før du skriver ny kode som skriver til Firestore, oppdater `firestore.rules` og test med emulator.
3. **Aldri bruk `any` i TypeScript.** Alle typer i `src/types/`.
4. **Sanntid via onSnapshot.** Aldri polling. Rydd opp lyttere i useEffect cleanup.
5. **Mobile-first.** All styling starter med mobilvisning, utvides med `sm:`, `md:`, `lg:`.
6. **Norsk UI, engelsk kode.** All tekst brukeren ser er på norsk. Variabelnavn, funksjoner og kommentarer på engelsk.
7. **WCAG 2.1 AA.** Fargekontrast, tastaturnavigasjon, aria-attributter.
8. **serverTimestamp()** for alle tidsstempler. Aldri `new Date()` i Firestore-dokumenter.
9. **writeBatch()** når flere dokumenter oppdateres samtidig.
10. **Bruk prosjektets eksisterende Firebase-konfigurasjon.** Aldri hardkod config-verdier.

## Kodestil

- **Komponenter:** PascalCase (`GamePage.tsx`), funksjonelle med hooks
- **Utils/hooks:** camelCase (`useGame.ts`)
- **Props:** Interface rett over komponenten, aldri inline
- **Eksporter:** Named exports, unntatt sidekomponenter (default export)
- **Feilhåndtering:** try/catch rundt alle Firebase-kall, norske toast-meldinger til bruker
- **CSS:** Tailwind utilities direkte, custom CSS kun i `globals.css` for bingo-spesifikke klasser

## Mappestruktur

```
src/
├── components/
│   ├── ui/          # Button, Card, Modal, Toast, Badge, Spinner
│   ├── bingo/       # CouponGrid, NumberBall, DrawnNumbers, BingoButton
│   ├── admin/       # DrawControl, ClaimReview, CommitmentTable, GameSetup
│   └── bigscreen/   # BigNumber, NumberBoard, WinnerAnnouncement
├── pages/           # En per rute, default export
├── hooks/           # useAuth, useGame, useLocation, useCoupon, useClaims
├── services/
│   ├── firebase.ts  # Init + emulatorkobling
│   ├── auth.ts      # Innlogging/utlogging
│   ├── firestore.ts # Refs, queries, lyttere (kun lesing)
│   └── actions.ts   # Alle skriveoperasjoner (kjøp, trekk, bingo, admin)
├── stores/          # Zustand: authStore, gameStore, locationStore
├── types/index.ts   # Alle TypeScript-typer
├── utils/
│   ├── couponGenerator.ts  # 5×5 kupong-generering
│   ├── bingoValidator.ts   # Gevinstsjekk på klienten
│   └── constants.ts        # Bingo-kolonner, farger, labels
└── styles/globals.css
```

## Ruter

| Rute | Side | Tilgang |
|------|------|---------|
| `/` | Lokasjonsvelger + onboarding | Alle |
| `/spill/:locationId` | Spillerapp med kupong(er) | Innlogget |
| `/skjerm/:locationId` | Storskjerm (projektor/TV) | Alle |
| `/admin/:locationId` | Bingovert + kasserer | Admin |
| `/admin` | Superadmin-oversikt | Superadmin |
| `/profil` | Profil + mine forpliktelser | Innlogget |
| `/dev-admin` | Testdata-verktøy | Kun utvikling |

## Kommandoer

```bash
npm run dev          # Vite dev server (port 5173)
npm run emulators    # Firebase-emulatorer (Auth + Firestore)
npm run dev:full     # Begge parallelt
npm run build        # Produksjonsbygg
npm run test         # Vitest
npm run deploy       # Bygg + deploy alt
npm run deploy:rules # Kun Firestore-regler
npm run seed         # Populer emulator med testdata
```

## Når du er ferdig med en oppgave

1. Oppdater checkboxen i `docs/CURRENT_PHASE.md`
2. Hvis fasen er komplett, oppdater `docs/CURRENT_PHASE.md` til neste fase
3. Test at emulatorer + dev server fungerer uten feil
