# MBL-AI LMS

Express + EJS app for the MBL-AI learner and admin screens, per `docs/MBL_AI_LMS_Consolidated_PRD_v0.6.md`.
Google OAuth identifies learners and stores their identity in PostgreSQL. Learners submit a phone number and both policy consents before their application enters the admin approval queue; other product screens remain a mock-data preview.

## Run it

```bash
npm install
cp .env.example .env
# Add Google OAuth credentials and PostgreSQL connection details in .env
npm run dev      # nodemon, auto-restart
# or
npm start
```

Open http://localhost:3000 — it redirects to `/login`.

The login page offers a Google sign-in button that redirects to Google and then to `/apply` after authentication. Configure `DB_USER`, `DB_HOST`, `DB_NAME`, `DB_PASSWORD`, and `DB_PORT` for PostgreSQL.

## What's real vs. mock

- Real: Express routing, EJS templates/partials, Google OAuth identity persistence, the transactional learner application and consent flow, the CSS, the client-side interaction logic
  (tab switching, MCQ/subjective drafting, the sprint and simulation players, leaderboard
  filters, admin table search and modals), the safe Markdown renderer for revision notes.
- Mock: all data. `services/mockService.js` is the only file that touches `services/mockData.js`
  (a copy of the original `mockData.js`, extended with helpers for the pages the mock file
  didn't originally cover — course detail, results, monthly players, leaderboard filtering).
- Not implemented (Stage 2, per the PRD): server-side RBAC, PostgreSQL-backed product data beyond learner applications,
  attempt persistence and scoring, AI evaluation, Razorpay, background jobs, transactional email,
  and the server-authoritative exam timer. Every place this matters says so in the UI or in a
  code comment (search for "STAGE 2").

## Project layout

```
app.js, server.js        Express app and entry point
config/                  env config + shared copy constants (PRD wording)
controllers/, routes/    thin controllers, one per area (auth / learner / admin)
services/
  mockData.js            original mock dataset (kept verbatim, minus module renaming)
  mockService.js         the ONLY module controllers call for data; swap this for real
                          services in Stage 2 without touching controllers or views
  format.js, icons.js, markdown.js   view helpers (fmt, icon, safe note renderer)
middleware/
  mockContext.js         STAGE 1 ONLY — injects a demo user, no session exists
views/                   EJS templates (layouts/, partials/, auth/, learner/, admin/, errors/)
public/                  css/, js/, images/ — served statically
```

## Known issues / incomplete by design

- No form actually submits anywhere except learner application submission (leaderboard join, admin approve/reject/publish,
  settings save). Every action either explains this inline or shows a "preview only" toast.
- The exam timer is a per-browser `localStorage` countdown, not a server clock. Refreshing
  keeps the same countdown; "Reset preview attempt" (on the simulation instructions page)
  clears it. Append `?demoMinutes=1` to a simulation attempt URL to see expiry quickly.
- Only one weekly sprint (Contract Law, Week 7) and one monthly simulation (Contract Law)
  have full mock content, because that's what the source `mockData.js` supplied in depth.
  Other sprints/courses show a clear "no preview content" state rather than fabricated
  legal content.
- Leaderboard scores for courses/weeks not in the original mock data are deterministically
  generated (not random on every load) purely so the table has something to show; they are
  clearly mock and not meant to be treated as real rankings data.
