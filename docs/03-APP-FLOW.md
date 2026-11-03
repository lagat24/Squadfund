# 3. App Flow

## Screens
1. Landing: what it does, how it works, ground rules, example group snapshot.
2. Your groups: groups you belong to, start a group, join with a code.
3. Start a group: name, purchase, items, target, deadline, group size, your target.
4. Join a group: enter code, read rules, pick an affordable target, accept, join.
5. Group dashboard: progress ruler, members, milestones, recent contributions, invite code.
6. Plan and rules: goal details, rules, your plan (target, pause, reminders opt-in, leave), owner edits.
7. Contribute: amount, Sandbox disclosure, PayPal buttons.
8. Payment result: verified, pending, failed or cancelled, with identifiers.
9. Ledger: all contributions with status.
10. AI coach: progress coach, milestone plan, group update, reminder draft.
11. Offer and purchase: simulated bulk offers, choose one, final status summary.

## Main journey
Landing -> enter name -> start group (dashboard with default milestones) -> share invite code -> second person enters name -> join page shows rules -> joins -> dashboard shows both -> Contribute -> PayPal approve -> server verifies -> payment result -> ledger and progress update -> AI coach -> target reached -> simulated offers -> choose offer -> purchase status (simulated).

## Edge flows
- Not signed in: pages that need a name show a name field in place.
- Group full, closed, or already joined: join page explains and links onward.
- Payment cancelled: contribution marked cancelled, nothing recorded.
- Payment pending: shown as pending, "Check status" re-queries PayPal.
- Capture fails or does not match: marked failed with a reason, nothing recorded.
- Leave: contributions are released (excluded from totals), ownership passes on if needed.
