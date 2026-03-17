# CLAUDE.md — Digitalt Bingosystem

## Prosjektoversikt

Digitalt bingosystem med flerlokasjonsstøtte og forpliktelsesbasert betaling (ingen penger).
Hostes på Firebase (gratis Spark-plan), tilgjengelig via https://bingo.web.app/

**Kravspesifikasjon:** Se `docs/KRAVSPEKK.md` for komplett kravspekk.

## Teknisk stack

| Lag | Teknologi |
|-----|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS 3 |
| State | Zustand (lett, enkel) |
| Backend | Firebase (serverless, Spark-plan — helt gratis) |
| Database | Cloud Firestore (sanntid) |
| Auth | Firebase Authentication (Google + e-post + anonym) |
| Hosting | Firebase Hosting |
| Testing | Vitest + React Testing Library + Firebase Emulator Suite |

**Arkitekturvalg:** Prosjektet bruker IKKE Cloud Functions. All logikk kjører på klienten, og integritet sikres gjennom Firestore Security Rules. Dette betyr:
- Ingen Blaze-plan nødvendig (helt gratis drift for små/mellomstore arrangement)
- Kuponger genereres på klienten og valideres av Firestore-regler ved skriving
- Bingo-rop sendes som forespørsler som admin/bingovert godkjenner manuelt
- Trekning gjøres direkte av admin-klienten med Firestore-skriveoperasjoner

## Prosjektstruktur

```
bingo-project/
├── CLAUDE.md                  # <-- du leser denne
├── docs/
│   ├── KRAVSPEKK.md           # Kravspesifikasjon (arbeidssammendrag)
│   ├── SETUP_GUIDE.md         # Hva eier må gjøre før utvikling
│   └── DATAMODEL.md           # Firestore-datamodell med eksempler
├── public/
│   ├── index.html
│   ├── manifest.json
│   └── icons/
├── src/
│   ├── main.tsx               # Entrypoint
│   ├── App.tsx                # Router-oppsett
│   ├── components/            # Gjenbrukbare UI-komponenter
│   │   ├── ui/                # Generiske (Button, Card, Modal, etc.)
│   │   ├── bingo/             # Bingo-spesifikke (CouponGrid, NumberBall, etc.)
│   │   ├── admin/             # Admin-komponenter
│   │   └── bigscreen/         # Storskjerm-komponenter
│   ├── pages/                 # Sidekomponenter (1 per rute)
│   │   ├── HomePage.tsx
│   │   ├── GamePage.tsx
│   │   ├── BigScreenPage.tsx
│   │   ├── AdminPage.tsx
│   │   ├── ProfilePage.tsx
│   │   └── SuperAdminPage.tsx
│   ├── hooks/                 # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useGame.ts
│   │   ├── useLocation.ts
│   │   └── useCoupon.ts
│   ├── services/              # Firebase-abstraksjoner
│   │   ├── firebase.ts        # Firebase-init og config
│   │   ├── auth.ts            # Autentisering
│   │   ├── firestore.ts       # Lesing, lyttere, queries
│   │   └── gameActions.ts     # Skriveoperasjoner (kjøp, trekk, bingo)
│   ├── stores/                # Zustand stores
│   │   ├── authStore.ts
│   │   ├── gameStore.ts
│   │   └── locationStore.ts
│   ├── types/                 # TypeScript-typer
│   │   └── index.ts
│   ├── utils/                 # Hjelpefunksjoner
│   │   ├── couponGenerator.ts
│   │   ├── bingoValidator.ts
│   │   └── constants.ts
│   └── styles/
│       └── globals.css
├── firebase.json              # Firebase-konfigurasjon (Hosting + Firestore)
├── .firebaserc                # Firebase-prosjekt alias
├── firestore.rules            # Firestore sikkerhetsregler (KRITISK)
├── firestore.indexes.json     # Firestore sammensatte indekser
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
└── .env.example               # Mal for miljøvariabler
```

## Kodestandarder og konvensjoner

### Generelt
- **Språk i kode:** Engelsk (variabelnavn, funksjoner, kommentarer)
- **Språk i UI:** Norsk (all tekst brukeren ser)
- **Filnavngivning:** PascalCase for komponenter (`GamePage.tsx`), camelCase for utils/hooks (`useGame.ts`)
- **Typesikkerhet:** Strengt TypeScript. Aldri bruk `any`. Definer alle typer i `src/types/index.ts`.
- **Eksporter:** Named exports overalt, unntatt sidekomponenter som bruker default export.

### React
- Funksjonelle komponenter med hooks, aldri klassekomponenter.
- Props-interface defineres rett over komponenten: `interface GamePageProps { ... }`
- Bruk `React.FC` kun når children er nødvendig; ellers bare type props direkte.
- Hooks som bruker Firebase-lyttere (onSnapshot) MÅ rydde opp i useEffect cleanup.

### Firebase / Firestore
- **Firestore Security Rules er vår eneste sikkerhetslinje.** Behandle reglene som produksjonskode — test grundig med emulator.
- **Leseoperasjoner** bruker onSnapshot for sanntidsdata, getDoc/getDocs for engangslesninger.
- **Skriveoperasjoner** valideres av reglene: formatsjekk, rollesjekk, statussjekk.
- Bruk `serverTimestamp()` for alle tidsstempler.
- Alle Firestore-stier samles i `src/services/firestore.ts`, alle skriveoperasjoner i `src/services/gameActions.ts`.

### Tailwind CSS
- Bruk Tailwind utility classes direkte, unngå custom CSS der mulig.
- Responsivt design: mobile-first (`sm:`, `md:`, `lg:` breakpoints).
- Storskjermvisning bruker `lg:` og `xl:` breakpoints tungt.
- Fargepalett defineres i `tailwind.config.ts` under `theme.extend.colors`.

### Feilhåndtering
- Alle Firebase-kall wrappet i try/catch.
- Brukerfeil vises som norske toast-meldinger (bruk en toast-komponent).
- Console.error for utviklerfeil, aldri console.log i produksjon.

## Viktige regler

1. **Kupongintegritet uten Cloud Functions:** Kuponger genereres på klienten med `couponGenerator.ts`. Firestore Security Rules validerer at kupongen har korrekt format (5×5-matrise, riktige tallområder, unike tall, fri rute i sentrum). En manipulert kupong vil bli avvist av reglene.

2. **Bingo-validering uten Cloud Functions:** Spilleren sender et Bingo-rop som `bingo_claims`-dokument. Klienten gjør en foreløpig sjekk, men det er **bingoverten som godkjenner via kontrollpanelet**. Firestore-regler hindrer at spillere kan markere seg selv som vinnere.

3. **Sanntidsoppdatering:** Alle spillrelaterte data (trukne tall, spillstatus) synkroniseres via Firestore onSnapshot-lyttere. Aldri bruk polling.

4. **Flerlokasjon-isolering:** Alle spilldata er nestet under lokasjonsdokumentet. Firestore-regler MÅ forhindre uautorisert tilgang på tvers av lokasjoner.

5. **Forpliktelsesbasert "betaling":** Ingen pengetransaksjoner. Kupongkjøp = godta forpliktelse.

6. **Trekning:** Admin-klienten skriver direkte til Firestore med `arrayUnion`. Firestore-regler verifiserer admin-rolle, aktiv spillstatus, og gyldig tallområde (1-75).

## Kommandoer

```bash
# Utvikling
npm run dev                    # Start Vite dev server
npm run build                  # Produksjonsbygg
npm run preview                # Forhåndsvis produksjonsbygg

# Firebase Emulator (lokal utvikling)
npm run emulators              # Start Firebase-emulatorer (Auth + Firestore)
npm run dev:full               # Vite + emulatorer parallelt

# Testing
npm run test                   # Kjør Vitest
npm run test:watch             # Vitest i watch-modus

# Deploy
npm run deploy                 # Deploy alt til Firebase
npm run deploy:hosting         # Kun hosting
npm run deploy:rules           # Kun Firestore-regler

# Linting og formatering
npm run lint                   # ESLint
npm run format                 # Prettier
```

## Utviklingsflyt

1. **Alltid start Firebase-emulatorer** under utvikling. Aldri utvikle mot produksjonsdatabasen.
2. Oppdater Firestore-regler FØR du implementerer ny skriveoperasjon. Test med emulator.
3. Skriv typer FØRST, deretter implementasjon.
4. Hver ny side/funksjon skal ha minst én enkel test.

## Nåværende implementeringsfase

**Fase 1 — MVP.** Fokuser på:
- [x] Prosjektoppsett (Firebase, Vite, Tailwind)
- [ ] Autentisering (Google + e-post)
- [ ] Én lokasjon med grunnleggende spillflyt
- [ ] Kupongkjøp med enkel forpliktelse
- [ ] Storskjermvisning med trekning
- [ ] Spillerapp med kupongvisning og automarkering
- [ ] Bingo-rop med manuell godkjenning av bingovert

## Miljøvariabler

Se `.env.example` for nødvendige Firebase-config verdier. Disse settes av prosjekteier — aldri hardkod Firebase-konfigurasjon.
