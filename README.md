# Hunarbee Backend — Microservices

Monorepo with **one shared `node_modules`**. All public traffic goes through the **API Gateway**.

## Architecture

```
Client (frontend)
       │
       ▼
┌──────────────────┐
│  API Gateway     │  :5000
│  @hunarbee/gateway
└────────┬─────────┘
         │
    ┌────┴─────┐
    ▼          ▼
┌─────────┐  ┌──────────────────┐
│  Auth   │  │  Programs        │
│  :5001  │  │  :5002           │
└────┬────┘  └──────────────────┘
     ▼
 PostgreSQL
```

| Service | Package | Port | Responsibility |
|---------|---------|------|----------------|
| Gateway | `@hunarbee/gateway` | 5000 | Single entry point, proxies to services |
| Auth | `@hunarbee/auth-service` | 5001 | Register, login, JWT, `/me` |
| Programs | `@hunarbee/programs-service` | 5002 | Internship program catalog |
| Shared | `@hunarbee/shared` | — | Env, DB, JWT utils, middleware |

## Folder structure

```
hunarbee-be/
  package.json              # workspaces root (single node_modules)
  .env
  packages/
    shared/                 # shared library
  services/
    gateway/
    auth-service/
    programs-service/
```

## Setup

```bash
cd hunarbee-be
npm install
cp .env.example .env   # then set DATABASE_URL
npm run db:migrate
npm run dev            # starts gateway + auth + programs
```

Public API base: `http://localhost:5000/api`

## Gateway routes

| Method | Gateway path | Proxied to |
|--------|--------------|------------|
| `GET` | `/api/health` | Gateway itself |
| `POST` | `/api/auth/register` | auth-service `/register` |
| `POST` | `/api/auth/login` | auth-service `/login` |
| `GET` | `/api/auth/me` | auth-service `/me` |
| `GET` | `/api/programs` | programs-service `/` |
| `GET` | `/api/programs/:id` | programs-service `/:id` |

## Scripts

- `npm run dev` — run all microservices
- `npm run dev:gateway` / `dev:auth` / `dev:programs` — run one service
- `npm run db:migrate` — migrate PostgreSQL
- `npm run build` — build all packages
