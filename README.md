# HOT DOOGY Careers

Public job-application site for Hot Doogy (Sherwood Plaza and Natick Mall, Natick MA). Hosted on its own subdomain (for example `careers.hotdoogy.com`); applications are reviewed by management inside **HOT DOOGY Operations → Team → Careers**.

## How it fits together

```
candidate ──▶ careers site (this repo, static Vite build)
                │  multipart POST
                ▼
         Edge Function careers-submit  (JWT verification off; uses the service role)
                │  rpc careers_submit / careers_attach_file · Storage upload
                ▼
   Supabase project "Restaurant Management" (kfnsfnytnnpwptklmbip)
     public.careers_applications · _files · _notes · _events · _submission_throttle
     storage bucket careers-uploads (private, 5 MB, PDF/JPG/PNG)
                ▲
                │  RLS: owner/admin + MFA · rpc careers_review
   HOT DOOGY Operations → Team → Careers (server/careers.mjs, src/careers-ui.js)
```

- The browser never receives a Supabase key and never touches a table: it only calls the Edge Function.
- `careers_submit` validates the payload, throttles to 5 applications per network per hour, blocks duplicates (same e-mail and position within 24 h), allocates a reference (`HD-XXXXXX`) and writes the audit event.
- Files are content-sniffed (PDF/JPEG/PNG magic bytes), hashed (SHA-256) and stored under `{organization}/{application}/{kind}-{random}.{ext}`.
- Management reads under RLS (`careers_*_read`), downloads files through the Operations server with the user's own session, and changes status / rating / notes through `careers_review` (optimistic locking by `version`).

## Development

```bash
npm install
npm run dev        # http://127.0.0.1:5174
npm run build      # static output in dist/
```

Copy `.env.example` to `.env` if the Supabase project URL ever changes. No secrets live in this repository.

## Deploying the site

Any static host works (Cloudflare Pages, Netlify, Vercel, S3). Build with `npm run build` and serve `dist/` from the careers subdomain. Then set the Edge Function secret so only that origin may post:

```bash
supabase secrets set CAREERS_ALLOWED_ORIGINS=https://careers.hotdoogy.com --project-ref kfnsfnytnnpwptklmbip
```

Optional: `CAREERS_IP_SALT` (random string) salts the hashed network address used for throttling; when unset the function derives the salt from the service-role secret, so hashes are never reversible with a public value.

## Database and function source

- `supabase/migrations/20261016132000_careers_applications.sql` — applied to the project on 2026-10-16 via the Supabase connector. The same file is committed in the Operations repository (`app/supabase/migrations/`) because the Careers page depends on it.
- `supabase/functions/careers-submit/index.ts` — deployed on 2026-10-16 with `verify_jwt=false`. Redeploy with `supabase functions deploy careers-submit --no-verify-jwt`.

## Privacy

Applications contain personal data. Only owner/admin accounts with MFA can read them; events are append-only; the throttle table keeps a salted hash of the network address for two days. Correction or deletion requests: thi.andrade@hotdoogy.com.
