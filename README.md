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
    ┌────┼──────────┐
    ▼    ▼          ▼
 Auth  Programs  Payments
 :5001  :5002     :5003
    └────┬──────────┘
         ▼
    PostgreSQL
```

| Service | Package | Port | Responsibility |
|---------|---------|------|----------------|
| Gateway | `@hunarbee/gateway` | 5000 | Single entry point, proxies to services |
| Auth | `@hunarbee/auth-service` | 5001 | Register, login, JWT, `/me` |
| Programs | `@hunarbee/programs-service` | 5002 | Internship program catalog |
| Payments | `@hunarbee/payments-service` | 5003 | Razorpay orders + signature verify |
| Shared | `@hunarbee/shared` | — | Env, DB, JWT utils, middleware |

## Setup

```bash
cd hunarbee-be
npm install
cp .env.example .env   # set DATABASE_URL + Razorpay keys
npm run db:migrate
npm run dev            # gateway + auth + programs + payments
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
| `GET` | `/api/payments/config` | payments-service `/config` |
| `GET` | `/api/payments/pricing` | payments-service `/pricing` |
| `POST` | `/api/payments/orders` | payments-service `/orders` |
| `GET` | `/api/payments/orders/:orderId` | payments-service `/orders/:orderId` |
| `POST` | `/api/payments/webhook` | payments-service `/webhook` |

### Payments (Razorpay)

1. **Create order** → `payments` row (`status=created`) + Razorpay Checkout  
2. **Webhook** `payment.captured` → `payments.status=paid` + `enrollments` row  
3. **Webhook** `payment.failed` → `payments.status=failed`  
4. Frontend **polls** `GET /api/payments/orders/:orderId` until paid/failed  

Client-side `/verify` is removed — webhook is the source of truth.

#### Webhook setup (Razorpay Dashboard)

1. Account & Settings → Webhooks → Add New Webhook  
2. URL: `https://YOUR_PUBLIC_API/api/payments/webhook`  
3. Alert email: your ops email  
4. Active events: **`payment.captured`**, **`payment.failed`**  
5. Copy the **Webhook Secret** into `.env` as `RAZORPAY_WEBHOOK_SECRET`  
6. Local testing: use [ngrok](https://ngrok.com/) / Cloudflare Tunnel to expose gateway `:5000`

```bash
curl -X POST http://localhost:5000/api/payments/orders \
  -H "Content-Type: application/json" \
  -d '{"durationId":"3-months","currency":"INR","programId":"fullstack","applicantName":"Test User","applicantEmail":"test@example.com","applicantPhone":"+919876543210","countryIso":"IN","occupation":"student","preferredBatch":"2026-08-12"}'
```

Poll status after Checkout:

```bash
curl http://localhost:5000/api/payments/orders/order_xxxxx
```

## Scripts

- `npm run dev` — run all microservices
- `npm run dev:gateway` / `dev:auth` / `dev:programs` / `dev:payments`
- `npm run db:migrate` — migrate PostgreSQL
- `npm run build` — build all packages
