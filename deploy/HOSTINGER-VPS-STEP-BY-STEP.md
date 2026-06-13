# Hostinger VPS — Step-by-step deploy (non-developer guide)

You have a Hostinger VPS KVM 2 plan. This deploys the platform using Docker (which you already have set up locally), nginx as a reverse proxy, and free Let's Encrypt HTTPS. Total time: about **60–75 minutes** the first time. Re-deploys later: ~3 minutes.

## What you need ready (you already have most of these)

- [x] GitHub repo at https://github.com/chamsedubai1/RasmwaQalam
- [x] Neon database connection string in your notes
- [x] Anthropic API key in your notes
- [x] 5 random secret values in your notes
- [x] Hostinger VPS running, IP `72.60.90.89` (or whatever shows in hPanel)
- [ ] Your Hostinger VPS root password — find it in hPanel → VPS → **Settings** → **Root password**. If you never set one, click **Change root password** and set one now. Save it to your notes.

## What this gets you

- Full Node 20 app running 24/7 in Docker (auto-restarts on crash + reboot)
- nginx in front handling HTTPS and routing
- Free Let's Encrypt certificate (auto-renews every 90 days)
- Persistent uploads that survive redeploys
- Auto-redeploy script: one command later updates the live site

---

## Part 1 — Connect to your VPS via Browser Terminal (3 min)

You don't need PuTTY or SSH keys. Hostinger has a built-in browser terminal.

1. Go to https://hpanel.hostinger.com → click **VPS** → click your server name
2. Left menu → **Browser terminal** (or it may say **SSH access** with a "Browser Terminal" button)
3. Click **Connect** / **Open terminal**
4. A black terminal window opens in your browser. You'll be logged in as `root`.

You should see a prompt like:
```
root@srv964262:~#
```

For the rest of this guide: **everything in code blocks goes into this terminal**. Copy a block (triple-click selects the whole line), then right-click in the terminal to paste, then press Enter.

---

## Part 2 — Update the system and install required packages (10 min)

### 2.1 — Update Ubuntu

Paste this:
```sh
apt update && apt upgrade -y
```

Wait until it finishes. If a purple/pink dialog appears asking about kernel upgrades or grub config, press **Tab** then **Enter** to accept defaults.

### 2.2 — Install Docker

```sh
apt install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Verify it works:
```sh
docker --version
```
You should see `Docker version 27.x.x` or similar.

### 2.3 — Install nginx, certbot, git, ufw (firewall)

```sh
apt install -y nginx certbot python3-certbot-nginx git ufw
```

### 2.4 — Open the firewall ports

```sh
ufw allow OpenSSH
ufw allow "Nginx Full"
ufw --force enable
ufw status
```

You should see `Status: active` with `OpenSSH`, `Nginx Full` and `22/tcp`, `80,443/tcp` allowed.

---

## Part 3 — Get your code onto the VPS (5 min)

### 3.1 — Clone the GitHub repo

```sh
cd /opt
git clone https://github.com/chamsedubai1/RasmwaQalam.git app
cd app
```

If your repo is private, git will prompt for credentials:
- **Username**: your GitHub username (`chamsedubai1`)
- **Password**: a **Personal Access Token**, NOT your account password
  - Generate at https://github.com/settings/tokens → **Generate new token (classic)** → name `vps-deploy`, expiration 90 days, scope: tick only `repo` → **Generate token**
  - **Copy the token immediately** and paste it as the password

If your repo is public, no prompt — it just clones.

After cloning:
```sh
ls
```
You should see `Dockerfile`, `package.json`, `server/`, `client/`, etc.

---

## Part 4 — Create the environment file (10 min)

The container reads its config from `/opt/app/.env`. This file holds secrets — never goes to GitHub.

### 4.1 — Open the editor

```sh
nano /opt/app/.env
```

A simple text editor opens. Paste this template:

```
NODE_ENV=production
PORT=10000
DATABASE_URL=PASTE_NEON_CONNECTION_STRING_HERE
JWT_SECRET=PASTE_RANDOM_LINE_1_HERE
JWT_REFRESH_SECRET=PASTE_RANDOM_LINE_2_HERE
SESSION_SECRET=PASTE_RANDOM_LINE_3_HERE
AUDIT_LOG_HMAC_SECRET=PASTE_RANDOM_LINE_4_HERE
DOWNLOAD_SIGNING_SECRET=PASTE_RANDOM_LINE_5_HERE
ANTHROPIC_API_KEY=PASTE_YOUR_ANTHROPIC_KEY_HERE
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

Replace every `PASTE_..._HERE` with your real values. Replace `yourdomain.com` with your actual domain in both places (keep `https://`, keep the comma).

⚠️ Three rules:
- All 5 random secrets must be **different**
- Lines do NOT need quotes around the values
- No trailing spaces on any line

### 4.2 — Save and close

- Press **Ctrl + O** (writes the file)
- Press **Enter** (confirms the filename)
- Press **Ctrl + X** (exits the editor)

### 4.3 — Lock down the file so only root can read it

```sh
chmod 600 /opt/app/.env
```

---

## Part 5 — Build and run the Docker container (10 min)

### 5.1 — Build the image

```sh
cd /opt/app
docker build -t rasm-wa-qalam:latest .
```

This takes **3–5 minutes** the first time (downloads Node base image, installs dependencies, builds). You'll see lots of output. Look for `Successfully tagged rasm-wa-qalam:latest` at the end.

If the build fails on "out of memory", we'll add swap space — paste the error here and I'll guide you.

### 5.2 — Create a persistent uploads folder on the host

```sh
mkdir -p /opt/uploads
chmod 700 /opt/uploads
```

User-uploaded images will live here on the VPS itself, not inside the container. That way they survive container rebuilds.

### 5.3 — Run the container

```sh
docker run -d \
  --name rasm-wa-qalam \
  --restart unless-stopped \
  -p 127.0.0.1:3000:10000 \
  --env-file /opt/app/.env \
  -v /opt/uploads:/app/uploads \
  rasm-wa-qalam:latest
```

Verify it's running:
```sh
docker ps
```
You should see your container with status `Up X seconds (health: starting)`. After ~30 seconds it changes to `Up X minutes (healthy)`.

### 5.4 — Check the logs

```sh
docker logs rasm-wa-qalam --tail 30
```

Look for:
- `Configuration validated successfully`
- `WebSocket service initialized`
- `serving on port 10000`

If you see errors instead — usually a typo in `.env` — paste the last 20 log lines here and I'll diagnose.

### 5.5 — Quick local sanity check

```sh
curl http://127.0.0.1:3000/api/auth/captcha
```

Should print a JSON response with an SVG image. That proves the app is running and reachable internally. Users still can't reach it yet — that's what nginx is for in the next step.

---

## Part 6 — Configure nginx as the public-facing proxy (10 min)

Your app listens on `127.0.0.1:3000` (internal only). Users connect to ports 80 and 443. nginx bridges them and handles HTTPS.

### 6.1 — Create the nginx site config

```sh
nano /etc/nginx/sites-available/rasm-wa-qalam
```

Paste this. Replace `yourdomain.com` with your real domain on the `server_name` line:

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

Save: **Ctrl + O** → **Enter** → **Ctrl + X**.

### 6.2 — Enable the site

```sh
ln -sf /etc/nginx/sites-available/rasm-wa-qalam /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
```

The last command should end with `syntax is ok` and `test is successful`. If not, copy the error and paste here.

### 6.3 — Reload nginx

```sh
systemctl reload nginx
```

---

## Part 7 — Point your domain at the VPS (5 min)

DNS for the domain you registered at Hostinger needs to point to your VPS's public IP (`72.60.90.89`).

1. hPanel → **Domains** → click your domain
2. Left menu → **DNS / Nameservers** → **DNS Zone Editor**
3. Find existing **A** records:
   - **Edit** the record for `@` (the root domain), set **Points to** = `72.60.90.89`, **TTL** = `14400`, save
   - **Edit or add** the record for `www`, same IP, same TTL, save
4. Delete any old A or AAAA records pointing elsewhere

Propagation: usually 5–30 minutes. To check from inside the VPS:

```sh
ping -c 3 yourdomain.com
```
(Replace `yourdomain.com`.) When the output shows `72.60.90.89` (or your VPS IP), DNS is live.

---

## Part 8 — Get HTTPS (5 min)

Once DNS shows the VPS IP:

```sh
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

(Replace both `yourdomain.com` with your real domain.) Certbot asks:

1. **Email**: your real email (for renewal warnings)
2. **Terms of service**: type `Y` and Enter
3. **Share with EFF**: `N`
4. After the certificate is issued, choose **2 (Redirect)** to auto-redirect HTTP → HTTPS

You should see "Congratulations! Your certificate ...". HTTPS is now live.

Certbot also set up auto-renewal — certificates renew automatically every 90 days. To confirm:

```sh
systemctl status certbot.timer | head -5
```

Should say `active (waiting)`.

---

## Part 9 — Final test (5 min)

1. Open `https://yourdomain.com` in your browser — landing page should load, padlock icon visible
2. Register a test user — if past CAPTCHA, moderation gate is live
3. Log in with that user — should land on the dashboard
4. (Optional) F12 → Network → WS tab → navigate to a logged-in page. Should see `/ws` with `101 Switching Protocols` — confirms WebSocket works (it will, because nothing in front of nginx is blocking it on a VPS)

If all three work → **you're live**. 🎉

---

## Re-deploying after code changes

After this initial setup, deploys are short. From your local PowerShell, you push to GitHub:

```
git add -A
git commit -m "describe your change"
git push
```

Then in the VPS Browser Terminal:

```sh
cd /opt/app
git pull
docker build -t rasm-wa-qalam:latest .
docker stop rasm-wa-qalam
docker rm rasm-wa-qalam
docker run -d \
  --name rasm-wa-qalam \
  --restart unless-stopped \
  -p 127.0.0.1:3000:10000 \
  --env-file /opt/app/.env \
  -v /opt/uploads:/app/uploads \
  rasm-wa-qalam:latest
```

You can save those commands as a script so future deploys are one command — ask me when you want to set that up.

Total downtime during redeploy: 5–10 seconds.

---

## Troubleshooting

### Browser shows "site can't be reached" even after DNS propagates

In the VPS terminal:
```sh
systemctl status nginx
docker ps
```
- If nginx isn't running: `systemctl start nginx`
- If the container isn't running: `docker start rasm-wa-qalam`, then `docker logs rasm-wa-qalam --tail 50` to see why it died

### `502 Bad Gateway`

nginx is up but can't reach the container.
```sh
docker ps
```
- If the container shows `Restarting` — `docker logs rasm-wa-qalam --tail 50` to see the crash reason. Usually a bad env var.

### Build runs out of memory

KVM 2 has 8 GB RAM which is plenty, but if you ever hit this, add swap:
```sh
fallocate -l 4G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

### Login returns 500

Almost always one of the 5 secret values got duplicated. Re-open `/opt/app/.env`, confirm all 5 are unique, then `docker restart rasm-wa-qalam`.

### Certbot fails: "DNS problem: NXDOMAIN"

DNS hasn't propagated yet. Wait 15 minutes, re-run the certbot command.

### Uploaded images vanish after `docker rm`

This shouldn't happen — `/opt/uploads` is bind-mounted. If you see this, double-check the `-v /opt/uploads:/app/uploads` flag is in your `docker run` command exactly.

---

## Optional: add Redis later for the AI queue

Your KVM 2 has plenty of headroom for Redis. To enable the Bull queue (better retries on AI failures):

```sh
apt install -y redis-server
systemctl enable --now redis-server
```

Then add to `/opt/app/.env`:
```
REDIS_URL=redis://127.0.0.1:6379
```

Restart the container:
```sh
docker restart rasm-wa-qalam
```

The Bull queue and Redis-backed rate limiters activate automatically (we built the app this way).

---

## When to ask for help

Paste me:
- Any red text or "error" from the terminal
- The last ~30 lines of `docker logs rasm-wa-qalam`
- The last ~30 lines of `tail -30 /var/log/nginx/error.log`

I cannot log into your VPS or click in hPanel for you, but I can read any error and tell you the exact next command.
