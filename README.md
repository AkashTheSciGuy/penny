# Penny — personal expense tracker

A responsive expense tracker built with React, TypeScript, Vinext, and Supabase. Open this folder in VS Code.

## Run locally

Requires Node.js 22.13+ and npm.

```sh
npm install
npm run dev
```

Open the local URL printed by the development server. Without Supabase environment variables, the app shows clearly labeled fictional sample data. Preview edits are temporary and are never uploaded. The project is local; it has not been published.

## Connect Supabase (free plan)

1. Create a project at https://supabase.com/dashboard. Select the Free plan and keep its database password private.
2. Open **SQL Editor**, create a query, paste `supabase/migrations/001_initial.sql`, and run it once. This creates transactions and budgets, their constraints, indexes, and ownership policies.
3. Open the project's **Connect** dialog / API settings. Copy the project URL and **publishable** key (a legacy `anon` key also works). Never use a secret or service-role key in this app.
4. Copy `.env.example` to `.env.local`, then fill in:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

5. In **Authentication → URL Configuration**, set the Site URL to the exact local app URL and add that URL with `/?reset=1` to allowed redirect URLs. Add your HTTPS production origin and password-reset redirect before deploying.
6. Keep email confirmation enabled. Configure an email provider in Supabase for production delivery and set a strong password policy and rate limits. New passwords entered through this app require at least 12 characters.
7. Restart the development server. Use **Sign in / Create account**, confirm your email, and sign in. Real accounts start empty.

Official references: https://supabase.com/docs/guides/getting-started/api-keys and https://supabase.com/docs/guides/database/postgres/row-level-security

## Features

- Monthly income, expenses, net balance, savings rate, weekly cash-flow chart, category breakdown.
- Create, edit, and delete transactions with date, category, payment account, and notes.
- Search and filter by month, category, and income/expense.
- Per-category monthly budgets, remaining limits, and over-budget indicators.
- Reports with accessible numeric weekly totals and category amounts.
- CSV export of the current filtered transactions, with spreadsheet-formula escaping.
- Email/password accounts, email confirmation, password reset, and sign-out through Supabase.
- Responsive layouts, keyboard-accessible dialogs, form validation, loading and failure states.

## Data model and security

`transactions`: UUID id and owner, nonempty title (120 characters maximum), positive integer minor-unit amount, income/expense type, allowlisted category and account, date, notes (1,000 characters maximum), creation timestamp.

`budgets`: UUID id and owner, allowlisted category, positive integer minor-unit amount, YYYY-MM month; one budget per owner/category/month.

All reads and writes go through the Supabase SDK using the signed-in session. PostgreSQL RLS enforces ownership for select, insert, update, and delete. Anonymous roles have no table access. Owner changes to another user fail the write policy. Numeric values are integer minor units to avoid floating-point rounding. React escapes text; no raw HTML insertion is used. Private environment files are ignored by Git. Publishable keys are intentionally public; RLS is the security boundary. No service-role credentials are needed.

Mutations await database success before updating the UI. Failed form saves preserve input. Load failures are shown with a reload instruction. Paginated queries avoid Supabase's usual 1,000-record response cap. The UI aggregates loaded records, suitable for personal use; very large histories should move reporting to paginated server-side aggregates.

Currency is a device-local display preference, not an exchange-rate conversion. Use one currency for all records. Amounts currently use two decimal places, including display currencies that conventionally have other minor-unit rules. The monthly balance is income minus expenses, not a bank balance. Budgets are monthly and do not automatically roll over. Bank syncing, attachments, recurring schedules, CSV import, and custom categories are not implemented.

## Project map

- `app/page.tsx`: interactive application and Supabase CRUD/auth flows.
- `app/globals.css`: responsive visual design.
- `lib/finance.ts`: amount parsing, totals, CSV formatting, fictional preview data.
- `lib/supabase.ts`: public SDK configuration.
- `supabase/migrations/001_initial.sql`: database constraints and access policies.
- `tests/finance.test.ts`: monetary edge cases, CSV safety, aggregation stress coverage.

## Checks

```sh
node --experimental-strip-types --test tests/finance.test.ts
npx tsc --noEmit
npm run build
```

Before using real financial records, apply the migration and test with two Supabase accounts: each must see only its own records; attempts to read/update/delete the other owner's UUID or insert with the other owner must fail. These live integration checks require your project and were not run against an actual Supabase database here.

## Deployment

Keep `.env.local` private. Configure the two public environment variables in the hosting build environment, apply the migration, build, and configure Supabase redirect URLs for your final HTTPS origin. This starter targets a Cloudflare-compatible Worker through Vinext; the build produces `dist/server` and `dist/client`. See the existing build scripts for deployment packaging. Supabase remains the database and authentication provider. Never publish the development server directly.

Back up/export financial data regularly. Free-tier quotas and inactivity behavior are managed by Supabase; review the current plan in your dashboard. No paid Supabase feature is required by this app.

## Guided tour and motion

New visitors see a seven-step introduction covering the overview, adding transactions, search and export, budgets, reports, and account setup. Next/Back navigate actual views and highlight the relevant controls. Escape, close, and Skip dismiss the tour. Completion or dismissal is remembered on this browser using the versioned `penny-tour-v1` preference; no financial data is stored with it. Replay from Settings → Replay guided tour. Password recovery links do not auto-open the tour. If browser storage is unavailable, the tour still works for the current visit.

The isolated `components/penny/user-tour.tsx` component owns onboarding. CSS provides staggered card entrances, chart growth, dialog entrances, button feedback, and view transitions, using opacity and transforms. All animation and transitions are disabled for the system's reduced-motion preference. The tour uses a native modal dialog for keyboard focus containment and responsive positioning.

## Appearance

Use the light/dark switch below the Penny logo or in Settings → Preferences. The preference is saved on this browser as `penny-theme` and is applied before the page hydrates to avoid a light flash. Both themes cover dialogs, onboarding, charts, tables, and forms. The switch supports keyboard activation and exposes its current state to screen readers.
