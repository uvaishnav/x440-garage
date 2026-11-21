# X440 Garage

A private, single-rider iPhone PWA for a Harley-Davidson X440 Matte Denim Black. It uses React, TypeScript, Vite, Tailwind, Firebase, Leaflet, OpenStreetMap and Cloudflare Pages.

## What is included

- **Fast fuel logging:** odometer plus litres, or total paid plus rate; Full Tank defaults on; nearby OSM petrol bunks, recent bunks, fuel grade, ride mix, notes and backdated entries.
- **Correct tank-to-tank mileage:** partial fills are carried forward until the next full fill, and backdated entries recalculate automatically in odometer order.
- **Fuel intelligence:** city/highway/mixed and fuel-grade averages, running cost per kilometre, fill history, and bunk rankings after at least two clean full-tank intervals.
- **Trips:** before-ride checklist, start/end odometer and time, start/end tank state, linked fuel logs, exact full-to-full or clearly labelled tank-level mileage estimates, cost per kilometre and notes.
- **Route enrichment:** Google Maps Timeline JSON and GPX import, automatic motorcycle filtering, optional Google `DRIVING` fallback, X440 trip matching, route map, speed zones, moving/stopped time, and city/highway road classification using OSM data.
- **X440 Care:** 17 editable kilometre-or-time maintenance reminders, rain-triggered chain care, bike diagnostic map, completion history, custom tasks and task disabling.
- **Issues and service:** quick issue logging with X440 symptom suggestions, severity, resolution notes, next-service handover summary, structured key/value digital bills and separate ownership expenses.
- **Ownership:** fuel, service and other costs; insurance/PUC reminders; default petrol rates; X440 quick-reference values; JSON backup/restore and CSV export.
- **PWA experience:** safe-area support, one-thumb bottom navigation, dedicated centre fuel button, offline app shell and Firestore offline persistence.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Paste the four Firebase Web App values into `.env.local`:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
```

The app exposes a **Local Preview** when these values are missing. Preview data stays in this browser only; configure Firebase before using the app as the permanent copy on your iPhone.

## Firebase setup

1. Create a Firebase project on the Spark plan.
2. Enable **Authentication → Google**.
3. Create a Firestore database. Mumbai (`asia-south1`) is the closest region for the intended rider.
4. Register a Web App and copy its configuration into `.env.local`.
5. In **Firestore Database → Rules**, paste [`firestore.rules`](./firestore.rules) and publish it. Every document is stored beneath the signed-in user's UID.

Firestore's web SDK provides offline caching. OSM bunk lookup, place-name enrichment and road classification still require a connection; entries can be saved without them and enriched later.

## Cloudflare Pages deployment

1. Push this folder to a private Git repository. `.env.local` is already ignored.
2. In Cloudflare, open **Workers & Pages → Create → Pages → Connect to Git**.
3. Use the Vite preset, build command `npm run build`, and output directory `dist`.
4. Add the four `VITE_FIREBASE_*` variables to the production environment.
5. Deploy, then add the resulting `*.pages.dev` host to **Firebase Authentication → Settings → Authorized domains**.

## Install on iPhone

Open the deployed URL in Safari, tap **Share → Add to Home Screen**, then launch X440 Garage from the Home Screen.

## Backups and imported rides

- Create a JSON backup from **Care → Specs & Rates**. The same screen can restore that backup and export a spreadsheet-friendly CSV.
- Import Google Timeline's `location-history.json` or a `.gpx` file from **Trips**. Timeline export shapes can change; the importer supports the common semantic-segment and activity-segment formats and reports when no motorcycle rides are found.
- Backups contain private riding, issue and expense data. Store them somewhere you trust.

## Maintenance note

The built-in schedule is based on the [official X440 owner's manual](https://www.heromotocorp.com/content/dam/hero-aem-website/in/service-owner-manual/H-D-X440-Sep-2023-updated-dec.pdf) and the [Harley-Davidson India X440 specifications](https://www.harley-davidson.com/in/en/motorcycles/2025/x-440.). It remains an editable owner checklist, not a replacement for the latest manual, recalls or dealer instructions. Confirm safety-critical work against the documentation supplied with the motorcycle.
