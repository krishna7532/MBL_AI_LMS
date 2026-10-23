# MBL-AI LMS

Express + EJS app for the MBL-AI learner and admin screens, per `docs/MBL_AI_LMS_Consolidated_PRD_v0.6.md`.
Google OAuth identifies learners and stores their identity in PostgreSQL. Learners submit a phone number and both policy consents before their application enters the admin approval queue; other product screens remain a mock-data preview.

## Run it

```bash
npm install
cp .env.example .env
# Add Google OAuth credentials and PostgreSQL connection details, then generate Prisma Client.
npm run prisma:generate
npm run dev      # nodemon, auto-restart
# or
npm start
```

Open http://localhost:3000 — it redirects to `/login`.

The login page offers a Google sign-in button that redirects to Google and then to `/apply` after authentication. Configure `DATABASE_URL` for PostgreSQL. Existing installations can continue to use `DB_USER`, `DB_HOST`, `DB_NAME`, `DB_PASSWORD`, and `DB_PORT`; the application and Prisma commands convert them to a connection URL without logging credentials.

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
config/                  env config, centralized Prisma Client + shared copy constants
controllers/, routes/    thin controllers, one per area (auth / learner / admin)
prisma/schema.prisma     introspected PostgreSQL schema and Prisma Client generator
scripts/prisma.js        Prisma CLI wrapper for DATABASE_URL and legacy DB_* settings
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

## Prisma and PostgreSQL

The project uses Prisma 6.19.0 with the PostgreSQL datasource and the `prisma-client-js` generator. The schema in `prisma/schema.prisma` was introspected from the existing database; it represents all 28 current public tables, enums, UUIDs, JSON/array/network fields, indexes, unique constraints, and foreign-key relationships. No user-defined public triggers were found. The four existing database check constraints (`academic_year_dates_valid`, `plan_price_valid`, `subscription_dates_valid`, and `trial_dates_valid`) are not expressible in Prisma Schema Language, so they are preserved in the checked-in baseline SQL.

Set `DATABASE_URL` in `.env`, for example:

```dotenv
DATABASE_URL=postgresql://user:password@localhost:5432/mbl-ai?schema=public
```

URL-encode reserved characters in the username and password. For an existing `.env` using `DB_USER`, `DB_HOST`, `DB_NAME`, `DB_PASSWORD`, and `DB_PORT`, these values remain supported without a credential change; `config/databaseUrl.js` builds the URL at runtime. `.env` is ignored by Git; `.env.example` contains placeholders only.

Useful commands:

```bash
npm run prisma:validate
npm run prisma:generate
npm run prisma:db:pull
npm run prisma:migrate:status
npm run prisma:migrate:diff -- --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script
npm run prisma:migrate:dev
npm run prisma:migrate:deploy
```

Prisma Client is centralized in `config/db.js`, connected before the HTTP server starts, and disconnected during graceful shutdown. Transactions use Prisma `$transaction`; the application-application lookup retains its `FOR UPDATE` lock using a parameterized `$queryRaw`.

### Existing database and migrations

The current database was pre-existing and contains its own `schema_migrations` table. It was not previously managed by Prisma Migrate.

The checked-in `prisma/migrations/20261021110000_baseline_existing_database/migration.sql` is a generated baseline, including the four existing check constraints. It creates the current schema from empty; it is not safe to execute against the existing database. The live database was verified against the Prisma schema with an empty drift diff, then baselined using `migrate resolve --applied 20261021110000_baseline_existing_database`. This added Prisma migration-history bookkeeping only; it did not execute baseline DDL or change application records. The existing application `schema_migrations` table is separate from Prisma's `_prisma_migrations` history; both are preserved.

Create and review development migrations against a disposable/local database. Back up production and review generated SQL before applying changes with `npm run prisma:migrate:deploy`. Do not run `migrate reset` or `db push` against a database containing data. No schema DDL was applied to the existing database as part of this change.

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
