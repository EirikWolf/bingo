# Alle faser fullfort

> Prosjektet er komplett.

## Fullforte faser

- Fase 0: Prosjektskjelett ✅
- Fase 1: Auth + lokasjoner ✅
- Fase 2: Kupongkjop + spillflyt ✅
- Fase 3: Storskjerm + trekning + lyd ✅
- Fase 4: Bingo-rop + vinner ✅
- Fase 5: Kasserer + forpliktelser ✅
- Fase 6: Vipps + SMS + varsler ✅ (uten FCM push — krever Cloud Functions)
- Fase 7: Dev-admin + testdata ✅
- Fase 8: PWA + offline + polish ✅

## Fase 8 — Hva ble gjort

- [x] Service Worker + offline cache (vite-plugin-pwa med Workbox, 16 precached entries)
- [x] PWA-manifest + installeringsprompt (InstallPrompt-komponent med beforeinstallprompt)
- [x] Firestore offline persistence (enableIndexedDbPersistence)
- [x] WCAG 2.1 AA gjennomgang og fiks:
  - Modal: fokus-trap, fokus-retur, aria-labelledby, lukkeknapp fokusring
  - LoginPage: sr-only labels pa alle inputs, focus:ring-2
  - HomePage: LocationCard fokusring + aria-label, profilknapp fallback
  - CouponGrid: aria-labels pa alle celler, aria-hidden pa dekorative elementer
  - Badge: warning-variant kontrastfiks (yellow-700 → yellow-800)
  - Ball-farger: ball-i og ball-n morknet for hvit-tekst-kontrast
- [x] PWA-ikoner generert (64, 180, 192, 512px)

## Neste steg

- `npm run deploy` for a deploye til Firebase Hosting
- Kjor Lighthouse i Chrome DevTools pa produksjonsbygget for endelig scoring

## Notater

- FCM push-varsler droppet — krever Cloud Functions som ikke er tilgjengelig pa Spark-planen.
- Vipps bruker deep link: `vipps://send?number=X&amount=Y`
- SMS bruker deep link: `sms:{phone}?body={encoded}`
- Admin-innstillinger-fane lagt til for Vipps-nummer, standardbelop, spillinnstillinger.
