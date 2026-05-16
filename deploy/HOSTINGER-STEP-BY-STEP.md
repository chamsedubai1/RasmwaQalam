# Hostinger Cloud Hosting — Step-by-step deploy (non-developer guide)

This is a click-by-click walkthrough. You will:

1. Make a free database account (Neon — 10 min)
2. Get an AI moderation key (Anthropic — 5 min)
3. Use your Replit project's built-in Shell to run a few commands (10 min)
4. Upload a zip file to Hostinger (5 min)
5. Fill in some settings in Hostinger (15 min)
6. Connect your domain and turn on HTTPS (10 min)
7. Test that it works (5 min)

**Total: about 60–90 minutes.**

> If at any point a step doesn't match what you see, take a screenshot or copy the error text and ask. You can't break anything that isn't reversible at this stage.

---

## ⚠️ Step 0 — Confirm your Hostinger plan supports Node.js apps

Before anything else, verify your Cloud plan includes the "Node.js App" feature.

1. Log into https://hpanel.hostinger.com
2. Click your plan name to open it
3. In the left menu, look for **Advanced → Setup Node.js App**

If that menu item is missing or grayed out, your plan is too low (the lowest "Cloud Startup" tier may not have it). You will need to upgrade to **Cloud Professional** or higher, OR follow the Replit Deploy path instead.

If you can see "Setup Node.js App" — perfect, continue.

---

## Part 1 — Make a free database account (Neon)

The platform stores all data (users, submissions, votes) in a PostgreSQL database. Hostinger Cloud Hosting only provides MySQL, which the app does not use. The free Neon tier is the simplest answer.

### 1.1 — Create the Neon account

1. Open https://console.neon.tech in a new tab
2. Click **Sign up** (you can use Google or GitHub login — fastest)
3. After signup, Neon will prompt "Create your first project"

### 1.2 — Create the project

1. **Project name**: anything you like (e.g. `art-challenge`)
2. **Postgres version**: leave default
3. **Region**: pick the one closest to where your students are. For Europe → "Europe (Frankfurt)". For Middle East → "Asia (Singapore)" or Europe. For Americas → "US East".
4. Click **Create Project**

### 1.3 — Copy the connection string

After the project is created, Neon shows a screen with a connection string. It looks like:

```
postgresql://user_abc:AbCdEf1234@ep-cool-name-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require
```

1. Make sure the toggle says **Pooled connection** (important — this version handles many users)
2. Click the copy button
3. **Paste it somewhere safe** (a Notes app, a text file on your desktop). You will need it twice today.

---

## Part 2 — Get an Anthropic API key

The platform refuses to do any AI generation without a working moderation check. This is intentional — students should not receive unsafe AI-generated content.

1. Open https://console.anthropic.com in a new tab
2. Sign up / log in
3. Add a payment method (you get $5 free credit on signup; full deployment uses well under $1/month for moderation only)
4. Click **API Keys** in the left menu
5. Click **Create Key**
6. Name it `hostinger-production`
7. Click **Create**
8. **COPY THE KEY IMMEDIATELY** — you will only see it once. Paste it into the same notes file as your Neon connection string.

The key starts with `sk-ant-`.

---

## Part 3 — Build the app inside Replit

You already have the project running in Replit. We'll use Replit's built-in Shell to do everything, so you do not need to install anything on your computer.

### 3.1 — Open your Replit project

1. Go to https://replit.com and open your Art Challenge Platform project.

### 3.2 — Open the Shell

1. In Replit, look at the bottom of the screen or the right sidebar — there's a tab called **Shell** (or **Console** + **Shell**).
2. Click **Shell**. You'll see a prompt like `~/runner $`.

### 3.3 — Apply the database schema

Copy this entire line, replacing `<YOUR_NEON_URL>` with the connection string from step 1.3. Then paste it into the Shell and press Enter:

```sh
DATABASE_URL='<YOUR_NEON_URL>' npm run db:push
```

It should print something like "No changes detected" or a list of created tables. If it says "Drizzle Kit" and finishes without errors → done.

If you see "MissingDependencies" — run `npm install` first, wait for it to finish (~2 min), then re-run the line above.

### 3.4 — Build the production bundle

In the same Shell, run:

```sh
npm run build
```

Wait until you see "✓ built in 12.12s" or similar (around 2–3 minutes). This creates a folder called `dist` with the compiled app inside.

### 3.5 — Make the upload zip

In the Shell, run these three lines, one at a time:

```sh
mkdir -p deploy/build
cp -r dist shared package.json package-lock.json drizzle.config.ts deploy/build/
mkdir -p deploy/build/uploads
```

Then:

```sh
cd deploy/build && tar -czf ../hostinger-deploy.tar.gz . && cd ../..
```

You now have a file called `hostinger-deploy.tar.gz` inside the `deploy/` folder.

### 3.6 — Download the zip from Replit

1. In Replit's left sidebar (the file tree), find the `deploy/` folder
2. Click to expand it
3. Right-click on `hostinger-deploy.tar.gz` → **Download**
4. Save it to your computer's Desktop (or wherever you'll remember)

### 3.7 — Generate 5 random secret values

The app needs 5 different secret keys. Copy this whole line into Replit's Shell and press Enter:

```sh
node -e "for(let i=0;i<5;i++) console.log(require('crypto').randomBytes(32).toString('hex'))"
```

This prints 5 lines of 64 random characters. They look like:

```
a1b2c3d4e5f6789a1b2c3d4e5f6789a1b2c3d4e5f6789a1b2c3d4e5f6789ab12
b2c3d4e5f6789a1b2c3d4e5f6789a1b2c3d4e5f6789a1b2c3d4e5f6789a1b2c3
...
```

**Copy all 5 lines to your notes file** and label them 1, 2, 3, 4, 5 (you will assign them to specific environment variables in Part 5).

---

## Part 4 — Set up the Node.js App in Hostinger

### 4.1 — Open the Node.js App setup

1. Log into https://hpanel.hostinger.com
2. Click your hosting plan
3. Left menu: **Advanced → Setup Node.js App**
4. Click **Create Application** (top right)

### 4.2 — Fill in the application details

Fill in the form:

| Field | What to enter |
|---|---|
| **Node.js version** | Select **20.x** (or 18.x if 20 isn't listed) |
| **Application mode** | Production |
| **Application root** | Type `app` (Hostinger creates the folder) |
| **Application URL** | Pick your domain from the dropdown (e.g. `yourdomain.com`). Leave the path field empty. |
| **Application startup file** | Type exactly: `dist/index.js` |

Leave everything else at default. Click **Create**.

You'll be redirected to the app's detail page. **Leave this tab open.**

---

## Part 5 — Upload the app

### 5.1 — Open File Manager

1. Back at hPanel home, in the left menu, click **Files → File Manager**
2. Navigate by clicking through folders:
   - Double-click `domains`
   - Double-click `yourdomain.com`
   - Double-click `app` (the folder Hostinger created in step 4.2)

You should now be inside an empty `app/` folder.

### 5.2 — Upload the zip

1. Top toolbar of File Manager: click **Upload Files** (an upload icon)
2. Drag and drop `hostinger-deploy.tar.gz` from your Desktop, or click "Select File" and pick it
3. Wait for the upload to finish (1–2 minutes depending on connection)

### 5.3 — Extract the zip

1. Right-click on `hostinger-deploy.tar.gz` in File Manager
2. Click **Extract** from the menu
3. Confirm "Extract here"
4. Wait ~30 seconds. You should now see a `dist` folder, `shared` folder, `package.json` file, etc.
5. Right-click `hostinger-deploy.tar.gz` → **Delete** (you don't need the zip anymore)

---

## Part 6 — Fill in environment variables

### 6.1 — Open environment variables

1. Switch back to the Hostinger tab that has your Node.js App details (from step 4.2)
2. Scroll down until you see the **Environment Variables** section
3. You'll see a button **Add Variable** (or similar) and a key/value form

### 6.2 — Add each variable

For each row below, click "Add Variable", type the **Name** exactly as shown, paste the **Value**, then save:

| Name | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Paste the Neon connection string from step 1.3 |
| `JWT_SECRET` | Paste random line 1 from step 3.7 |
| `JWT_REFRESH_SECRET` | Paste random line 2 from step 3.7 |
| `SESSION_SECRET` | Paste random line 3 from step 3.7 |
| `AUDIT_LOG_HMAC_SECRET` | Paste random line 4 from step 3.7 |
| `DOWNLOAD_SIGNING_SECRET` | Paste random line 5 from step 3.7 |
| `ANTHROPIC_API_KEY` | Paste your Anthropic key from Part 2 (starts with `sk-ant-`) |
| `ALLOWED_ORIGINS` | Type: `https://yourdomain.com,https://www.yourdomain.com` (replace `yourdomain.com` with your actual domain — keep the `https://` and the comma) |

⚠️ **Important rules:**
- All 5 random values must be **different**. Do not paste line 1 into multiple variables.
- Do **not** set a variable called `PORT` — Hostinger sets this automatically.
- Do **not** set `REDIS_URL` — leave it out entirely.

When you're done, you should have **9 variables** listed.

---

## Part 7 — Install dependencies and start

### 7.1 — Run NPM Install

1. Still on the Node.js App page, scroll up to find the **Run NPM Install** button (sometimes labeled "Install Dependencies")
2. Click it
3. A log window appears. Wait until it shows "added N packages" — usually 2–4 minutes
4. If it fails with "out of memory" or "ENOMEM" — click it again. The second attempt almost always succeeds.

### 7.2 — Start the app

1. Find the **Restart** or **Start App** button
2. Click it
3. Wait ~10 seconds

### 7.3 — Test that it loaded

1. Click the **Application URL** at the top of the panel — it opens your domain in a new tab
2. You should see the Art Challenge Platform landing page

**If you see a Hostinger placeholder or a 503 error**, see "Troubleshooting" at the bottom.

---

## Part 8 — Connect your domain

If you bought the domain together with your hosting plan, this is **already done**. Skip to Part 9.

If your domain was bought separately:

1. hPanel → **Domains → DNS Zone Editor**
2. Find your domain in the list
3. Look for the **A** records pointing to `@` and `www`
4. If they don't point to your hosting IP (shown at the top of the hPanel home), edit them:
   - **Type**: A
   - **Name**: `@`
   - **Points to**: (your hosting IP)
   - **TTL**: 14400
5. Add a second A record for `www` with the same IP
6. Save

DNS changes can take 5–60 minutes to take effect.

---

## Part 9 — Turn on HTTPS (free SSL)

1. hPanel → **Security → SSL**
2. Find your domain in the list
3. Click **Setup** (or **Install SSL**)
4. Choose **Free SSL (Let's Encrypt)**
5. Click **Install**
6. Wait ~5 minutes for the green checkmark
7. Toggle **Force HTTPS** to ON

Now your domain only accepts secure (`https://`) connections.

---

## Part 10 — Final test

1. Open `https://yourdomain.com` in your browser. The platform's landing page should load with the padlock icon in the address bar.
2. Try to register a new test user. If you get past the CAPTCHA → moderation gate is working.
3. Log in with that user. You should land on the dashboard.

If all three work → **you're live**. 🎉

---

## Troubleshooting

### "503 Service Unavailable" when I open the URL

The app didn't start. Check the Passenger log:

1. Hostinger Node.js App page → top of page shows **Passenger log file** path
2. hPanel → **Files → File Manager** → navigate to that path
3. Open the log file and read the last 20 lines
4. Most common cause: a missing or misspelled environment variable name (e.g. `DATABASE_URL ` with a trailing space). Compare each variable against Part 6.2.

### "Cannot connect to database" in logs

Open https://console.neon.tech and check that your project is **Active** (not paused). Neon free tier auto-pauses after 5 minutes of inactivity but wakes up on first request — wait 10 seconds and click Restart in Hostinger.

### Login returns 500 even with correct password

Likely a secret value problem. Most common: you accidentally pasted the same random line into two different secret variables. Re-check that all 5 secret variables (`JWT_SECRET`, `JWT_REFRESH_SECRET`, `SESSION_SECRET`, `AUDIT_LOG_HMAC_SECRET`, `DOWNLOAD_SIGNING_SECRET`) are different values.

### Real-time voting updates don't appear

Hostinger's proxy sometimes blocks WebSocket. The app still works — users just need to refresh to see new votes. This is a known limitation of the Cloud Hosting tier.

### "Run NPM Install" fails with "JavaScript heap out of memory"

A known Hostinger issue. Three workarounds:

- Try again (often succeeds on second attempt)
- Or rebuild the zip with `npm install` already done locally (more advanced — ask for help)
- Or upgrade to a higher Cloud plan with more RAM

---

## Re-deploying after you change the code

When you update the code in Replit and want to push the change live:

1. In Replit Shell: `npm run build`
2. Re-create the zip: see step 3.5
3. Download `hostinger-deploy.tar.gz` again
4. In Hostinger File Manager: delete the old `dist` folder and the old `shared` folder
5. Upload and extract the new zip
6. Hostinger Node.js App page → click **Restart**

Total time for a re-deploy: ~5 minutes.

`npm install` does NOT need to be re-run unless `package.json` changed.

---

## When to ask for help

Paste the relevant text and I'll help:

- Any error in red text from Replit Shell
- The last 20 lines of Hostinger's Passenger log file
- Whatever appears in the browser when you open your domain

I cannot log into your Hostinger or Replit account, but I can debug any error message you show me.
