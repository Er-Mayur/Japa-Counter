Supabase setup for this project

This document explains how to connect this client repo to a Supabase project (client's account), push the existing migrations, and configure auth / redirect URLs.

Prerequisites
- Install Supabase CLI (macOS):
  - `brew install supabase/tap/supabase`
  - or: `npm i -g supabase`
- Have access to the client's Supabase project (Project ref and Project API keys) via the Supabase Dashboard or an admin user.

Quick overview (steps)
1. Login with Supabase CLI
2. Link the local repo to the client's project (or update `supabase/config.toml`)
3. Backup the remote DB (Dashboard)
4. Push migrations from `supabase/migrations`
5. Add env vars locally and in production (Vite uses `VITE_` prefix)
6. Configure Authentication redirect URLs and allowed origins
7. Test locally and on staging

Detailed steps

1) Login with Supabase CLI

```bash
supabase login
```
This opens a browser for authentication.

2) Link the repo to the client's project

Preferred (CLI):

```bash
# replace with the client's project ref (the short id visible in the Dashboard URL)
supabase link --project-ref <PROJECT_REF>
```

If `supabase link` is not available, you can manually set the `project_id` in [supabase/config.toml](supabase/config.toml#L1).

Note: this repo already has a `project_id` value in [supabase/config.toml](supabase/config.toml#L1).

3) Backup the remote DB (do this before applying migrations to production)

- Use the Supabase Dashboard → Database → Backups → Create new backup (recommended)
- Or export data with `pg_dump` if you have a DB connection string

4) Push migrations to the client's project

If the repo is linked to the project (step 2), run:

```bash
supabase db push
```

If not linked, provide `--project-ref`:

```bash
supabase db push --project-ref <PROJECT_REF>
```

Notes:
- Review the SQL files in `supabase/migrations/` first. See the migration files in the repo.
- If `supabase db push` fails (e.g. missing extensions), apply the problematic migration SQL manually via the SQL editor in the Dashboard.

5) Configure environment variables (Vite)

Create a local env file (do not commit secrets): `.env.local`

```
VITE_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
VITE_SUPABASE_ANON_KEY=<ANON_KEY>
```

- Vite exposes these variables as `import.meta.env.VITE_SUPABASE_URL` and `import.meta.env.VITE_SUPABASE_ANON_KEY`.
- This repo's Supabase client is in [src/integrations/supabase/client.ts](src/integrations/supabase/client.ts#L1-L20) and will use `VITE_` env vars if present.

Production / Vercel:
- Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in your Vercel project settings → Environment Variables for Production/Preview/Development.

Security note:
- The ANON key is public-facing (used on clients). Do NOT commit the service role key into client code. Service-role keys should be stored only on server-side or in CI and used by server functions.

6) Add Redirect URLs and Allowed Origins (Auth settings)

Open the Supabase Dashboard → Authentication → Settings
- Redirect URLs: add your app redirect URIs. Examples:
  - `http://localhost:5173` (Vite dev)
  - `https://your-production-domain.com` (production)
  - For Capacitor mobile builds add: `capacitor://localhost` and `http://localhost`
- Additional Allowed Origins / Site URL: set your production origin (e.g. `https://your-production-domain.com`)

7) Test the app

- Start locally:

```bash
# install deps if needed
npm install
npm run dev
```

- Test sign-in / redirect flows (web + mobile if applicable). Verify tables and functions created by migrations in Dashboard → Table Editor or SQL editor.

Appendix: repo hints
- The project contains generated TypeScript DB types at [src/integrations/supabase/types.ts](src/integrations/supabase/types.ts)
- The generated client currently has fallback hard-coded values but will prefer `VITE_` env vars: [src/integrations/supabase/client.ts](src/integrations/supabase/client.ts#L1-L20)
- Migrations live in `supabase/migrations/` — review them before pushing to production.

If you want, I can:
- Replace the generated client with a small wrapper that always reads from env vars.
- Run the `supabase db push` steps locally (you'll need to supply the client's project ref and allow the CLI to login in your environment).

