# Sublimation Portal

Job tracking portal for a Malaysian dye-sublimation print shop: order → design → template → printing → cutting & sewing → QC → collection, with payment status controlling release of goods. Staff portal plus a no-login customer tracking page. English and Bahasa Malaysia.

**Status: Phase 2 of 9.**
- Phase 1 (done): business rules + tests, schema + RLS, auth, role-aware layout, EN/BM toggle, My Queue, Settings.
- Phase 2 (done): customers (Malaysian phone normalisation), quotations with line items / add-ons / rush fee / configurable tax / quantity price tiers, quotation → job sheet with `SB-YYMM-0001` numbering, attachments, A4 job sheet PDF with QR (`/api/jobs/{id}/pdf`).
- Next: Phase 3, the workflow engine (stage transitions with guards, kanban, QR scan screen).

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
4. `supabase/seed.sql` (demo shop, stages, fabrics, garment types, 4 customers, 10 jobs)

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
- **RLS on every table.** Production roles see only jobs in their section; payments are admin (and dispatch read-only). Customers never touch the database directly: the public tracking page runs server-side with the service-role key, looked up by an unguessable token.
- Dates use Asia/Kuala_Lumpur, currency MYR, phones in E.164.
