# Ollama setup — local development and production

The platform's AI features (poem generation, prompt enhancement, content moderation) now run through **Ollama** — a local LLM runner. Anthropic Claude is gone. Two models are needed:

| Model | Size | Role | Required? |
|---|---|---|---|
| `qwen2.5:3b` | ~2 GB | Default content generation (poems) | **Required** |
| `llama-guard3:1b` | ~800 MB | Content moderation (Meta's safety classifier) | **Required** |
| `deepseek-r1:7b` | ~4.7 GB | Higher-quality reasoning, slower | Optional |
| `qwen2.5vl:3b` | ~3.2 GB | Vision model — used for artwork analysis | Optional |

The first two are mandatory — without them, every AI feature returns 503 `MODERATION_UNAVAILABLE` (intentional, for student safety). The other two appear in the UI model picker only after they're installed.

---

## Part A — Local dev on Windows (your PC)

### A.1 Install Ollama natively (not Docker)

On Windows, native Ollama is much faster than Docker (no virtualization overhead). Recommended.

1. Open https://ollama.com/download
2. Click **Download for Windows**
3. Run the installer. It registers itself as a Windows service that auto-starts.
4. Open PowerShell and verify:
   ```
   ollama --version
   ```
   Should print something like `ollama version 0.3.x`.

### A.2 Pull the models (one-time, ~15-30 minutes total)

**Required:**
```
ollama pull qwen2.5:3b
ollama pull llama-guard3:1b
```

**Optional, but enables the model picker in the UI:**
```
ollama pull deepseek-r1:7b
ollama pull qwen2.5vl:3b
```

Disk usage after all four: ~11 GB. Skip the optional ones if you're tight on disk.

Verify both are installed:
```
ollama list
```
Should show two rows.

### A.3 Quick sanity check (without the platform)

```
ollama run llama-guard3:1b "Hello, can you help me with my homework?"
```
Should reply `safe`. Press **Ctrl + D** to exit the prompt.

```
ollama run qwen2.5:3b "Write a haiku about a cat"
```
Should print a 3-line haiku. Ctrl+D to exit.

If both work, Ollama is ready.

### A.4 Configure the platform's local `.env`

Create or edit `.env` in the project root (`c:\Code\projects\ArtChallengePlatform\.env`):

```
NODE_ENV=development
DATABASE_URL=postgresql://<your-neon-connection-string>
JWT_SECRET=any-random-string-for-dev
JWT_REFRESH_SECRET=another-random-string
SESSION_SECRET=yet-another-random-string
AUDIT_LOG_HMAC_SECRET=one-more
DOWNLOAD_SIGNING_SECRET=last-one

# Ollama — local native install
OLLAMA_URL=http://localhost:11434
OLLAMA_GENERATION_MODEL=qwen2.5:3b
OLLAMA_MODERATION_MODEL=llama-guard3:1b
```

Dev secrets can be any non-empty strings — they only matter in production.

### A.5 Run the platform

```
npm install
npm run dev
```

Watch the server logs as you exercise the UI. When you trigger AI features, you should see:
```
[MODERATION] Poem prompt approved for generation
```

When Ollama is starting cold, the first generation takes 5-15 seconds. Subsequent ones are faster as the model stays loaded.

### A.6 Quick API test (browser dev tools)

After logging in:
```
curl -X POST http://localhost:5000/api/ai/generate-poem \
  -H "Content-Type: application/json" \
  -b "access_token=<paste-your-cookie>" \
  -d '{"prompt":"a butterfly in a garden","style":"haiku"}'
```

Or just use the actual submission UI — it's easier.

---

## Part B — Production: add Ollama to the VPS

### B.1 Update the VPS docker-compose.yml

On your Hostinger VPS, edit `/opt/platform/docker-compose.yml`:

```
nano /opt/platform/docker-compose.yml
```

Replace the entire file contents with this:

```yaml
services:
  platform:
    build: .
    restart: always
    env_file:
      - .env
    volumes:
      - ./uploads:/app/uploads
    depends_on:
      ollama:
        condition: service_healthy
    labels:
      - traefik.enable=true
      - traefik.http.routers.platform.rule=Host(`rasmwaqalam.com`) || Host(`www.rasmwaqalam.com`)
      - traefik.http.routers.platform.entrypoints=websecure
      - traefik.http.routers.platform.tls=true
      - traefik.http.routers.platform.tls.certresolver=mytlschallenge
      - traefik.http.services.platform.loadbalancer.server.port=10000

  ollama:
    image: ollama/ollama:latest
    restart: always
    volumes:
      - ollama_models:/root/.ollama
    # NOT exposing a host port — only the platform container reaches it
    healthcheck:
      test: ["CMD", "ollama", "list"]
      interval: 30s
      timeout: 5s
      retries: 5
      start_period: 30s

volumes:
  ollama_models:

networks:
  default:
    name: root_default
    external: true
```

Two notable changes from your earlier compose:
- New `ollama` service that runs Ollama as a long-lived container, with a named volume so models survive container rebuilds
- `entrypoints=websecure` (was `web,websecure`) — this is the HTTPS fix from before; now redirects HTTP → HTTPS automatically via Traefik's global rule

Save: **Ctrl+O → Enter → Ctrl+X**

### B.2 Update the VPS `.env`

```
nano /opt/platform/.env
```

Remove the line `ANTHROPIC_API_KEY=...` (if present).
Add these three lines anywhere in the file:

```
OLLAMA_URL=http://ollama:11434
OLLAMA_GENERATION_MODEL=qwen2.5:3b
OLLAMA_MODERATION_MODEL=llama-guard3:1b
```

Save: **Ctrl+O → Enter → Ctrl+X**

### B.3 Pull the code, build, restart

```
cd /opt/platform
git pull
docker compose up -d --build
```

The first `up` will:
- Pull `ollama/ollama:latest` (~1 GB)
- Build your platform image
- Start both containers

This takes ~5 minutes.

### B.4 Pull the models inside the Ollama container

The Ollama image starts with no models. Pull them:

**Required:**
```
docker exec -it platform-ollama-1 ollama pull qwen2.5:3b
docker exec -it platform-ollama-1 ollama pull llama-guard3:1b
```

**Optional, for the model picker:**
```
docker exec -it platform-ollama-1 ollama pull deepseek-r1:7b
docker exec -it platform-ollama-1 ollama pull qwen2.5vl:3b
```

The container name might be different — check with `docker compose ps`. Each pull takes 5-30 minutes depending on network and model size.

After pulling, the models persist in the `ollama_models` volume — they survive container rebuilds.

Verify what got installed:
```
docker exec platform-ollama-1 ollama list
```
The platform's model picker reads this list dynamically and only shows users the models that are actually installed.

### B.5 Verify

```
docker exec platform-ollama-1 ollama list
```

Should show both models.

```
docker compose logs platform --tail 20
```

Should see normal startup, no errors about Ollama.

### B.6 Test in browser

Visit https://rasmwaqalam.com — landing page should load. Log in, try the AI features. First request takes ~10-30 seconds (model loads into RAM). Later requests are 3-10 seconds.

---

## Resource use to expect on your KVM 2 VPS

| Idle | Active generation |
|---|---|
| Ollama: ~50 MB RAM, 0% CPU | Ollama: 3-5 GB RAM, ~100% CPU per core during inference |
| Platform: ~150 MB | Platform: ~200 MB |
| n8n + Traefik: ~250 MB | (no change) |

Total at peak: ~5-6 GB. KVM 2 has 8 GB, so headroom is OK.

If multiple users generate at the same time, you'll queue up. The Bull-less in-process queue caps concurrent jobs to 4. Generation latency grows linearly with queue depth.

---

## Troubleshooting

### "MODERATION_UNAVAILABLE" 503 from API

Either Ollama isn't reachable or a model isn't installed. Check:

```
# Is the container alive?
docker compose ps

# Are the models installed?
docker exec platform-ollama-1 ollama list

# Can the platform reach Ollama?
docker exec platform-platform-1 wget -qO- http://ollama:11434/api/tags
```

### "Cannot connect to Ollama" in platform logs

The platform can't reach `http://ollama:11434`. Most likely cause: the two containers aren't on the same Docker network. Check:

```
docker network inspect root_default | grep -A 2 Containers
```

Both `platform-platform-1` and `platform-ollama-1` should appear.

### Generation is very slow (>60 seconds per response)

Expected on CPU-only VPS. Three things you can do:

1. Use the smaller models (you're already on the 3B/1B tier)
2. Add swap: `fallocate -l 4G /swapfile; chmod 600 /swapfile; mkswap /swapfile; swapon /swapfile`
3. Upgrade to a Hostinger plan with more cores / RAM

### Pulling models fills the disk

KVM 2 has 80 GB SSD; the two models use ~3 GB. You have plenty of room. If you ever experiment with larger models (7B+), check disk before pulling — `df -h`.
