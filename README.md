# X440 Garage — Harley-Davidson X440 PWA

A Matte Denim Black & Harley Orange Progressive Web App built specifically for iPhone (`Add to Home Screen`) to track fuel mileage, petrol bunk rankings, highway trips, Google Maps Timeline motorcycle rides, manual-tuned maintenance intervals, structured key-value service bills, and issues.

## 1. Local Setup

```bash
npm install
cp .env.example .env.local
```

Open `.env.local` and paste your 4 Firebase Web App values from Firebase Console → Project Settings → Your apps:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`

Run locally:
```bash
npm run dev
```

## 2. Apply Firestore Security Rules (1 minute)

In **Firebase Console → Firestore Database → Rules**, paste the contents of `firestore.rules` and click **Publish**. This locks all your data strictly to your signed-in Google account.

## 3. Push to GitHub & Deploy on Cloudflare Pages

1. Push this folder to a GitHub repository (`.env.local` is gitignored automatically).
2. Open [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages → Create → Pages → Connect to Git**.
3. Select your repository and set:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. Under **Environment variables (Production)**, add the same 4 `VITE_FIREBASE_*` keys from `.env.local`.
5. Click **Save and Deploy**.
6. **Important (Google Login):** Copy your new `*.pages.dev` domain, go to **Firebase Console → Authentication → Settings → Authorized domains**, and add it.

## 4. Install on Your iPhone

1. Open your Cloudflare `*.pages.dev` link in **Safari** on your iPhone.
2. Tap the **Share** button → **Add to Home Screen**.
3. Launch **X440** from your Home Screen — it runs full-screen with your custom Matte Denim Black icon and offline Firestore caching.
