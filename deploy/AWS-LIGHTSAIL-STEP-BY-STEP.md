# AWS Lightsail — Step-by-step deploy (non-developer guide)

This deploys the Art Challenge Platform on a $10/month AWS Lightsail instance. Your Hostinger domain will still be used — it just points at AWS instead of Hostinger's servers.

You'll spend about **2–3 hours** the first time. After that, redeploying takes ~10 minutes.

## What this gets you

- Full Node.js 20 server (everything works, no compromises)
- HTTPS with a free Let's Encrypt certificate
- Auto-restart if the app crashes
- Auto-redirect from `http://` to `https://`
- Your domain (kept at Hostinger) pointing at the AWS server

## What you need to start

- A **credit card** (AWS requires one even for free tier — you can set a billing alert later)
- Your existing Hostinger account (for DNS)
- A **GitHub account** (free — sign up at https://github.com if you don't have one). We'll use GitHub to move the code from Replit to AWS.
- A free **Neon** account at https://console.neon.tech for the database (~10 min)
- An **Anthropic API key** at https://console.anthropic.com (~5 min)

---

## Part 1 — Push your code to GitHub from Replit

AWS Lightsail will pull the code from GitHub. The easiest way to get it there is Replit's built-in GitHub integration.

1. Open your Art Challenge Platform project on https://replit.com
2. Look at the left sidebar — click the **Version Control** icon (looks like a branch/fork symbol). On newer Replit it may be labeled **Git**.
3. Click **Create a Git Repo** (or **Connect to GitHub** if you've used it before)
4. Choose **Create a new repository on GitHub**
5. Sign in to GitHub when prompted
6. Repository name: `art-challenge-platform` (or anything)
7. Set it to **Private** (your code should not be public, especially before you remove any test keys)
8. Click **Create**

Replit will push your current code to GitHub. After ~30 seconds, you'll see "All changes pushed" and a link to your repo. **Copy that link** (looks like `https://github.com/yourname/art-challenge-platform`) into your notes.

Important: Anytime you change code in Replit later, click **Commit & push** in this same Version Control panel to send updates to GitHub.

---

## Part 2 — Set up the database (Neon, ~10 min)

Same steps as the Hostinger guide. If you already did this, reuse the connection string.

1. Open https://console.neon.tech → **Sign up** (use Google/GitHub login)
2. Create a new project. Region: closest to your users (Europe → Frankfurt, US → Ohio, etc.)
3. After creation, copy the **pooled connection string** (looks like `postgresql://...pooler...neon.tech/neondb?sslmode=require`)
4. Save it in your notes file

---

## Part 3 — Get the Anthropic API key (~5 min)

Required — without this, every AI feature returns 503 by design (the moderation gate is non-bypassable).

1. Open https://console.anthropic.com → sign up
2. Add a payment method ($5 free credit on signup; moderation-only usage costs well under $1/month)
3. **API Keys** → **Create Key** → name it `aws-production`
4. **Copy the key immediately** (starts with `sk-ant-`) — you only see it once. Save to notes.

---

## Part 4 — Create the AWS account (~10 min)

Skip if you already have one.

1. Open https://aws.amazon.com → **Create an AWS Account**
2. Email, password, account name → next
3. **Personal** account type
4. Address, phone — fill in
5. Credit card — **required** even for free-tier
6. Phone verification — AWS will text you a code
7. Pick the **Basic Support — Free** plan
8. Wait for the welcome email (5–10 minutes sometimes)

⚠️ **Set a billing alert right now** so you don't get surprised:

1. Sign in at https://console.aws.amazon.com
2. Click your account name top-right → **Billing and Cost Management**
3. Left menu → **Billing preferences** → enable **Invoice delivery preferences** + **Free Tier usage alerts**
4. Left menu → **Budgets** → **Create budget** → use the "Zero spend budget" template if you want strict alerts, or set a $15/mo budget with email alert at 80%

---

## Part 5 — Create the Lightsail instance (~10 min)

1. In the AWS console search bar (top), type `Lightsail` and click it
2. You'll land on Lightsail's home. Click **Create instance**
3. **Instance location**: pick the region closest to your users (drop-down at top). Match the Neon region you picked in Part 2 for best speed.
4. **Pick your instance image**:
   - Platform: **Linux/Unix**
   - Blueprint: scroll to **OS Only** → choose **Ubuntu 22.04 LTS**
5. **Choose your instance plan**:
   - Pick the **$10 USD/month** option (1 GB RAM, 2 vCPUs, 40 GB SSD, 2 TB transfer)
   - Smaller ($5/mo, 512 MB RAM) will fail the build with "out of memory" — don't pick it.
6. **Identify your instance**: name it `art-challenge-platform`
7. Click **Create instance**

Wait ~2 minutes. The instance card will show "Pending" → "Running".

---

## Part 6 — Attach a static IP (free, ~2 min)

By default, Lightsail's IP changes if you restart the instance. A static IP stays fixed and is **free as long as it's attached to an instance**.

1. Lightsail home → **Networking** tab (top of page)
2. Click **Create static IP**
3. Region: same as your instance
4. **Attach to an instance**: pick `art-challenge-platform`
5. **Identify your static IP**: name it `art-challenge-ip`
6. Click **Create**

Note the IP address shown (looks like `52.x.x.x` or `3.x.x.x`). **Copy it to your notes** — you'll use it twice today.

---

## Part 7 — Open the firewall (~3 min)

By default Lightsail only allows SSH. We need to open HTTP and HTTPS so users can reach the app.

1. Lightsail home → click your instance card (`art-challenge-platform`)
2. Top tabs → **Networking**
3. Under **IPv4 Firewall**, you should see SSH already allowed
4. Click **+ Add rule**: choose **HTTP** (port 80) → Create
5. Click **+ Add rule**: choose **HTTPS** (port 443) → Create

Both ports should now show in the list with green status.

---

## Part 8 — Connect via the browser SSH (~1 min)

Lightsail has a built-in SSH terminal in the browser — no PuTTY or keys to manage.

1. Back on your instance page, scroll to top
2. Click the orange **Connect using SSH** button
3. A black terminal window opens in a new tab. You're now logged into the server.

You'll see a prompt like:
```
ubuntu@ip-172-26-xx-xx:~$
```

For the rest of this guide, **everything in code boxes goes into this terminal**. Triple-click to select a line, copy, then right-click in the terminal to paste.

---

## Part 9 — Install Node.js, nginx, and tools (~5 min)

Paste these one block at a time. Wait for each to finish before the next.

### 9.1 — Update the system

```sh
sudo apt update && sudo apt upgrade -y
```

Takes ~2 min. You may see a purple prompt about kernel upgrades — press Enter to accept defaults.

### 9.2 — Install Node.js 20

```sh
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

After this finishes, verify:

```sh
node --version
```

Should print `v20.x.x`.

### 9.3 — Install nginx (web server / HTTPS), certbot (free SSL), git, build tools

```sh
sudo apt install -y nginx certbot python3-certbot-nginx git build-essential
```

### 9.4 — Install PM2 (keeps your app running)

```sh
sudo npm install -g pm2
```

---

## Part 10 — Get your code onto the server (~5 min)

### 10.1 — Clone from GitHub

Replace `YOUR_GITHUB_URL` with the URL you saved in Part 1 (looks like `https://github.com/yourname/art-challenge-platform`):

```sh
cd ~
git clone YOUR_GITHUB_URL app
```

If your GitHub repo is private (recommended), git will ask for credentials:
- **Username**: your GitHub username
- **Password**: GitHub no longer accepts your account password here. You need a **Personal Access Token**:
  1. Open https://github.com/settings/tokens
  2. Click **Generate new token (classic)**
  3. Note: `lightsail-deploy`
  4. Expiration: 90 days
  5. Scopes: tick only `repo`
  6. Click **Generate token** at the bottom
  7. **Copy the token immediately**
  8. Paste it as the password in the terminal

### 10.2 — Install dependencies and build

```sh
cd ~/app
npm install
```

Takes 2–4 minutes. You'll see lots of output. When you see a prompt again (no spinning indicator), it's done.

Then:

```sh
npm run build
```

Takes ~2 minutes. Should end with `✓ built in 12.12s` and `dist\index.js  306.9kb`.

---

## Part 11 — Set environment variables (~10 min)

### 11.1 — Generate 5 random secrets

```sh
node -e "for(let i=0;i<5;i++) console.log(require('crypto').randomBytes(32).toString('hex'))"
```

This prints 5 lines of 64-character random hex. **Copy all 5 to your notes**, labeled 1–5.

### 11.2 — Create the .env file

```sh
nano ~/app/.env
```

A text editor opens inside the terminal. Paste this template, then fill in the values:

```
NODE_ENV=production
PORT=3000
DATABASE_URL=PASTE_NEON_CONNECTION_STRING_HERE
JWT_SECRET=PASTE_RANDOM_LINE_1_HERE
JWT_REFRESH_SECRET=PASTE_RANDOM_LINE_2_HERE
SESSION_SECRET=PASTE_RANDOM_LINE_3_HERE
AUDIT_LOG_HMAC_SECRET=PASTE_RANDOM_LINE_4_HERE
DOWNLOAD_SIGNING_SECRET=PASTE_RANDOM_LINE_5_HERE
ANTHROPIC_API_KEY=PASTE_YOUR_ANTHROPIC_KEY_HERE
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

Replace every `PASTE_..._HERE` with your real values. Replace `yourdomain.com` with your actual Hostinger domain (keep `https://`).

⚠️ The 5 random secrets must all be **different**. Do not reuse.

Save and close:
- Press **Ctrl + O** (save) → Enter (confirm filename)
- Press **Ctrl + X** (exit)

### 11.3 — Lock down the .env file (security)

```sh
chmod 600 ~/app/.env
```

This makes the file readable only by you, not other users on the server.

---

## Part 12 — Apply the database schema (~2 min)

```sh
cd ~/app
npm run db:push
```

Should print "No changes detected" or a list of created tables. If you see an error about connecting to Neon, double-check the `DATABASE_URL` value in `.env` (Ctrl+O usually preserves it but make sure there's no stray space).

---

## Part 13 — Start the app with PM2 (~3 min)

PM2 keeps your app running 24/7 and restarts it if it crashes.

### 13.1 — Start the app

```sh
cd ~/app
pm2 start dist/index.js --name art-platform
```

You should see a green table showing the process is "online".

### 13.2 — Verify it's running

```sh
pm2 logs art-platform --lines 30
```

Look for `Configuration validated successfully` and `serving on port 3000`. If you see errors, the most likely cause is a typo in `.env` — re-open it with `nano ~/app/.env`.

Press **Ctrl + C** to exit the log view.

### 13.3 — Make PM2 start on server reboot

```sh
pm2 startup
```

It prints one command starting with `sudo env PATH=...`. **Copy that command** and paste it (it adds PM2 to startup).

```sh
pm2 save
```

Now PM2 will restore your app even after the server restarts.

---

## Part 14 — Configure nginx as a reverse proxy (~5 min)

Right now your app listens on port 3000 internally. Users connect to ports 80 (HTTP) and 443 (HTTPS). nginx will forward traffic between them and also handle HTTPS certificates.

### 14.1 — Create the nginx config

```sh
sudo nano /etc/nginx/sites-available/art-platform
```

Paste this. Replace `yourdomain.com` with your real domain on both lines that have it:

```
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;

    client_max_body_size 12M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}
```

Save: **Ctrl + O** → Enter → **Ctrl + X**

### 14.2 — Enable the site

```sh
sudo ln -s /etc/nginx/sites-available/art-platform /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
```

The last command should print `syntax is ok` and `test is successful`. If it doesn't, copy the error and ask for help — don't continue.

### 14.3 — Reload nginx

```sh
sudo systemctl reload nginx
```

---

## Part 15 — Point your Hostinger domain at AWS (~10 min)

1. Open https://hpanel.hostinger.com in a new tab
2. Left menu → **Domains** → click your domain
3. Left submenu → **DNS Zone Editor** (or **DNS / Nameservers**)
4. Find the existing **A** records pointing to `@` (your domain root). Click **Edit**.
5. Replace the IP with **your Lightsail static IP** (from Part 6)
6. Save
7. Now find the **A** record for `www`. If it exists, edit it the same way. If not, click **Add new record**:
   - Type: A
   - Name: `www`
   - Points to: same Lightsail IP
   - TTL: 14400
   - Save

DNS propagation: usually 5–30 minutes, occasionally up to a few hours.

### 15.1 — Test DNS

Back in the AWS terminal, run:

```sh
ping -c 3 yourdomain.com
```

(Replace `yourdomain.com`.) When DNS has propagated, the output shows your Lightsail IP. If it still shows a Hostinger IP or "unknown host", wait 5 more minutes and try again.

---

## Part 16 — Enable HTTPS (~5 min)

Once DNS shows the Lightsail IP, get a free Let's Encrypt certificate.

```sh
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

(Replace both `yourdomain.com` with your domain.)

It will ask:
1. **Email**: your real email (for renewal warnings)
2. **Terms of service**: type `A` and Enter
3. **Share with EFF**: `N`
4. After it succeeds, it asks about redirecting HTTP → HTTPS: choose **2 (Redirect)**

You should see "Congratulations! Your certificate ...". HTTPS is now live.

Certbot also installed a cron job that auto-renews certificates every 90 days.

---

## Part 17 — Final test (~5 min)

1. Open `https://yourdomain.com` in your browser — the platform's landing page should load with a padlock icon in the address bar
2. Try `https://www.yourdomain.com` — same site, padlock
3. Register a test user. If you get past CAPTCHA → the moderation gate is working
4. Log in with that user → should land on the dashboard

If all three work, **you're live**.

---

## Re-deploying after code changes

When you change code in Replit:

### In Replit
1. Open the **Version Control** panel
2. Type a short message (e.g. "updated event page")
3. Click **Commit & push**

### In the AWS terminal (Lightsail browser SSH)
```sh
cd ~/app
git pull
npm install
npm run build
pm2 restart art-platform
```

Total time: ~3 minutes.

---

## Troubleshooting

### `502 Bad Gateway` when I open the URL

The Node app isn't running. Check:
```sh
pm2 status
pm2 logs art-platform --lines 50
```
The logs show why it crashed. Most common: an environment variable is wrong in `.env`.

### `pm2 status` shows "errored"

App keeps crashing. Run:
```sh
pm2 logs art-platform --err --lines 30
```
Read the last error. Likely a missing env var or a DB connection problem.

### Login returns 500 even with correct password

Same as Hostinger — the most common cause is reusing the same random secret in multiple env vars. Edit `~/app/.env`, make sure all 5 secret values are different, then `pm2 restart art-platform`.

### "Run out of memory" during `npm install` or `npm run build`

You picked the $5/mo plan with 512 MB RAM. Either:
- In Lightsail console → Instances → your instance → **Stop** → wait → click the plan size → upgrade to $10/mo → **Start**
- Or add a swap file:
  ```sh
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  ```
  Then retry the failed command.

### Certbot failed: "DNS problem: NXDOMAIN"

Your DNS hasn't propagated yet. Wait 15 minutes, then retry the Part 16 command.

### I want to add Redis later

Lightsail can run Redis on the same server:
```sh
sudo apt install -y redis-server
sudo systemctl enable --now redis-server
```
Then add `REDIS_URL=redis://127.0.0.1:6379` to `~/app/.env` and `pm2 restart art-platform`. The Bull queue and Redis-backed rate limiters will activate automatically.

---

## Cost summary (typical monthly)

- Lightsail $10/mo instance: **$10**
- Static IP (attached): **$0**
- Bandwidth (2 TB included): **$0** for normal use
- Neon database: **$0** (free tier)
- Anthropic API (moderation only): **~$1**
- Hostinger domain renewal: whatever you pay annually divided by 12
- **Total: ~$11/month**

If you grow to thousands of users and the $10/mo plan slows down, you can resize the instance in-place (Lightsail → instance → Snapshots → Manage → Create snapshot, then launch a bigger plan from the snapshot).
