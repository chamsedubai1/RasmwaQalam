# Deploying to Hostinger Cloud Hosting

This walkthrough takes you from a fresh Cloud Hosting plan + domain to a
running production deployment. ~30–45 minutes the first time.

## What you need before starting

- A **Hostinger Cloud Hosting Premium** plan or higher (Startup tier does
  NOT include the Node.js App feature).
- A domain on the same Hostinger account (or any registrar — DNS works either
  way).
- A free **Neon** account at https://console.neon.tech for PostgreSQL
  (the platform's Drizzle config targets Neon's serverless driver).
- An **Anthropic API key** at https://console.anthropic.com — without this,
  every AI endpoint returns 503 (this is intentional: the moderation gate
  is non-bypassable for student safety).
- Optional: OpenAI, Stability, Hugging Face, Qwen keys for the AI fallback
  chain.

## What you'll lose vs. running on a VPS

Cloud Hosting cannot run Redis, so on this host:

- The Bull-based **AI queue** runs in-process with a concurrency cap of 4.
  No retries on upstream provider failures, no cross-instance coordination.
  Fine for a single-instance school-scale deployment.
- **Rate limiters** are in-memory. If the app gets restarted (which Hostinger
  does periodically), counters reset. Login brute-force protection still
  works within a single instance lifetime.
- **WebSocket** *should* work through Hostinger's LiteSpeed proxy, but if it
  doesn't, the app degrades to no-realtime — users see updates on page
  refresh. Test this last (step 12).

---

## Step 1 — Provision the database (Neon)

1. Sign in at https://console.neon.tech.
2. Create a new project. Region: choose one geographically close to your
   Hostinger data center (Europe for Hostinger EU plans).
3. From the dashboard copy the **pooled connection string** — it looks like:

   ```
   postgresql://user:pwd@ep-xxxx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

4. Save this — it becomes `DATABASE_URL`.

## Step 2 — Apply the schema

On your local machine (where this repo lives):

```sh
DATABASE_URL='<the connection string from step 1>' npm run db:push
```

`drizzle-kit push` creates every table including the new `password_changed_at`
column added by the recent security fixes. You should see "No changes" or a
list of created tables. Done.

## Step 3 — Build the production bundle locally

```sh
npm install                                  # install all deps
npm run build                                # produces dist/index.js + dist/public/*
```

After this completes, you have:

- `dist/index.js` — the bundled server entry point
- `dist/public/` — the static client (React build)

## Step 4 — Create the deploy archive

Hostinger uploads are easiest as a single archive. Include everything the
runtime needs, exclude what it does NOT:

```sh
# from the repo root
mkdir -p deploy/build
cp -r dist                deploy/build/dist
cp -r shared              deploy/build/shared
cp    package.json        deploy/build/
cp    package-lock.json   deploy/build/
cp    drizzle.config.ts   deploy/build/
# ship empty uploads dir so the app does not have to mkdir
mkdir -p deploy/build/uploads

cd deploy/build && tar -czvf ../hostinger-deploy.tar.gz .
```

You now have `deploy/hostinger-deploy.tar.gz`. That's what you upload.

## Step 5 — Set up the Node.js App in hPanel

1. Log into https://hpanel.hostinger.com.
2. Pick your hosting plan → **Advanced → Setup Node.js App**.
3. Click **Create Application**:
   - **Node.js version**: 20.x (must be 18+; 20 matches our development
     environment).
   - **Application mode**: Production
   - **Application root**: `domains/<yourdomain.com>/app` (Hostinger will
     create the folder; pick any name)
   - **Application URL**: pick the subdomain or `<yourdomain.com>` root
   - **Application startup file**: `dist/index.js`
   - Leave Passenger log file at default
4. Click **Create**.

Hostinger creates the directory and shows you the application details. Note
the **virtual env activation command** at the top — looks like:
`source /home/u123456789/nodevenv/.../activate && cd /home/u123456789/domains/...`

## Step 6 — Upload the build

Two options:

### Option A — File Manager (simpler)

1. hPanel → **Files → File Manager**.
2. Navigate to `domains/<yourdomain.com>/app`.
3. Click **Upload** → upload `hostinger-deploy.tar.gz`.
4. Right-click the archive → **Extract**. After extraction, delete the
   archive.

### Option B — FTP (faster for re-deploys)

1. hPanel → **Files → FTP Accounts**. Note the host/user/password.
2. Use FileZilla or `scp` to upload the extracted build contents into the
   application root.

## Step 7 — Configure environment variables

1. Open your Node.js App in hPanel.
2. Scroll to **Environment Variables**.
3. Open `.env.production.example` from this repo as a reference. Add each
   non-empty variable as a key/value:

   | Key | How to fill |
   |---|---|
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | Neon pooled connection string from step 1 |
   | `JWT_SECRET` | Run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and paste |
   | `JWT_REFRESH_SECRET` | Same command, **different value** |
   | `SESSION_SECRET` | Same command, **different value** |
   | `AUDIT_LOG_HMAC_SECRET` | Same command, **different value** |
   | `DOWNLOAD_SIGNING_SECRET` | Same command, **different value** |
   | `ANTHROPIC_API_KEY` | From console.anthropic.com |
   | `ALLOWED_ORIGINS` | `https://yourdomain.com,https://www.yourdomain.com` |
   | (optional) `OPENAI_API_KEY`, `STABILITY_API_KEY`, `HUGGING_FACE_API_KEY`, `QWEN_API_KEY` | If using those fallback providers |

   Important:
   - Do NOT set `PORT` — Passenger injects it.
   - Do NOT set `REDIS_URL` — Redis is unavailable, the app uses its in-process fallback.
   - All five secret values MUST be different. Reusing them defeats the per-purpose key separation added by the security audit.

4. Click **Save**.

## Step 8 — Install runtime dependencies

In the Node.js App panel:

1. Find the **Run NPM Install** button. Click it.
2. Wait for the log to show "added N packages". This usually takes 1–3
   minutes. If it fails with "out of memory" — that's a known Cloud
   Hosting issue with native dep compilation; try **Run NPM Install** again,
   or remove devDependencies before uploading (see "Slimming the deploy"
   below).
3. (Optional) After install, run `npm prune --production` via the panel's
   shell-equivalent button if available, to remove dev deps and free disk.

## Step 9 — Start the app

In the Node.js App panel: click **Restart** (or **Start** if first time).

Open the Application URL in your browser. You should see the landing page.
If you see a 503 from Passenger, check the **Passenger log file** path
shown at the top of the panel — most first-time failures are missing env
vars (the app exits with a clear message naming the missing key).

## Step 10 — Point your domain

If the domain is **registered with Hostinger AND on the same hosting plan**,
DNS is already configured — skip to step 11.

If the domain is on Hostinger but on a **different** hosting plan (or
external), set these DNS records via hPanel → **Domains → DNS Zone Editor**:

| Type | Name | Value | TTL |
|---|---|---|---|
| A | @ | (your Cloud Hosting IP — shown in hPanel home page) | 14400 |
| A | www | (same IP) | 14400 |

DNS propagation: usually 5–60 minutes, occasionally up to 24 h.

## Step 11 — Enable HTTPS

1. hPanel → **Security → SSL**.
2. For your domain, click **Setup → Free SSL** (Let's Encrypt).
3. Wait ~5 minutes for issuance.
4. Once active, toggle **Force HTTPS** to on. The `Strict-Transport-Security`
   header the app sets in production will then be enforced.

## Step 12 — Sanity test

1. Open `https://yourdomain.com/api/auth/captcha` — should return JSON with
   an SVG image (proves the Node server and DB are reachable).
2. Register a test user. If you get past CAPTCHA, the moderation gate is
   live.
3. Try logging in. Watch the Passenger log for `[AUDIT] LOGIN_SUCCESS`.
4. Open the browser dev tools Network tab → switch to the WS tab. Navigate
   to a page that subscribes (any logged-in page). You should see a
   WebSocket connection upgrade to `/ws`. If it stays 101 Switching
   Protocols — WS works. If it fails with 502 or never upgrades —
   Hostinger's LiteSpeed proxy is not passing WS. The app still works,
   just without realtime updates.

## Re-deploying after code changes

1. Locally: `npm run build`
2. Re-create the tarball (step 4) and upload to overwrite `dist/`.
3. In hPanel Node.js App panel: click **Restart**.

That's it. `node_modules` does not need to be re-installed unless
`package.json` changed.

## Common failures and fixes

| Symptom | Cause | Fix |
|---|---|---|
| 503 on every page | App didn't start | Check Passenger log; usually a missing env var or DB connection failure |
| Login returns 500 | DB unreachable | Verify `DATABASE_URL` in env, and that Neon is not paused (free tier auto-pauses after inactivity, takes ~1 s to wake) |
| CSP blocks all images | Production CSP is strict — `img-src 'self' data: blob:` | If you serve images from a CDN, add the CDN host to `img-src` in `server/index.ts:80` |
| `[AUDIT] integrity check FAILED` in logs | `AUDIT_LOG_HMAC_SECRET` changed between deploys | Past audit rows can no longer be verified. Rotate carefully; never change this secret in place |
| AI endpoints return 503 | `ANTHROPIC_API_KEY` missing | This is the moderation gate, it is intentional. Set the key |

## Slimming the deploy (optional)

If Hostinger's NPM install runs out of memory, build a `node_modules` archive
locally and ship it pre-installed:

```sh
cd deploy/build
npm install --omit=dev --omit=optional
tar -czvf ../hostinger-deploy.tar.gz . node_modules/
```

Then on Hostinger you do NOT click "Run NPM Install".

## Security checklist (production)

Before sharing the URL widely:

- [ ] All 5 cryptographic secrets are distinct, 32+ chars each
- [ ] `ALLOWED_ORIGINS` lists ONLY your real domain(s) — no `*`
- [ ] `Force HTTPS` is on
- [ ] `ANTHROPIC_API_KEY` is set (moderation gate active)
- [ ] You created an `admin` user manually in the DB (the registration
      endpoint only allows `student` / `teacher` / `schoolAdmin`)
- [ ] Test login → access a teacher-only route → confirm 403 if not authorized
