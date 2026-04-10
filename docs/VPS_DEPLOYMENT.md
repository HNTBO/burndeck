# BurnDeck Deploy Guide

This guide now reflects the verified BurnDeck VPS setup as of 2026-04-10.

## Verified Live Shape

- private personal app
- self-hosted on the VPS
- Docker deployment in `/var/www/burndeck`
- BurnDeck container listening on `6409`
- Nginx reverse proxy in front of the container
- Nginx basic auth in front of the app
- HTTPS enforced at the Nginx layer
- OpenAI admin key stored only on the server

The earlier version of this doc assumed wildcard TLS was already handling everything at the VPS level. That was misleading.

What was actually verified:

- `burndeck.fmotion.fr` resolves to the VPS IP
- BurnDeck is healthy internally at `http://127.0.0.1:6409/api/health`
- Nginx must have an explicit BurnDeck site config and an enabled symlink in `/etc/nginx/sites-enabled`
- requests fall through to the VPS default `444` server if the BurnDeck site is missing or not enabled
- the live HTTPS setup should follow the same per-subdomain certificate pattern used by other services on this VPS unless wildcard coverage has been separately verified

## Intended Production Characteristics

- private personal app
- self-hosted on the VPS
- Docker deployment
- Nginx reverse proxy
- Nginx basic auth in front of the app
- OpenAI admin key stored only on the server

## Current Deployment Shape

BurnDeck currently ships as one containerized Node app:

- the server serves the built frontend from `dist/`
- the same server exposes the backend API
- production traffic is intended to be same-origin behind Nginx

Current runtime endpoints:

- `GET /api/health`
- `POST /api/refresh/openai`

## Prerequisites

Make sure the VPS already has:

- Docker and Docker Compose available
- Nginx installed and running
- `/etc/nginx/.htpasswd` available for basic auth
- a target app path such as `/var/www/burndeck`

Also make sure:

- `burndeck.fmotion.fr` resolves to the VPS IP
- an Nginx site file exists for BurnDeck
- that site file is enabled in `/etc/nginx/sites-enabled`
- TLS material exists for the chosen public hostname

## Environment

Create `.env` next to [docker-compose.yml](/Users/fred/Documents/dev/BurnDeck/docker-compose.yml):

```env
PORT=6409
OPENAI_ADMIN_KEY=your_openai_admin_key
OPENAI_ORGANIZATION_ID=
OPENAI_PROJECT_ID=
VITE_BURNDECK_API_BASE_URL=
CORS_ORIGIN=https://burndeck.fmotion.fr
```

Notes:

- `OPENAI_ADMIN_KEY` is required for the OpenAI refresh route.
- `OPENAI_ORGANIZATION_ID` is optional.
- Leave `OPENAI_PROJECT_ID` empty if you want BurnDeck to read totals for the whole OpenAI organization by default.
- `OPENAI_PROJECT_ID` is now a server-wide fallback for OpenAI API accounts that do not have a project ID set in the BurnDeck UI.
- A specific BurnDeck OpenAI API account can now carry its own OpenAI project ID and override the server fallback.
- Leave `VITE_BURNDECK_API_BASE_URL` empty in production so the frontend uses same-origin requests through Nginx.
- Set `CORS_ORIGIN` to the final production origin even if same-origin is expected.

## First Deploy

Example VPS deploy flow:

```bash
cd /var/www
git clone <your-burndeck-repo-url> burndeck
cd /var/www/burndeck
cp .env.example .env
# edit .env
docker compose up -d --build
```

Current container port mapping:

- VPS host `6409` -> container `6409`

Useful checks:

```bash
docker ps
docker compose logs -f
curl http://127.0.0.1:6409/api/health
```

Expected health response shape:

```json
{
  "ok": true,
  "openAIConfigured": true
}
```

If `openAIConfigured` is `false`, the container started but the OpenAI admin key is missing.

## Nginx

Verified pattern for `burndeck.fmotion.fr`:

```nginx
server {
    listen 80;
    server_name burndeck.fmotion.fr;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name burndeck.fmotion.fr;

    ssl_certificate /etc/letsencrypt/live/burndeck.fmotion.fr/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/burndeck.fmotion.fr/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    auth_basic "Restricted";
    auth_basic_user_file /etc/nginx/.htpasswd;

    location / {
        proxy_pass http://127.0.0.1:6409;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable and reload:

```bash
sudo ln -s /etc/nginx/sites-available/burndeck /etc/nginx/sites-enabled/burndeck
sudo nginx -t
sudo systemctl reload nginx
```

If the BurnDeck site is not enabled, requests for `burndeck.fmotion.fr` will fall through to the VPS default server and can show `curl: (52) Empty reply from server` because that default config returns `444`.

## Verification After Deploy

1. Open `https://burndeck.fmotion.fr` and confirm basic auth is enforced.
2. Confirm the app loads and existing accounts render.
3. Confirm `https://burndeck.fmotion.fr/api/health` returns `ok: true`.
4. Trigger `Refresh all` or one OpenAI account refresh.
5. Confirm the OpenAI account updates without exposing any API key in the browser.

## Ongoing Update Flow

For a normal update:

```bash
cd /var/www/burndeck
git pull
docker compose up -d --build
```

Then verify:

```bash
docker compose logs --tail=100
curl http://127.0.0.1:6409/api/health
```

## Current Scope And Limitations

- OpenAI refresh currently targets OpenAI API accounts through the server route.
- The server currently reads org-level cost and completions usage data over the last 30 days, unless the specific account or the server fallback provides an OpenAI project ID.
- OpenAI API accounts can now be scoped per account with an optional project ID in the BurnDeck UI.
- Anthropic and Google AI refreshes are not implemented yet.
- Unsupported or manual-only subscriptions still rely on the manual path.

## Current Verified VPS State

As of 2026-04-10, the following was confirmed live:

- Docker container built and started successfully on the VPS
- BurnDeck server is listening on `0.0.0.0:6409`
- `curl http://127.0.0.1:6409/api/health` returns `{"ok":true,"openAIConfigured":true}`
- DNS for `burndeck.fmotion.fr` resolves to the VPS IP
- Nginx now routes `burndeck.fmotion.fr` correctly
- HTTP redirects to HTTPS
- HTTPS returns `401 Authorization Required` before login, confirming basic auth is active
