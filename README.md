# MBL-AI LMS

Express + EJS app for the MBL-AI learner and admin screens, per `docs/MBL_AI_LMS_Consolidated_PRD_v0.6.md`.
Google OAuth identifies learners and stores their identity in PostgreSQL. Learners submit a phone number and both policy consents before their application enters the admin approval queue. Razorpay checkout uses database-backed plans and records verified payments and subscriptions in PostgreSQL.

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
The login page offers a Google sign-in button. New applicants go to `/apply`; existing accounts follow their database role and account state. Configure `DATABASE_URL` for PostgreSQL. Existing installations can continue to use `DB_USER`, `DB_HOST`, `DB_NAME`, `DB_PASSWORD`, and `DB_PORT`; the application and Prisma commands convert them to a connection URL without logging credentials.

## Application features

- Google OAuth, application and consent capture, administrator approvals, trial expiry,
  role-based access, and learner/admin dashboards.
- Database-backed courses, published assessments, weekly and monthly attempts, answer
  autosave, objective scoring, persistent timers, and server-side expiry.
- Database-backed payment plans and payment history, Razorpay order/signature checks,
  webhook-driven subscription activation, and opt-in leaderboard scores.
- Release import, preview, publication, revision notes, and audit history.
- Subjective answers are persisted and shown as pending. This repository does not currently
  contain a Gemini evaluation worker or service; installing the Gemini SDK alone does not
  evaluate answers.

## Project layout

```
app.js, server.js        Express app and entry point
config/                  env config, centralized Prisma Client + shared copy constants
controllers/, routes/    thin controllers, one per area (auth / learner / admin)
prisma/schema.prisma     introspected PostgreSQL schema and Prisma Client generator
scripts/prisma.js        Prisma CLI wrapper for DATABASE_URL and legacy DB_* settings
services/
  lmsDataService.js      maps Prisma-backed records for learner and admin views
  examService.js         attempt persistence, scoring coordination, and expiry
  paymentService.js      Razorpay orders, verification, and subscription activation
  format.js, icons.js, markdown.js   view helpers (fmt, icon, safe note renderer)
middleware/
  viewContext.js         supplies shared template locals from the current request
views/                   EJS templates (layouts/, partials/, auth/, learner/, admin/, errors/)
public/                  css/, js/, images/ — served statically
```

## Prisma and PostgreSQL

The project uses Prisma 6.19.0 with the PostgreSQL datasource and the `prisma-client-js` generator. The schema in `prisma/schema.prisma` models the existing public tables and adds an additive payment webhook event table. No user-defined public triggers were found. The four existing database check constraints (`academic_year_dates_valid`, `plan_price_valid`, `subscription_dates_valid`, and `trial_dates_valid`) are not expressible in Prisma Schema Language, so they are preserved in the checked-in baseline SQL.

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

## Razorpay test payments

Set these backend-only values in the project-root `.env` (do not put secret values in frontend code). Replace every example value with credentials from your Razorpay Test Mode account; the placeholders do not work:

```dotenv
RAZORPAY_KEY_ID=your_test_key_id
RAZORPAY_KEY_SECRET=your_test_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
```

Use the test key ID and key secret from Razorpay's Test Mode. In the Razorpay Dashboard,
create a webhook pointing to `https://<your-public-host>/api/payments/webhook`, configure
the same webhook secret in `RAZORPAY_WEBHOOK_SECRET`, and subscribe to `payment.captured`
and `payment.failed`. For local testing, expose the local server with a trusted HTTPS
tunnel and configure that public tunnel URL as the webhook URL. Keep all three values in
the server environment; only the key ID is returned to the browser for Checkout. The key
ID and key secret must be a matching pair from the same Razorpay mode/account. Restart the
Node server after changing `.env` so the credentials are loaded. Order creation requests
use a client-generated idempotency key, so retrying the same request reuses the same
Razorpay order instead of creating another one.

The Account page reads active plans and prices from PostgreSQL. The existing `annual` and
`completion` plan rows are ₹20,000 for one year and ₹35,000 for five years. Create orders
from the Buy buttons in Razorpay Test Mode. After validating the Checkout signature, the
server asks Razorpay for the payment status and activates access only after confirming the
captured amount, currency, and order. The `payment.captured` webhook remains enabled as a
reliable fallback and retry path; its event ID is stored uniquely to make retries safe.
Reopening the Account page also reconciles earlier authorized checkouts, so a missed
webhook does not require the learner to pay again.

Apply the safe additive migration before starting the payment flow:

```bash
npm run prisma:migrate:deploy
npm run prisma:generate
```

The migration adds payment-plan/payment-date columns and a webhook-event deduplication
table. It preserves existing payment, subscription, plan, and user records.

## Known issues / incomplete by design

- Leaderboard join/withdraw controls and settings edits are not yet persisted; rankings
  themselves now read only opted-in database scores.
- Subjective answer evaluation is not implemented. Submitted written answers remain pending
  rather than receiving fabricated marks.
- Notification storage has no read/unread field or notification-generation worker, so the
  application displays persisted notification records without inventing demo alerts.
