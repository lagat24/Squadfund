# 5. Backend Schema

Money = integer cents. Times = UTC.

| Table | Columns |
|---|---|
| users | id, display_name, token_hash, created_at |
| squad_groups | id, name, goal_title, description, target_cents, currency, deadline, status (active, target_reached, purchase_simulated, closed), invite_code (unique), owner_id, group_size, quantity, rules_missed_target, rules_exit, selected_offer_id, purchased_at, created_at |
| memberships | id, group_id, user_id, personal_target_cents, status (active, paused, left), role (owner, member), reminders_opt_in, joined_at; unique(group_id, user_id) |
| contributions | id, group_id, user_id, amount_cents, currency, payment_status (pending, completed, failed, cancelled, released), source (paypal_sandbox, seed), paypal_order_id (unique), paypal_capture_id (unique), paypal_status, failure_reason, created_at, updated_at |
| milestones | id, group_id, title, due_date, target_cents (cumulative), position, status (upcoming, reached) |
| supplier_offers | id, group_id, supplier_label, description, quantity, list_total_cents, quoted_total_cents, is_simulated (always true), created_at |

## API
Auth: `POST /api/auth/session`, `POST /api/auth/resume`, `GET /api/auth/me`, `DELETE /api/auth/session`
Public: `GET /api/health`, `GET /api/config`, `GET /api/demo`, `GET /api/invites/:code`
Groups: `POST /api/groups`, `GET /api/groups`, `GET|PATCH /api/groups/:id`, `POST /api/invites/:code/join`, `PATCH /api/groups/:id/membership`, `POST /api/groups/:id/leave`, `PUT /api/groups/:id/milestones`, `GET /api/groups/:id/contributions`
Payments: `POST /api/groups/:id/orders`, `POST /api/orders/:order_id/capture`, `POST /api/orders/:order_id/cancel`, `GET /api/contributions/:id`, `POST /api/contributions/:id/refresh`
Offers: `GET /api/groups/:id/offers`, `POST /api/groups/:id/purchase`
AI: `POST /api/groups/:id/ai/{milestones,coach,update,reminder}`
