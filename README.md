# BurnDeck

BurnDeck is a self-hosted dashboard for tracking AI subscriptions, API usage, OAuth quotas, and spend across providers.

The project is built for a private personal workflow rather than a SaaS product:

- local-first account data in the browser
- optional server-assisted provider refreshes
- lightweight React frontend
- small Node backend for secret-backed integrations
- Docker-friendly deployment to a VPS behind Nginx

## Current Scope

BurnDeck currently supports:

- creating, editing, deleting, exporting, and importing tracked accounts
- local persistence via `localStorage`
- manual refresh metadata such as sync status and last refresh time
- a backend-assisted OpenAI refresh path
- a single containerized deployment shape for VPS hosting

Planned next steps are finishing live OpenAI validation in production and then deciding which additional providers are worth automating.

## Stack

- React 19
- TypeScript
- Vite
- Node.js HTTP server
- Docker / Docker Compose

## Local Development

Install dependencies:

```bash
npm install
```

Run the frontend in development mode:

```bash
npm run dev
```

Build client and server:

```bash
npm run build
```

Run the production server locally:

```bash
npm run start
```

The server defaults to port `6409`.

## Environment

Copy `.env.example` to `.env` and set the values you need:

```env
PORT=6409
OPENAI_ADMIN_KEY=
OPENAI_ORGANIZATION_ID=
OPENAI_PROJECT_ID=
VITE_BURNDECK_API_BASE_URL=
CORS_ORIGIN=
```

Notes:

- `OPENAI_ADMIN_KEY` is required for the OpenAI refresh route.
- Leave `VITE_BURNDECK_API_BASE_URL` empty in production if the app is served same-origin behind Nginx.

## Deployment

The intended production shape is:

- one Dockerized Node app
- Nginx reverse proxy in front
- TLS handled at the VPS
- basic auth at the Nginx layer
- provider secrets stored server-side only

See [docs/VPS_DEPLOYMENT.md](docs/VPS_DEPLOYMENT.md) for the current deploy flow.

## Status

This repository is active and deployable in principle, but the OpenAI integration still needs final validation against real production credentials after VPS deployment.
