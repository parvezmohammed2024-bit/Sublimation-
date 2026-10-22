# Sublimation Job Tracker

Job tracking for a sublimation print shop, from job sheet to collection.

**Flow:** Admin (job sheet + mockup) → customer approves the artwork online → **Template & Printing** team → **Heat Press & QC** team → **Ready for collection** (green only when fully paid) → Delivered.

- **Customers** track by number at `/track/SB-YYMM-XXXX`, approve the mockup or ask for changes (with their phone number), see live progress and their balance. Regular customers see all their jobs at `/my` with phone + 4-digit code.
- **Teams** sign in at `/team/login` with mobile + PIN (first PIN = last 4 digits of the mobile). Printing logs printed pieces; Heat Press & QC logs pressed, QC pass and QC rejects with a reason. Rejects send a reprint request back to Printing automatically. Teams never see prices.
- **Admin** at `/admin`: job sheets with sizes, name/number list and mockups, approval, payments, delivery, workers and customer codes. A job with a balance can't be marked delivered unless the admin ticks "deliver anyway".

## Setup

1. **Database (once):** open the Supabase SQL editor for project `adbpuppyrlzigahtxpau` (same project as StitchPay and the KG tracker), paste `supabase/001_subli_setup.sql` and run it. It only creates `subli_` tables and functions plus a public `subli-artwork` image bucket, and makes the KG tracker admins admins here too. Safe to run again.
2. **Vercel env vars:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (anon key only), optional `VITE_CONTACT_WHATSAPP` (e.g. `60123456789`) and `VITE_BUSINESS_NAME`.
3. Add workers in Admin → Workers.

## Develop

```bash
npm ci
cp .env.example .env.local   # fill in the anon key
npm run dev
```

Stack: React 19, Vite, Tailwind 4, Supabase. English and Bahasa Malaysia, light and dark.
