# BurnDeck Deploy Guide

This guide is for the chosen production shape:

- private personal app
- self-hosted on the VPS
- Docker deployment
- Nginx reverse proxy
- wildcard TLS already handled on the server
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
- wildcard TLS working for `*.fmotion.fr`
- `/etc/nginx/.htpasswd` available for basic auth
- a target app path such as `/var/www/burndeck`

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
- `OPENAI_PROJECT_ID` is optional but useful if BurnDeck should track one OpenAI project instead of the whole org.
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

Example site config for `burndeck.fmotion.fr`:

```nginx
server {
    listen 80;
    server_name burndeck.fmotion.fr;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name burndeck.fmotion.fr;

    ssl_certificate /etc/letsencrypt/live/fmotion.fr/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/fmotion.fr/privkey.pem;

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
sudo nginx -t
sudo systemctl reload nginx
```

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
- The server currently reads org-level cost and completions usage data over the last 30 days.
- Anthropic and Google AI refreshes are not implemented yet.
- Unsupported or manual-only subscriptions still rely on the manual path.
