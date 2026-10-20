# Sublimation Portal

Job tracking portal for a Malaysian dye-sublimation print shop: order → design → template → printing → cutting & sewing → QC → collection, with payment status controlling release of goods. Staff portal plus a no-login customer tracking page. English and Bahasa Malaysia.

**Status: Phase 4 of 9.**
- Phase 1 (done): business rules + tests, schema + RLS, auth, role-aware layout, EN/BM toggle, My Queue, Settings.
- Phase 2 (done): customers (Malaysian phone normalisation), quotations with line items / add-ons / rush fee / configurable tax / quantity price tiers, quotation → job sheet with `SB-YYMM-0001` numbering, attachments, A4 job sheet PDF with QR (`/api/jobs/{id}/pdf`).
- Phase 3 (done): workflow engine. Every stage change goes through one server path (`src/lib/workflow/perform.ts` -> rules in `src/lib/rules/workflow.ts` -> DB function `apply_transition`), with one-tap stage buttons, hold/cancel/waiver/override reasons, photo + note, job timeline, My Queue sorted by urgency, kanban board with filters and drag-to-move, live updates, in-app notifications.
- Sections (done): work belongs to sections, not to one admin. Each section's staff move their own jobs and hand them to the next section ("Send to Printing & Press", "Send to Cutting & Sewing"); confirmed jobs land in the designers' queue. Staff can claim a job ("I'll take this job"), and the Owner manages staff per section at Settings → Team.
- Phase 4 (done): designers upload versioned mockups and send them to the customer; the customer approves (typed name + confirmation, IP logged) or requests changes (comment + picture) on the public `/track/{token}` page; approval locks the design and opens the name-list step automatically; only the Owner can unlock, with a reason. Free-revision count is configurable.
- Next: Phase 5, name & size list (customer grid with paste/CSV, admin entry on their behalf, validation, size totals).

Stack: Next.js (App Router) · TypeScript · Tailwind · Supabase (Postgres, Auth, Storage, Realtime) · next-intl · Zod · Vercel.

## 1. Run locally

```bash
npm install
npm test            # business rules (stage guards, payment status)
npm run typecheck
npm run lint
npm run build
```

Without Supabase configured the app still starts and shows a "Supabase is not connected" page.

## 2. Create a Supabase project

1. Sign up at https://supabase.com (free plan is enough to start) and create a new project. Pick the Singapore region (closest to Malaysia). Save the database password.
2. **Project Settings → API**: copy the Project URL, the `anon` key and the `service_role` key.
3. Copy `.env.example` to `.env.local` and fill it in. `.env.local` is git-ignored. **Never** put the service-role key in a `NEXT_PUBLIC_` variable or commit it.

## 3. Apply migrations and seed

In the Supabase dashboard open **SQL Editor** and run, in order, the full contents of:

1. `supabase/migrations/0001_schema.sql`
2. `supabase/migrations/0002_rls.sql`
3. `supabase/migrations/0003_quotes_jobs.sql`
4. `supabase/migrations/0004_workflow.sql`
5. `supabase/migrations/0005_sections.sql`
6. `supabase/migrations/0006_design.sql`
7. `supabase/seed.sql` (demo shop, stages, fabrics, garment types, 4 customers, 10 jobs)

(Or with the Supabase CLI: `supabase link` then `supabase db push`.)

## 4. Create your first users

1. **Authentication → Users → Add user**: add your email + password (tick "Auto confirm user").
2. Copy the new user's UUID, then in the SQL Editor:

```sql
insert into profiles (id, shop_id, full_name, role)
values ('<USER-UUID>', '00000000-0000-0000-0000-000000000001', 'Your Name', 'super_admin');
```

Other roles: `admin`, `designer`, `template`, `printing`, `cutting_sewing`, `qc`, `dispatch`. A user with no profile cannot see any data.

3. `npm run dev`, open http://localhost:3000 and log in.

## 5. Deploy to Vercel

1. Push this repo to GitHub, then **Add New → Project** on https://vercel.com and import it.
2. Add the four variables from `.env.example` under **Settings → Environment Variables**.
3. Deploy. In Supabase **Authentication → URL Configuration** set the Site URL to your Vercel domain.

## Architecture notes

- **Business rules live in one place:** `src/lib/rules/` (`workflow.ts` state machine and guards, `payments.ts` payment status and green/amber/red release logic). Pure functions with unit tests; UI and server actions call them and never re-implement them.
- **Money** is integer sen in code and `numeric(12,2)` in Postgres. Payment status is computed from verified payments only, never set by hand. `DEPOSIT_PAID` = paid ≥ deposit and < total; `PARTIALLY_PAID` = some money in but under the deposit.
- **Stages are data** (`stages` table), so a shop can disable e.g. cutting if merged with sewing. The default flow is seeded.
- **Stage changes are server-only.** Users cannot update `stage_key` or the guard flags (`design_approved`, `name_list_confirmed`, `deposit_waived`) or write timeline events directly; migration 0004 revokes that. The app checks the rules, then calls `apply_transition` with the service-role key, so `SUPABASE_SERVICE_ROLE_KEY` is required on the server.
- **RLS on every table.** Production roles see only jobs in their section; payments are admin (and dispatch read-only). Customers never touch the database directly: the public tracking page runs server-side with the service-role key, looked up by an unguessable token.
- Dates use Asia/Kuala_Lumpur, currency MYR, phones in E.164.
