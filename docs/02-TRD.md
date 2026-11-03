# 2. Technical Requirements (TRD)

## Stack
React + Vite + Tailwind CSS (client) | Python + Flask (API) | PostgreSQL via SQLAlchemy | PayPal REST v2 Sandbox | Anthropic Messages API | Render (Docker web service + managed Postgres).

## Architecture
Browser -> Flask API -> PostgreSQL. Flask talks to PayPal and the AI provider. One deployable: Flask serves the built client and `/api/*` from the same origin (no CORS, no hard-coded hosts or ports; the client calls relative `/api` URLs).

## Rules for the code
- Money is stored and transmitted as integer cents. All arithmetic (totals, percentages, milestones, schedules, adjustment options) is plain backend code.
- Secrets only in environment variables. Only the public PayPal client ID reaches the browser.
- Sessions are signed, HTTP-only, SameSite=Lax cookies. Mutating routes require a JSON content type.
- Every group route checks membership; non-members get 404. Owner-only actions are checked on the server.
- Inputs validated on the server; errors returned as `{error:{code,message,field}}`.

## PayPal flow (Sandbox only)
1. Client asks `POST /api/groups/:id/orders` with an amount. Server validates, stores a `pending` contribution, creates a PayPal order (custom_id = contribution id) and returns the order id.
2. PayPal JS buttons let the member approve.
3. Client calls `POST /api/orders/:order_id/capture`. Server row-locks the contribution, captures with an idempotency key, then checks order status, custom_id, currency and amount against its own record.
4. Only a verified `COMPLETED` capture becomes `completed` in the ledger. `PENDING` stays pending (re-check with `/refresh`). Declined/failed, cancelled, duplicate and mismatched results are handled without double counting.
The API base URL is fixed to the Sandbox host; live mode is not supported.

## AI flow
Backend builds a minimal facts object (aggregates plus the caller's own numbers), asks the model for JSON only, validates it with Pydantic, and renders it as plain text. The model picks checkpoint percentages and wording; the backend turns them into amounts and dates. If the key is missing, the call fails, or validation fails, a deterministic fallback is returned and labelled as such. AI output is a suggestion; humans click to apply.

## Environment variables
See `.env.example`: DATABASE_URL, SECRET_KEY, APP_ENV, PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, ANTHROPIC_API_KEY, ANTHROPIC_MODEL, SEED_DEMO_DATA.

## Deployment
Dockerfile (multi-stage: build client, run gunicorn) and `render.yaml` (web service + Postgres). Tables are created on start; demo data seeds when the database is empty.
