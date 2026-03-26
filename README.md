# FitLog – PWA Fitness Tracker

A clean, minimal progressive web app for tracking workouts on Android (and any browser). All data stored locally + synced to a private GitHub Gist.

## Features
- 🏃 Track Yoga, Running, Workout, Walking, Biking
- ⏱ Start a live timer or enter duration manually
- 🔥 Calories burned estimate (MET-based, uses your logged weight)
- 📊 Weekly & 30-day progress charts
- 🎯 Goal setting (weekly minutes / sessions)
- ⚖️ Weight log
- 🔥 Activity streaks
- ☁️ Auto-syncs to a private GitHub Gist (offline-capable)
- 📥 JSON export / restore

---

## Deploy to GitHub Pages

1. **Fork or push** this repo to your GitHub account
2. Go to **Settings → Pages**
3. Set source to **main branch / root** (or `/docs` if you move files there)
4. GitHub will give you a URL like `https://yourusername.github.io/fitlog`
5. On Android Chrome, visit that URL → tap **"Add to Home Screen"** → it installs as a PWA

---

## Set Up GitHub Gist Sync (optional but recommended)

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens)
2. Click **Generate new token (classic)**
3. Give it the **`gist`** scope only
4. Copy the token
5. In the app → **Settings** → paste the token → tap **Save Settings**
6. The app will auto-create a private Gist called `FitLog Data Backup` on first save
7. Copy the Gist ID (from the URL `gist.github.com/<username>/<GIST_ID>`) into the Gist ID field for future restores on new devices

---

## File Structure

```
index.html      ← Main app shell
styles.css      ← All styles (DM Sans + DM Serif Display)
app.js          ← All logic (storage, sync, charts, timer)
sw.js           ← Service worker (offline cache)
manifest.json   ← PWA manifest
icons/          ← Add icon-192.png and icon-512.png here
```

## Icons

Add your own icons to the `/icons` folder:
- `icon-192.png` (192×192)
- `icon-512.png` (512×512)

You can generate them free at [maskable.app](https://maskable.app) or [favicon.io](https://favicon.io).

---

## Calorie Calculation

Uses MET (Metabolic Equivalent of Task) values:
- Yoga: 3.0 MET  
- Running: 9.8 MET  
- Workout: 6.0 MET  
- Walking: 3.5 MET  
- Biking: 7.5 MET  

Adjusted by intensity (×0.7 light / ×1.0 moderate / ×1.4 intense) and your logged body weight.

---

## Privacy

- All data lives in your browser's **localStorage**
- Gist sync creates a **private** Gist only visible to you
- No servers, no accounts, no tracking
