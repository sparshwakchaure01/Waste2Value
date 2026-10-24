# Setup Guide

Everything you need to get Waste2Value running locally, wired to your own Firebase project, and deployed.

## 1. Prerequisites

- Node.js 18+ and npm
- A Google account (for both Firebase and the app's own sign-in)

## 2. Create the Firebase project

1. Go to **[console.firebase.google.com](https://console.firebase.google.com)** → **Add project**.
2. Name it (e.g. `waste2value`) → disable Google Analytics (not needed) → **Create project**.
3. In the left sidebar, click **Build → Authentication → Get started**.
4. Under **Sign-in method**, enable **Google** → set a support email → **Save**.
5. In the left sidebar, click **Build → Firestore Database → Create database**.
   - Choose **Start in production mode** (we provide rules in the next step).
   - Pick a location close to your users (e.g. `asia-south1` for India) — **this cannot be changed later**.
6. Still on the Firestore page, go to the **Rules** tab, delete the default contents, paste in the contents of this project's **`firestore.rules`** file, and click **Publish**.
7. In the left sidebar, click the **⚙️ gear → Project settings**. Under **Your apps**, click the **</>** (web) icon to register a new web app (any nickname). Firebase Hosting is optional — skip it.
8. Firebase will show a `firebaseConfig` object like this:

   ```js
   const firebaseConfig = {
     apiKey: "...",
     authDomain: "...",
     projectId: "...",
     storageBucket: "...",
     messagingSenderId: "...",
     appId: "..."
   };
   ```

   Copy it — you'll paste it into `src/firebase.js` in the next step. (This project ships already wired to a working Firebase config for the team's own project; if you're setting up a **new/different** Firebase project, replace the values in `src/firebase.js` with your own.)

9. Back in **Authentication → Settings → Authorized domains**, make sure `localhost` is listed (it is by default), and add your production domain once you deploy (e.g. `your-app.vercel.app`) — otherwise Google sign-in will fail on that domain with an `auth/unauthorized-domain` error.

## 3. Configure the app's admin account (optional)

Open `src/data/categories.js` and add your own Google account email to `ADMIN_EMAILS`:

```js
export const ADMIN_EMAILS = [
  "you@example.com",
];
```

Whoever signs in with that email sees the **Admin** link in the top nav (user list, platform stats, settings).

The same list must also appear in the `isAdmin()` function in `firestore.rules` — the admin panel reads every request document, which the rules only allow for admins. Publish the rules after editing them (Firestore → Rules tab, or `firebase deploy --only firestore:rules`).

## 4. Install and run locally

```bash
npm install
npm run dev
```

Open the printed URL (usually `http://localhost:5173`). Click **Continue with Google**, pick a role (Industry or Logistics), fill in your company/phone/district, and you're in.

## 5. Build for production

```bash
npm run build       # outputs to dist/
npm run preview     # sanity-check the production build locally
```

## 6. Deploy to Vercel

**Option A — via the Vercel dashboard:**
1. Push this folder to a GitHub repo (or drag-and-drop the folder's `dist/` build if using "Other" framework preset — see Option B for the simpler zip path).
2. On [vercel.com](https://vercel.com), **Add New → Project**, import the repo.
3. Framework preset: **Vite**. Build command: `npm run build`. Output directory: `dist`.
4. **Deploy**.
5. Once live, copy the Vercel URL (e.g. `waste2value.vercel.app`) and add it to Firebase's **Authorized domains** (step 2.9 above), or Google sign-in will fail in production.

**Option B — zip / local build, no GitHub:**
1. `npm run build` locally — this produces a static `dist/` folder.
2. Install the Vercel CLI once: `npm install -g vercel`.
3. From the project root, run `vercel` (first time) or `vercel --prod` (to go live) and follow the prompts — no GitHub repo required, it deploys straight from your machine.
4. Add the resulting URL to Firebase's **Authorized domains**, same as Option A step 5.

## 7. Common issues

| Symptom | Fix |
|---|---|
| `auth/unauthorized-domain` on Google sign-in | Add the domain you're running on (`localhost`, your Vercel URL, etc.) to Firebase → Authentication → Settings → Authorized domains |
| Sign-in popup closes instantly / blocked | Browser is blocking popups — allow popups for the site, or check you're not inside an iframe preview |
| Firestore `permission-denied` | Make sure `firestore.rules` from this repo was published (step 2.6) — the default "test mode" rules expire after 30 days and locked-down rules need the exact rules in this repo |
| Image upload rejected | Photos are capped at **1MB** by design (`src/utils.js → MAX_PHOTO_BYTES`) — compress or resize the image first |
| Blank page after deploy, console shows 404s for `/src/...` | Make sure the Vercel output directory is set to `dist`, not the project root |

## 8. What's on the free tier (and what isn't)

Firebase's **Spark** (free) plan covers everything this app uses: Authentication, Firestore reads/writes within generous daily quotas, and static hosting elsewhere (Vercel). The one thing the free plan can't do is run server-side code (Cloud Functions need the paid **Blaze** plan), which is why the contact-reveal confidentiality logic lives in the app code rather than in a secure backend function — see the **Security model** section in `README.md` and the comments in `firestore.rules` for the full explanation.
