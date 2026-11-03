import { useState } from "react";
import { Link } from "react-router-dom";
import { CopyButton, Icon, MiniBar, Notice, PaceTag, PaymentTag, Panel, ProgressRuler, Tag } from "../components/ui.jsx";
import { fmtDate, fmtDateTime, money, plural } from "../lib/format.js";
import { useGroup } from "./GroupLayout.jsx";

const ONBOARD_KEY = "squadfund.onboarded";

function Onboarding() {
  const [open, setOpen] = useState(() => {
    try { return !localStorage.getItem(ONBOARD_KEY); } catch { return true; }
  });
  if (!open) return null;
  return (
    <Notice title="How this group works">
      <ul className="mt-1 list-disc space-y-1 pl-5">
        <li>Everyone picks a personal target they can afford. You can change it, pause, or leave at any time with no penalty.</li>
        <li>Contributions go through PayPal Sandbox with test money. A payment counts only after the server verifies it.</li>
        <li>The AI coach suggests; you decide. It never touches balances.</li>
      </ul>
      <button className="mt-2 font-semibold underline" onClick={() => { try { localStorage.setItem(ONBOARD_KEY, "1"); } catch { /* ignore */ } setOpen(false); }}>
        Got it
      </button>
    </Notice>
  );
}

function Members({ members, myId }) {
  return (
    <Panel title="Member progress" icon="users" pad={false}>
      <ul className="divide-y divide-line">
        {members.map((m) => (
          <li key={m.user_id} className="px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-ink-900">
                {m.display_name}
                {m.user_id === myId && <span className="ml-1.5 font-normal text-muted">(you)</span>}
                {m.role === "owner" && <span className="ml-2 align-middle"><Tag tone="ink" icon="key">Owner</Tag></span>}
              </p>
              <PaceTag pace={m.pace} />
            </div>
            <div className="mt-2 flex items-center gap-3">
              <div className="flex-1"><MiniBar percent={m.percent} /></div>
              <p className="w-44 text-right text-sm num text-muted"><span className="font-semibold text-ink-900">{money(m.recorded_cents)}</span> of {money(m.personal_target_cents)}</p>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Milestones({ milestones }) {
  const next = milestones.find((m) => m.status !== "reached");
  return (
    <Panel title="Milestones" icon="flag-checkered" pad={false}>
      <ol className="divide-y divide-line">
        {milestones.map((m) => (
          <li key={m.id} className="flex items-center gap-3 px-4 py-3">
            <Icon name={m.status === "reached" ? "check-circle" : "circle"} className={`text-xl ${m.status === "reached" ? "text-gold-500" : "text-ink-300"}`} />
            <div className="flex-1">
              <p className="font-semibold text-ink-900">{m.title}{next?.id === m.id && <span className="ml-2 align-middle"><Tag tone="ink">Next</Tag></span>}</p>
              <p className="text-sm text-muted">{m.status === "reached" ? "Reached" : `Aim for ${fmtDate(m.due_date)}`}</p>
            </div>
            <p className="text-sm font-semibold num text-ink-900">{money(m.target_cents)}</p>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

export default function Dashboard() {
  const { data } = useGroup();
  const { group, totals, members, milestones, me, recent_contributions: recent } = data;
  const saving = group.status === "active";
  const link = `${window.location.origin}/join/${group.invite_code}`;

  return (
    <div className="space-y-6">
      <Onboarding />
      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-6">
          <Panel>
            <p className="font-display text-4xl font-semibold num text-ink-900">{money(totals.recorded_cents)}</p>
            <p className="mb-5 text-muted num">
              verified of {money(totals.target_cents)}, {totals.percent}% complete. {totals.days_left > 0 ? `${plural(totals.days_left, "day", "days")} left, due ${fmtDate(group.deadline)}.` : `Deadline ${fmtDate(group.deadline)}.`}
            </p>
            <ProgressRuler percent={totals.percent} milestones={milestones} />
            <p className="mt-4 text-sm text-muted num">At an even pace the group would be at {money(totals.expected_cents)} by today.</p>
          </Panel>

          {totals.plan_shortfall_cents > 0 && saving && (
            <Notice title="Personal targets don't cover the goal yet">
              Active targets add up to {money(totals.plan_coverage_cents)}, which is {money(totals.plan_shortfall_cents)} short.
              {totals.open_spots > 0
                ? ` ${plural(totals.open_spots, "open spot", "open spots")} at about ${money(totals.per_open_spot_cents)} each would close the gap.`
                : " Members can raise their targets if they can afford to, or the owner can lower the goal."}
            </Notice>
          )}
          {group.status === "target_reached" && (
            <Notice tone="ok" title="The group reached its target">
              See the simulated supplier offers on the <Link to="offer" className="font-semibold underline">offer page</Link>.
            </Notice>
          )}

          <Members members={members} myId={me.user_id} />
          <Milestones milestones={milestones} />

          <Panel title="Recent contributions" icon="receipt" pad={false}
            action={<Link to="ledger" className="link-quiet">Full ledger</Link>}>
            {recent.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted">Nothing recorded yet. The first verified contribution will show up here.</p>
            ) : (
              <ul className="divide-y divide-line">
                {recent.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                    <span><span className="font-semibold text-ink-900">{c.display_name}</span> <span className="text-muted">{fmtDateTime(c.created_at)}</span></span>
                    <span className="flex items-center gap-3"><span className="font-semibold num">{money(c.amount_cents)}</span><PaymentTag status={c.payment_status} /></span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <aside className="space-y-4">
          <Panel title="Your plan" icon="user-circle">
            <p className="text-sm text-muted">Personal target</p>
            <p className="font-display text-2xl font-semibold num text-ink-900">{money(me.personal_target_cents)}</p>
            <p className="mt-1 text-sm text-muted num">{money(me.recorded_cents)} recorded, {money(me.remaining_cents)} to go</p>
            <div className="mt-2"><PaceTag pace={me.pace} /></div>
            {saving && me.status === "active" ? (
              <Link to="contribute" className="btn btn-primary mt-4 w-full">Contribute</Link>
            ) : (
              <p className="mt-3 text-sm text-muted">{me.status === "paused" ? "Your plan is paused. Resume it on the plan page." : "This group isn't taking contributions right now."}</p>
            )}
            <Link to="plan" className="mt-3 inline-block text-sm font-medium">Adjust or pause my plan</Link>
          </Panel>

          <Panel title="Invite members" icon="user-plus">
            <p className="text-sm text-muted">{totals.open_spots > 0 ? `${plural(totals.open_spots, "spot", "spots")} open.` : "The group is full."} Share this code or link.</p>
            <p className="mt-2 rounded border border-line bg-paper px-3 py-2 text-center font-display text-xl font-semibold tracking-wide num">{group.invite_code}</p>
            <div className="mt-3 flex gap-2">
              <CopyButton text={group.invite_code} label="Copy code" />
              <CopyButton text={link} label="Copy link" />
            </div>
          </Panel>

          <Panel title="Rules in short" icon="balance-scale">
            <ul className="space-y-1.5 text-sm text-muted">
              <li>No penalties for missed milestones.</li>
              <li>Pause, adjust or leave any time.</li>
              <li>Simulated ledger, Sandbox payments.</li>
            </ul>
            <Link to="plan" className="mt-2 inline-block text-sm font-medium">Read the full rules</Link>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
