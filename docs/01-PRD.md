# 1. Product Requirements (PRD)

**Product:** SquadFund. Small groups save toward one shared purchase, stay accountable to realistic milestones, and compare bulk prices once the target is reached.

## Problem
People abandon savings goals, buy alone at higher prices, or buy on impulse. Savings tools rarely combine social accountability with collective buying.

## Users and first use case
Friends, classmates, colleagues or community groups planning one purchase together. The demo goal is a group buying several laptops. SquadFund is not a general savings, shopping or finance platform.

## MVP scope (must build)
- Demo identity (display name) and group creation or joining by invite code.
- One active goal per group: target, deadline, group size, personal contribution targets.
- Dashboard: target, amount recorded, percent complete, member progress, milestones.
- Contribution history: member, amount, date, payment status.
- PayPal Sandbox checkout with server-side order creation and capture verification.
- AI: milestone planner, progress coach, group update writer, opt-in reminder drafter.
- Clearly labelled simulated supplier offers and a final purchase status screen.
- Validation, loading and error states, short onboarding.

## Money and fairness rules (non-negotiable)
- No penalties, fines, forfeiture or shaming for missing a milestone.
- Members can pause, change their target, or leave. Leaving releases their recorded contributions.
- No compulsory deposits, no pressure to give more than someone can afford.
- The prototype never holds, pools, lends, invests or transfers real funds. Ledger is simulated; PayPal is Sandbox only.
- Simulated balances, quotes, discounts and orders are never described as real.
- Members see contribution rules, exit conditions and the "target not reached" outcome before joining.
- AI never decides payment outcomes, changes balances, penalises members or promises anything.

## Out of scope
Real custody, real supplier negotiation, automatic purchasing, loans, credit scoring, investments, penalties, identity verification, mobile apps, multiple currencies, public marketplace, chat or social feed.

## Success test
A judge can create a group, join it as another member, complete a Sandbox payment, see the verified contribution in the ledger, and receive an AI progress recommendation.
