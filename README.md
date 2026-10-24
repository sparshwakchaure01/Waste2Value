# Waste2Value ♻️

**Industrial by-product exchange for India's MSME clusters — built for Pragyan 2K26, Track 3-03 (Circular Manufacturing Intelligence), Challenge 3.**

Team **SYNC** — Sparsh Wakchaure · Yash Hande · Nakul Firodiya · Chetan Mahale

One factory's plastic scrap is another's raw material. Waste2Value connects industries that generate plastic by-product waste with industries that can reuse it, plus the logistics operators who move it between them — with identities kept private until both sides actually agree to deal.

---

## What it does

- **Google-only sign-in**, then one of two roles: **Industry** (can list scrap to sell, or browse the marketplace to buy) or **Logistics** (lists a vehicle and service districts, picks up accepted deals).
- **Marketplace** of by-product listings — plastic category, grade, quantity, cost, availability frequency (one-time / daily / weekly / monthly), district, photo, description — filterable by category, grade, district, frequency, and price.
- **One-message negotiation flow**, not a chat: a buyer sends a single request message; the seller can **Decline**, **Discuss** (unlocks phone numbers so both sides can talk), or **Accept** (unlocks full company details — name, email, district). Nothing is disclosed until both sides accept.
- **Blind Reveal Flow** — the signature UI moment: a locked card that visibly unlocks in stages (🔒 → 🔓 → ✅) as a request moves from pending → discussing → accepted.
- **Logistics module** — an operator selects every Maharashtra district they serve (flexible point A → B within each), lists their vehicle, and sees every accepted deal whose district matches their service area. (No cost estimator — intentionally out of scope for this build.)
- **Admin panel** — platform-wide user list, live stats (users by role, listings by status, requests, accepted deals, by-category breakdown), and a settings note on how admin access is granted.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Vanilla JavaScript (ES modules), HTML, CSS — no framework |
| Build tool | [Vite](https://vitejs.dev) |
| Routing | A small hand-written hash router (`src/router.js`) |
| Auth | Firebase Authentication — Google provider only |
| Database | Firebase Firestore (free **Spark** plan) |
| Images | Uploaded as base64 data URLs, hard **1MB** client-side limit, decoded directly on view (no Storage bucket needed) |
| Hosting | Designed to deploy anywhere static (Vercel, Netlify, Firebase Hosting) |

Vanilla JS was a deliberate choice — a real build pipeline (Vite) without the complexity of React/TypeScript, so the codebase stays easy to read, extend, and demo-explain in a 24-hour build.

## Project structure

```
Waste2Value/
├── index.html              Entry HTML — fonts, stylesheets, #app mount point
├── public/
│   └── favicon.svg
├── styles/
│   ├── tokens.css          Design-system color/type/spacing tokens
│   ├── main.css             Component library (nav, cards, forms, tables…)
│   └── animations.css      Keyframes — card entrance, blind-reveal unlock, toasts
├── src/
│   ├── main.js              App bootstrap — starts auth listener + router
│   ├── firebase.js          Firebase app/auth/firestore init
│   ├── router.js            Hash-based router + auth/role route guards
│   ├── state.js              Tiny global store (current user, profile)
│   ├── auth.js                Google sign-in/out, user profile CRUD
│   ├── utils.js              DOM helper, base64 conversion, toast, date helpers
│   ├── data/
│   │   ├── categories.js    Plastic categories, grades, frequencies, admin emails
│   │   └── districts.js     All 36 Maharashtra districts
│   ├── services/
│   │   ├── listings.js      Listing CRUD + client-side filtering
│   │   ├── requests.js       Request/negotiation logic + revealLevel() — the
│   │   │                     confidentiality rule, in one place
│   │   ├── logistics.js      Logistics profile (vehicle + districts)
│   │   └── admin.js           Platform-wide stats + user list
│   ├── components/
│   │   ├── nav.js             Top navigation, role-aware links
│   │   └── blindReveal.js     The locked/unlocking contact-reveal card
│   └── pages/
│       ├── landing.js, onboarding.js, dashboard.js, marketplace.js,
│       │   listingDetail.js, createListing.js, matches.js, logistics.js, admin.js
├── firestore.rules          Firestore security rules (+ documented limitation)
└── SETUP.md                 Step-by-step Firebase + run/deploy instructions
```

## Running it

See **[SETUP.md](./SETUP.md)** for full Firebase setup from scratch. Short version, once `src/firebase.js` has your config:

```bash
npm install
npm run dev       # http://localhost:5173
```

```bash
npm run build     # production build → dist/
npm run preview   # serve the production build locally
```

## Security model — an honest note

Firestore's free **Spark** plan has no server-side compute (Cloud Functions require the paid **Blaze** plan). That means the "don't reveal contact details until both sides accept" rule can only be enforced at the **application layer** here — `src/services/requests.js`'s `revealLevel(status)` function decides what the UI is allowed to show, and every page that could display contact info calls it. `firestore.rules` restricts *which documents* a user can read/write, but not which *fields inside* a document — so this is a prototype-grade confidentiality model, not a production-grade one. See the comments at the top of `firestore.rules` for the full explanation and the upgrade path (Blaze + Cloud Functions, or a redacted read endpoint).

## Scope notes

- Logistics cost/price estimation was intentionally **not built** — out of scope by design for this prototype, even though it's mentioned in the official Challenge 3 wording. The logistics module focuses on service-area matching and deal pickup instead.
- The prototype is scoped to the **plastics industry** (9 resin categories) to keep the first working build sharp; the architecture (categories, grades, listings, matching, reveal flow) generalizes to other material types without structural changes.
