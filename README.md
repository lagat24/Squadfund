# SquadFund

Small groups save toward one shared purchase, stay accountable to realistic milestones, and compare bulk prices once the target is reached. Hackathon prototype: payments use **PayPal Sandbox**, the ledger is **simulated**, and supplier offers are **demo data**. SquadFund never holds real funds.

Stack: React + Vite + Tailwind, Flask, PostgreSQL (SQLAlchemy), PayPal REST v2 Sandbox, Anthropic Messages API, Render. Icons are Icons8 Line Awesome.

Planning documents (PRD, TRD, app flow, UI/UX brief, schema, implementation plan) are in [`docs/`](docs).

## Run it

You need Python 3.11+, Node 20+, and a PostgreSQL connection string.

1. Copy `.env.example` to `.env` (repo root or `backend/`) and fill in `DATABASE_URL` and `SECRET_KEY`. The PayPal and AI keys can wait; the app tells you clearly what is switched off.
2. Build the client (outputs into `backend/static`):
   ```
   cd frontend
   npm install
   npm run build
   ```
3. Start the server:
   ```
   cd backend
   pip install -r requirements.txt
   flask --app wsgi run
   ```
   Flask prints the address it is listening on. The client calls relative `/api` URLs, so nothing is hard-coded to a host or port. On Linux or macOS you can use `gunicorn -c gunicorn.conf.py wsgi:app` instead.

Tables are created on start and the example group is seeded (invite code `DEMO-SQUAD`).

For hot reload while editing the client, put `VITE_DEV_API_TARGET=<address of your running API>` in `frontend/.env` and run `npm run dev`.

## Add your keys

| Variable | Where to get it | Without it |
|---|---|---|
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | developer.paypal.com > Apps & Credentials > **Sandbox** > create an app | Checkout is disabled with an explanation |
| `ANTHROPIC_API_KEY` (`ANTHROPIC_MODEL`) | console.anthropic.com | AI tools return labelled rule-based drafts |

For payments, log in at the PayPal popup with a **Sandbox personal (buyer) test account** from the developer dashboard. The API base is fixed to the Sandbox host; live mode is not supported.

## Deploy on Render

Push the repo, then in Render choose **New > Blueprint** and point it at `render.yaml`. It creates the Postgres database and a Docker web service. Add `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` and `ANTHROPIC_API_KEY` in the service's environment tab. Check the plan names in `render.yaml` against what Render currently offers.

## Try the success test

1. Open the app, enter a name (for example Ada), and **Start a group**. Copy the invite code from the dashboard.
2. Use the name menu, **Join as someone else**, enter a second name, then **Join with a code** and paste it. The rules appear before you can join.
3. On **Contribute**, pay a small amount through PayPal Sandbox. The server captures and verifies it, then the result page shows the PayPal capture id. The ledger and progress update.
4. Open **AI coach** and ask for a recommendation.

Or use the seeded example: join `DEMO-SQUAD`. It has realistic progress, one member with room to catch up, and a cancelled payment in the ledger.

## How it is put together

- **Money** is integer cents everywhere. Totals, percentages, milestone amounts and dates, weekly guides and adjustment options are plain code in `backend/app/services/progress.py`.
- **Payments**: the server creates the PayPal order and stores a pending contribution. After approval it captures with an idempotency key and checks order status, custom id, currency and amount against its own record. Only a verified `COMPLETED` capture counts. Pending, declined, cancelled, duplicate and mismatched results are handled without double counting. `Check status` re-queries PayPal for pending ones.
- **AI** gets a small facts object, must return JSON that passes Pydantic validation, and its text is shown as plain text. It chooses checkpoint percentages and wording; it can only pick among options the backend calculated. On any failure a deterministic fallback is returned and labelled. People click to apply anything.
- **Fairness**: no penalties, pause, change target or leave any time (contributions are released on leaving), target can only be lowered and deadline only extended once others join, rules are shown before joining.
- **Access**: signed HTTP-only cookies, JSON-only mutations, membership checks on every group route (non-members get 404), owner-only actions enforced on the server, small per-user limit on AI calls.

## Tests

```
cd backend
pip install -r requirements-dev.txt
python -m pytest
```

Covers identity, validation, joining, permissions, the PayPal flow with a fake client (verification, duplicates, mismatch, pending, decline, cancel, refresh), offers and the simulated purchase, leaving, fair edits, and AI validation and fallbacks.

## Known limits (prototype)

- Demo identity is a display name with a saved resume token in the browser. There is no password or email, so do not treat it as real authentication.
- Tables are created with `create_all`; there are no migrations yet.
- The AI rate limiter is in-process. Use a shared store if you run many instances.
- No PayPal webhooks; pending payments are re-checked on demand.
- No Content-Security-Policy header is set, to avoid breaking the PayPal SDK.
- Reminders are drafts to copy; nothing is sent from the app.
- Single currency (USD).
