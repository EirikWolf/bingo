# Klargjøring for utvikling — Steg-for-steg

Denne guiden beskriver alt DU (prosjekteier) må gjøre før Claude Code kan jobbe uavbrutt med prosjektet.

---

## Steg 1: Installer nødvendige verktøy

### 1.1 Node.js
- Last ned og installer **Node.js 20 LTS** fra https://nodejs.org/
- Bekreft:
  ```bash
  node --version    # v20.x.x eller nyere
  npm --version     # 10.x.x eller nyere
  ```

### 1.2 Firebase CLI
```bash
npm install -g firebase-tools
firebase --version
```

### 1.3 Git
- Installer fra https://git-scm.com/ (om du ikke har det)

---

## Steg 2: Opprett Firebase-prosjekt

### 2.1 Gå til Firebase Console
1. Åpne https://console.firebase.google.com/
2. Klikk **"Add project"**
3. Prosjektnavn: `bingo` (Firebase legger til et unikt suffiks)
4. Google Analytics: Valgfritt
5. Klikk **"Create project"**

### 2.2 Legg til en webapp
1. I Firebase Console → ⚙️ → **"Project settings"**
2. Scroll ned → klikk web-ikonet `</>`
3. App-kallenavn: `bingo-web`
4. ✅ Kryss av for **"Also set up Firebase Hosting for this app"**
5. Klikk **"Register app"**
6. **VIKTIG: Kopier hele `firebaseConfig`-objektet** som vises:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "bingo-xxxxx.firebaseapp.com",
     projectId: "bingo-xxxxx",
     storageBucket: "bingo-xxxxx.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abc123"
   };
   ```
7. Lagre disse verdiene — du trenger dem i Steg 4.

### 2.3 Aktiver tjenestene

#### Firestore Database
1. **"Build"** → **"Firestore Database"** → **"Create database"**
2. Lokasjon: **`europe-west1` (Belgium)** (nærmest Norge)
3. Start i **"production mode"**
4. Klikk **"Create"**

#### Authentication
1. **"Build"** → **"Authentication"** → **"Get started"**
2. Aktiver under **"Sign-in method"**:
   - **Email/Password** — aktiver, lagre
   - **Google** — aktiver, velg support-e-post, lagre
   - **Anonymous** — aktiver, lagre

#### Hosting
Allerede aktivert fra steg 2.2.

> **Merk:** Du trenger IKKE oppgradere til Blaze-planen. Alt kjører på gratis Spark-plan.

---

## Steg 3: Logg inn med Firebase CLI

```bash
firebase login
```

Bekreft at du ser prosjektet:
```bash
firebase projects:list
```

---

## Steg 4: Sett opp prosjektet lokalt

### 4.1 Klon eller opprett repo (valgfritt)
```bash
git clone https://github.com/DITT-BRUKERNAVN/bingo.git
cd bingo
```

### 4.2 Kopier inn prosjektfilene
Kopier alle filene fra leveransen inn i repoet.

### 4.3 Sett Firebase-prosjektnavn
Rediger `.firebaserc`:
```json
{
  "projects": {
    "default": "DITT-PROSJEKT-ID-HER"
  }
}
```
Finn prosjekt-ID i Firebase Console → Project settings → "Project ID".

### 4.4 Opprett `.env`-fil
```bash
cp .env.example .env
```

Fyll inn Firebase-verdiene fra steg 2.2:
```
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=bingo-xxxxx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=bingo-xxxxx
VITE_FIREBASE_STORAGE_BUCKET=bingo-xxxxx.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

---

## Steg 5: Installer og verifiser

```bash
# Installer avhengigheter
npm install

# Start emulatorer
npm run emulators
```

Du skal se:
```
✔ All emulators ready!
┌───────────────┬────────────────┐
│ Emulator      │ Host:Port      │
├───────────────┼────────────────┤
│ Authentication│ localhost:9099 │
│ Firestore     │ localhost:8080 │
│ Hosting       │ localhost:5000 │
└───────────────┴────────────────┘
```

I en ny terminal:
```bash
npm run dev
```

Åpne http://localhost:5173 — du skal se appen uten feil i konsollen.

---

## Steg 6: Første deploy (kan vente til MVP er klar)

```bash
# Deploy Firestore-regler
firebase deploy --only firestore:rules

# Deploy frontend
npm run build
firebase deploy --only hosting

# Eller alt samtidig:
npm run deploy
```

---

## Sjekkliste før Claude Code kan jobbe

- [ ] Node.js 20+ installert
- [ ] Firebase CLI installert og innlogget (`firebase login`)
- [ ] Firebase-prosjekt opprettet
- [ ] Firestore Database opprettet (europe-west1)
- [ ] Authentication aktivert (Email, Google, Anonymous)
- [ ] `.firebaserc` oppdatert med riktig prosjekt-ID
- [ ] `.env` opprettet med Firebase-konfigurasjon
- [ ] `npm install` kjørt
- [ ] `npm run emulators` starter uten feil
- [ ] `npm run dev` starter uten feil

**Når alle punkter er krysset av, er prosjektet klart.**

---

## Kostnader

Prosjektet kjører på **Firebase Spark-plan (helt gratis)**:

| Tjeneste | Gratiskvote | Typisk bruk |
|----------|------------|-------------|
| Firestore lese | 50 000/dag | ~10 000/kveld |
| Firestore skrive | 20 000/dag | ~2 000/kveld |
| Hosting | 10 GB/mnd | ~1 GB/mnd |
| Authentication | 10K brukere/mnd | ~200/mnd |

For et typisk arrangement med under 100 spillere: **$0.**

---

## Feilsøking

### "Permission denied" ved deploy
```bash
firebase login --reauth
```

### Emulator starter ikke
Sjekk at portene 5000, 8080, 9099 ikke er i bruk.

### ".env-verdier mangler"
Variabler MÅ starte med `VITE_` — Vite eksponerer kun disse til klienten.
