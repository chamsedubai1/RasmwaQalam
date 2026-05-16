# Render.com — Step-by-step deploy (non-developer guide)

This is the path for someone who has only a Hostinger domain (no Hostinger hosting) and wants the platform live with the least friction. Total time: about **45 minutes** the first time.

You will not type any commands except **one** in Replit's Shell (to set up the database). Everything else is clicks in a web UI.

## What this gets you

- Full Node.js 20 server, every feature working (including WebSocket)
- Automatic HTTPS on your domain (free)
- Auto-redeploys whenever you push code from Replit
- Persistent uploaded images that survive restarts (with the optional disk)
- A clean dashboard with logs and metrics

## What you need before starting

- A **credit card** (Render requires one for paid plans; the free tier doesn't need it but isn't suitable for production use)
- A **GitHub account** — sign up free at https://github.com if you don't have one
- A free **Neon** account for the database — https://console.neon.tech
- An **Anthropic API key** — https://console.anthropic.com (required for the content moderation gate)
- Your existing Hostinger account (for DNS only)

## Costs you should expect

- Render Web Service (Starter): **$7/month**
- Render Persistent Disk (1 GB for uploads): **$0.25/month**
- Neon database: **$0** (free tier is fine to start)
- Anthropic API (moderation only): **~$1/month** in real usage
- Hostinger domain renewal: whatever you pay annually divided by 12
- **Total: ~$8–10/month**

If you want to try first without paying, Render has a **Free** tier — but the service sleeps after 15 minutes of inactivity and the first request after sleep takes ~30 seconds to wake. Fine for testing, **not** for real users.

---

## Part 1 — Push your code to GitHub (10 min)

Render reads code from GitHub.

1. Open your Art Challenge Platform project on https://replit.com
2. Left sidebar → click the **Version Control** icon (a branch/fork symbol). On newer Replit it's labeled **Git**.
3. Click **Create a Git Repo** (or **Connect to GitHub** if you've used it before)
4. Choose **Create a new repository on GitHub**
5. Sign in to GitHub when prompted
6. Repository name: `art-challenge-platform` (or anything)
7. Set it to **Private**
8. Click **Create**

Wait ~30 seconds. Replit will show "All changes pushed" and a link to your GitHub repo. **Open that link** to confirm the code is there.

> Anytime you change code in Replit later, come back to this Version Control panel and click **Commit & push** to send updates to GitHub. Render will automatically rebuild and redeploy when it sees the push.

---

## Part 2 — Create the database (Neon, 10 min)

1. Open https://console.neon.tech → **Sign up** (use Google or GitHub login)
2. Create a new project. Region: closest to your users (Europe → Frankfurt, US → Ohio, etc.). **Match this region to your Render region in Part 4** for best speed.
3. After creation, Neon shows a connection string. Make sure the toggle says **Pooled connection**.
4. Click the copy button. **Paste the connection string into a notes file** — you'll use it twice.

---

## Part 3 — Get the Anthropic API key (5 min)

Required. Without this, every AI feature returns 503 by design (student safety).

1. Open https://console.anthropic.com → sign up
2. Add a payment method (~$1/month real usage; $5 free credit on signup)
3. **API Keys** → **Create Key** → name it `render-production`
4. **Copy the key immediately** (starts with `sk-ant-`) — saved only once. Paste into your notes.

---

## Part 4 — Apply the database schema (3 min)

This is the only command you need to run. We use Replit's Shell so you don't have to install anything.

1. Open your Replit project
2. Open the **Shell** tab (bottom or right sidebar)
3. Paste this, replacing `<YOUR_NEON_URL>` with the connection string from Part 2:

   ```sh
   DATABASE_URL='<YOUR_NEON_URL>' npm run db:push
   ```

4. Press Enter. Wait ~30 seconds. You should see "No changes detected" or a list of created tables. Done.

If it errors with "MissingDependencies", run `npm install` first, then retry.

---

## Part 5 — Create a Render account (5 min)

1. Open https://render.com → click **Get Started for Free**
2. **Sign up with GitHub** (one click — it links your Render and GitHub accounts so it can read your repos)
3. After signup, you'll be asked to authorize Render to access your repos. Click **Authorize** and grant access to your `art-challenge-platform` repository.

---

## Part 6 — Create the Web Service (10 min)

1. Render dashboard → **New +** (top right) → **Web Service**
2. Choose **Build and deploy from a Git repository** → **Next**
3. Find `art-challenge-platform` in the list → click **Connect**
4. Fill in the form:

   | Field | What to enter |
   |---|---|
   | **Name** | `art-challenge` (this becomes part of your render URL, e.g. `art-challenge.onrender.com`) |
   | **Region** | Same region you picked for Neon |
   | **Branch** | `main` (or whatever Replit set as default) |
   | **Root Directory** | leave blank |
   | **Runtime** | Node |
   | **Build Command** | `npm install && npm run build` |
   | **Start Command** | `node dist/index.js` |
   | **Instance Type** | **Starter ($7/mo)** — do NOT pick Free for production (it sleeps after 15 min) |

5. Scroll down to **Advanced** → expand it
6. Set **Health Check Path** to `/api/auth/captcha` (this URL returns a CAPTCHA image when the app is healthy)
7. Set **Auto-Deploy** to **Yes** (so future GitHub pushes auto-deploy)
8. **DO NOT click "Create Web Service" yet** — we need to add environment variables first.

---

## Part 7 — Generate 5 random secrets (2 min)

In Replit's Shell:

```sh
node -e "for(let i=0;i<5;i++) console.log(require('crypto').randomBytes(32).toString('hex'))"
```

This prints 5 lines of random characters. **Copy all 5 into your notes**, labeled 1–5.

---

## Part 8 — Add environment variables (10 min)

Back on the Render Web Service creation form:

1. Scroll to the **Environment Variables** section
2. Click **Add Environment Variable** for each row below:

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Neon connection string from Part 2 |
| `JWT_SECRET` | random line 1 from Part 7 |
| `JWT_REFRESH_SECRET` | random line 2 (different!) |
| `SESSION_SECRET` | random line 3 (different!) |
| `AUDIT_LOG_HMAC_SECRET` | random line 4 (different!) |
| `DOWNLOAD_SIGNING_SECRET` | random line 5 (different!) |
| `ANTHROPIC_API_KEY` | your Anthropic key from Part 3 (starts with `sk-ant-`) |
| `ALLOWED_ORIGINS` | leave blank for now — we'll add your domain in Part 11 |

⚠️ **The 5 random values MUST all be different.** Reusing them weakens the security audit fixes.

⚠️ **Do NOT add a `PORT` variable.** Render sets this automatically. If you set it yourself, the app won't be reachable.

---

## Part 9 — Add a persistent disk for uploads (3 min)

Without this, uploaded images disappear every time Render restarts your service (which happens on every redeploy and occasionally for maintenance).

1. Scroll to the **Disks** section in the same form
2. Click **Add Disk**
3. **Name**: `uploads`
4. **Mount Path**: `/opt/render/project/src/uploads`
5. **Size**: `1 GB` (you can resize later — costs $0.25/GB/month)
6. Click **Save**

---

## Part 10 — Create and watch the deploy (5 min)

1. Scroll to the bottom → click **Create Web Service**
2. You're taken to the service page. The build will start automatically.
3. Watch the **Logs** tab on the left. Expected sequence:
   - "Cloning from GitHub..."
   - "Running build command 'npm install && npm run build'"
   - Lots of "added N packages" lines
   - "✓ built in 12.12s"
   - "Build successful"
   - "Starting service with 'node dist/index.js'"
   - "Configuration validated successfully"
   - "serving on port 10000"
   - "Your service is live"

This takes 3–5 minutes the first time.

4. When you see "Your service is live", click the URL at the top (looks like `https://art-challenge.onrender.com`). The platform's landing page should load.

If the build fails or the app crashes, the Logs tab tells you why. Copy the error and ask if you can't figure it out.

---

## Part 11 — Connect your Hostinger domain (10 min)

### 11.1 — Tell Render about your domain

1. On the Render service page → left menu → **Settings**
2. Scroll to **Custom Domains**
3. Click **Add Custom Domain**
4. Enter your domain: `yourdomain.com` (replace with yours, no `https://`)
5. Render shows DNS records to add. You'll see something like:
   - `Type: CNAME, Name: www, Value: art-challenge.onrender.com`
   - `Type: A, Name: @, Value: 216.24.57.X` (Render's IP — copy whatever they show)

   Keep this page open.

6. Click **Add Custom Domain** again and add `www.yourdomain.com` so both work.

### 11.2 — Update DNS at Hostinger

1. In a new tab: https://hpanel.hostinger.com → **Domains** → click your domain → **DNS / Nameservers** → **DNS Zone Editor**
2. **Delete or edit** the existing `A` record for `@` to use the IP Render showed you
3. **Delete or edit** the existing `CNAME` record for `www`, set:
   - **Type**: CNAME
   - **Name**: `www`
   - **Points to**: `art-challenge.onrender.com` (your actual Render URL, without `https://`)
   - **TTL**: 14400
4. Save

DNS propagation: usually 5–30 minutes.

### 11.3 — Update ALLOWED_ORIGINS env var

Back on Render:

1. Service page → **Environment** tab (left menu)
2. Find `ALLOWED_ORIGINS` → **Edit**
3. Value: `https://yourdomain.com,https://www.yourdomain.com` (replace `yourdomain.com`, keep `https://`, keep the comma)
4. Save Changes — Render will redeploy automatically (~2 min)

### 11.4 — Wait for SSL

Back on the Render service Settings page, your custom domain rows will eventually show a green checkmark and "Certificate issued" — Render does Let's Encrypt automatically when DNS resolves correctly. Can take 5–30 minutes total.

---

## Part 12 — Final test (5 min)

1. Open `https://yourdomain.com` — the platform's landing page should load with a padlock icon
2. Register a test user. If you get past CAPTCHA → moderation gate is working.
3. Log in with that user → should land on the dashboard
4. (Optional) Open `https://www.yourdomain.com` — should redirect to or also serve the site

If all three work → **you're live**.

---

## Re-deploying after code changes

This is the part Render makes painless.

1. In Replit, change the code as you normally would
2. Open Replit's **Version Control** panel → type a message → click **Commit & push**
3. That's it.

Render watches GitHub. Within ~10 seconds of your push, it starts a new build and deploys it. You can watch the Logs tab on Render. The site is briefly served from the old version during the deploy, then cuts over with zero downtime.

Total time for a re-deploy: ~3 minutes, all automatic.

---

## Troubleshooting

### Build fails with "out of memory"

The Starter plan has 512 MB RAM, which sometimes isn't enough for the Vite build. Two fixes:

- **Upgrade to Standard ($25/mo)** — has 2 GB RAM, build always succeeds. Cleanest fix.
- **Or** add an env var on Render: `NODE_OPTIONS = --max-old-space-size=400` — caps memory usage and triggers more aggressive garbage collection. Slower but often works.

### App keeps restarting (logs show "Killed")

Same as above — memory pressure. Add the `NODE_OPTIONS` env var or upgrade.

### `502 Bad Gateway` when opening the URL

Render's logs will show why. Most common: the app crashed on startup because of a missing or wrong env var. Open Logs, look at the last ~30 lines.

### Custom domain shows "Certificate provisioning failed"

DNS hasn't propagated yet, OR the records point somewhere else. From a phone on cellular data (not your home Wi-Fi, which may cache DNS), open `https://dnschecker.org` and check that your domain's `A` record matches the IP Render gave you. Wait 15 minutes, then retry from Render's domain settings.

### Login returns 500 even with correct password

Almost always a duplicated secret. Open Render → Environment → confirm all 5 secrets (`JWT_SECRET`, `JWT_REFRESH_SECRET`, `SESSION_SECRET`, `AUDIT_LOG_HMAC_SECRET`, `DOWNLOAD_SIGNING_SECRET`) have **different** values.

### Uploaded images vanish after a redeploy

You forgot Part 9 (persistent disk). Add it via Settings → Disks → Add Disk → mount path `/opt/render/project/src/uploads`.

### Real-time vote updates work? (testing WebSocket)

WebSocket works out of the box on Render. To verify:
1. Open browser DevTools (F12) → Network tab → click WS filter
2. Navigate to a logged-in page on your site
3. You should see a request to `/ws` with status `101 Switching Protocols` — that means WebSocket is connected

---

## When to ask for help

Send me:
- The last 30 lines of Render Logs (Logs tab → copy/paste)
- Any error message in the browser
- A screenshot of an unfamiliar Render screen

I cannot log into your Render account or click for you, but I can read any error and tell you what to do.
