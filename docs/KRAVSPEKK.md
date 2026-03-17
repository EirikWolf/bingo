# Kravspesifikasjon — Digitalt Bingosystem (sammendrag)

Full kravspekk er levert som Word-dokument. Dette er et arbeidssammendrag for utvikling.

## Konsept

Digitalt bingo for forsamlingslokaler. Ingen penger — spillere forplikter seg til en fremtidig tjeneste (dugnad, oppgave, osv.) for å "kjøpe" kuponger. Flere uavhengige lokasjoner. Trekning vises på storskjerm, spillere bruker mobilapp.

## Arkitektur

Hele systemet kjører på **Firebase Spark-plan (gratis)** uten Cloud Functions.
All forretningslogikk ligger i klienten, med Firestore Security Rules som sikkerhetsgaranti.
Bingo-validering gjøres av bingovert (manuell godkjenning), ikke automatisk serversiden.

## Tre brukerflater

1. **Spillerapp** (mobil) — velg lokasjon, kjøp kupong, se kupongen med automarkering, rop Bingo
2. **Storskjerm** — fullskjermvisning av trekning, talltavle, vinnere. For TV/projektor
3. **Kontrollpanel** — admin styrer trekning, ser spillere, godkjenner Bingo-rop, håndterer forpliktelser

## URL-struktur

| Rute | Visning |
|------|---------|
| `/` | Landingsside — velg lokasjon |
| `/spill/:locationId` | Spillervisning med kupong(er) |
| `/skjerm/:locationId` | Storskjerm for trekning |
| `/admin/:locationId` | Kontrollpanel for arrangør |
| `/admin` | Superadmin-oversikt |
| `/profil` | Brukerens profil og forpliktelser |

## Brukerroller

- **Superadmin** — oppretter lokasjoner, tildeler admin
- **Admin/Arrangør** — styrer sin lokasjon, trekning, godkjenner Bingo, håndterer forpliktelser
- **Spiller** — velger lokasjon, kjøper kupong, spiller

## Funksjonelle krav (MVP — Fase 1)

### Lokasjon
- Opprett og list lokasjoner med navn og status
- Spillere velger lokasjon fra liste

### Kupongkjøp
- Kjøp kupong ved å godta forpliktelse (bekreftelsesflow)
- Klienten genererer 5×5 kupong, Firestore-regler validerer format

### Spillervisning
- Vis kupong som 5×5-rutenett med automarkering i sanntid
- Støtt flere kuponger per spiller
- Bingo-knapp sender claim som admin godkjenner

### Trekning og storskjerm
- Arrangør trykker "Trekk neste tall" (direkte Firestore-skriving)
- Tallet vises stort på storskjerm + talltavle over alle trukne tall
- Fullskjermmodus

### Bingo-validering
- Spiller sender Bingo-rop (bingo_claims-dokument)
- Klienten gjør foreløpig sjekk, bingovert godkjenner manuelt
- Vis vinner på storskjerm ved godkjenning

### Gevinsttyper (konfigurerbare)
- Én rad, én kolonne, diagonal (standard)
- To rader, full plate, fire hjørner, kors (valgfritt)

### Admin
- Dashboard med spillstatus, spillere, kuponger
- Innkommende Bingo-rop med godkjenn/avvis
- Forpliktelsesregister med status (ventende/bekreftet/forfalt)
- Spillhistorikk

## Ikke-funksjonelle krav

- Sanntidsforsinkelse < 500 ms (Firestore onSnapshot)
- 200+ samtidige spillere per lokasjon
- Lastetid < 3 sekunder på 4G
- Responsivt design (mobil-først)
- PWA-installerbar
- HTTPS, Firestore Security Rules med formatvalidering
- Norsk UI, forberedt for i18n
- Gratis drift på Firebase Spark-plan
