# Fase 12: Sikkerhet, turneringsmodus, mørk modus og polish

> Startet: 2026-03-20

## Oppgaver

- [x] **CF-008: Juks-deteksjon.** Cloud Function som overvåker kuponger for duplikattall, feil kolonneplassering, ugyldige tall. Separat sjekk for bingo-rop-mønstre (>3 fra samme bruker). Admin-varsling via push.
- [x] **CF-009: Rate limiting på kupongkjøp.** Firestore trigger som flagger kuponger om brukeren har kjøpt >10 siste 5 minutter. Admin-varsling.
- [x] **CF-016: Turneringsmodus.** Cloud Function som håndterer flere runder med poengberegning (3-2-1 poeng). Automatisk oppdatering av standings. Push-varsel ved turneringsvinner.
- [x] **NY-012: Mørk modus.** Tailwind `darkMode: 'class'`, Zustand theme store med persist, toggle i profil (lys/mørk/system), global CSS-overrides for inputs/labels/tekst/bakgrunner. Alle UI-komponenter (Card, Button, Modal, Badge) har dark:-klasser.
- [x] **NY-014: Onboarding-wizard.** 5-trinns veiviser (velkomst → navn → forpliktelse → innstillinger → ferdig) på forsiden. Oppretter lokasjon og konfigurerer grunninnstillinger.
- [x] **CF-018: Firestore backup.** Scheduled Cloud Function som eksporterer database til Cloud Storage daglig kl 02:00 CET via Firestore Admin REST API.
- [x] **Firebase-chunk splitting.** Delt Firebase-chunk fra 577KB til 4 separate: core, auth (176KB), firestore (401KB), messaging (43KB). Vendor-chunk for zustand/framer-motion/etc.

## Fullførte faser

- Fase 0–8: Prosjektskjelett → PWA + offline + polish
- Fase 9: Videreutvikling (13/19)
- Fase 10: Cloud Functions & serverlogikk
- Fase 12: Sikkerhet, turneringsmodus, mørk modus og polish
