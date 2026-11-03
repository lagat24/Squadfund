# 6. Implementation Plan

1. Schema and config: models, env loading, error handling, validation helpers.
2. Identity and groups: sign-up, resume, create, invite preview, join, leave, edit.
3. Progress service: totals, per-member pace, milestone sync, schedules, adjustment options.
4. Contributions and PayPal Sandbox: order create, capture with verification, cancel, refresh.
5. AI service: facts builder, JSON validation, fallbacks; milestone, coach, update, reminder routes.
6. Offers and purchase: simulated offers on target reached, purchase status.
7. Seed data: example laptop group with varied progress.
8. Backend tests (API, payment verification, permissions, AI fallback and validation).
9. Client: design system, auth context, pages in screen order, PayPal buttons, AI panels.
10. Build, run tests, Docker and Render files, README.

## Done when
The success test in the PRD passes end to end with real Sandbox keys and an AI key, and the app degrades clearly (disabled checkout, labelled fallback drafts) when keys are absent.
