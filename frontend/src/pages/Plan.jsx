import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { DollarInput, Field, Icon, Notice, PaceTag, Panel } from "../components/ui.jsx";
import { dollarsText, fmtDate, money, parseDollars, todayPlus } from "../lib/format.js";
import { useAction } from "../lib/hooks.js";
import { useGroup } from "./GroupLayout.jsx";

function MyPlan({ id, group, me, totals, reload }) {
  const [target, setTarget] = useState(dollarsText(me.personal_target_cents));
  const { busy, error, run } = useAction();
  const cents = parseDollars(target);
  const locked = !["active", "target_reached"].includes(group.status);
  const save = (body) => run(async () => { await api.editMembership(id, body); await reload(); });

  return (
    <Panel title="Your plan" icon="user-circle">
      <div className="mb-4 flex items-center gap-3 text-sm text-muted"><PaceTag pace={me.pace} /><span className="num">{money(me.recorded_cents)} recorded of {money(me.personal_target_cents)}</span></div>
      <form className="max-w-xs space-y-3" onSubmit={(e) => { e.preventDefault(); save({ personal_target_cents: cents }); }}>
        <Field label="Personal target" htmlFor="pt" error={error?.field === "personal_target_cents" ? error.message : null}
          hint={me.weekly_cents > 0 && group.status === "active" ? `About ${money(me.weekly_cents)} a week reaches it by the deadline. That's a guide, not a requirement.` : null}>
          <DollarInput id="pt" value={target} onChange={setTarget} disabled={locked} />
        </Field>
        <button className="btn btn-secondary btn-sm" disabled={busy || locked || !cents || cents === me.personal_target_cents}>Save target</button>
      </form>
      {error && !error.field && <Notice tone="error" className="mt-3">{error.message}</Notice>}
      <div className="mt-5 flex flex-wrap gap-4 border-t border-line pt-4">
        <button className="btn btn-secondary btn-sm" disabled={busy || locked} onClick={() => save({ status: me.status === "paused" ? "active" : "paused" })}>
          <Icon name={me.status === "paused" ? "play-circle" : "pause-circle"} />
          {me.status === "paused" ? "Resume my plan" : "Pause my plan"}
        </button>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-[#1B4A58]" checked={me.reminders_opt_in} disabled={busy}
            onChange={(e) => save({ reminders_opt_in: e.target.checked })} />
          I'm happy to receive gentle reminders ({totals.reminder_opt_ins} opted in)
        </label>
      </div>
    </Panel>
  );
}

function OwnerEdit({ id, group, totals, members, reload }) {
  const [deadline, setDeadline] = useState(group.deadline);
  const [target, setTarget] = useState(dollarsText(group.target_cents));
  const { busy, error, run } = useAction();
  const cents = parseDollars(target);
  const others = members.length > 1;
  return (
    <Panel title="Group settings" icon="cog">
      <p className="mb-3 text-sm text-muted">{others ? "Others have joined, so you can only extend the deadline or lower the target." : "You can change these freely until someone joins."}</p>
      <form className="grid max-w-md gap-4 sm:grid-cols-2" onSubmit={(e) => {
        e.preventDefault();
        run(async () => { await api.editGroup(id, { deadline, target_cents: cents }); await reload(); });
      }}>
        <Field label="Deadline" htmlFor="dl" error={error?.field === "deadline" ? error.message : null}>
          <input id="dl" type="date" className="input" value={deadline} min={others ? group.deadline : todayPlus(1)} onChange={(e) => setDeadline(e.target.value)} />
        </Field>
        <Field label="Target total" htmlFor="tg" error={error?.field === "target_cents" ? error.message : null}>
          <DollarInput id="tg" value={target} onChange={setTarget} />
        </Field>
        <div className="sm:col-span-2">
          <button className="btn btn-secondary btn-sm" disabled={busy || !cents || (deadline === group.deadline && cents === group.target_cents)}>Save changes</button>
          {error && !error.field && <p className="mt-2 text-sm text-danger">{error.message}</p>}
        </div>
      </form>
    </Panel>
  );
}

function Leave({ id, group }) {
  const nav = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const { busy, error, run } = useAction();
  if (group.status === "purchase_simulated") return null;
  return (
    <Panel title="Leave this group" icon="door-open">
      <p className="text-sm text-muted">Leaving is free. Contributions recorded under your name are released and stop counting toward the total.</p>
      {!confirm ? (
        <button className="btn btn-danger btn-sm mt-3" onClick={() => setConfirm(true)}>Leave group</button>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">Leave {group.name}?</span>
          <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => run(async () => { await api.leave(id); nav("/groups"); })}>Yes, leave</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setConfirm(false)}>Stay</button>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-danger">{error.message}</p>}
    </Panel>
  );
}

export default function Plan() {
  const { data, reload } = useGroup();
  const { group, me, totals, members } = data;
  const isOwner = group.owner_id === me.user_id;
  return (
    <div className="max-w-3xl space-y-6">
      <Panel title="Goal details" icon="bullseye">
        <dl className="grid max-w-lg grid-cols-2 gap-y-2.5 text-sm">
          <dt className="text-muted">Purchase</dt><dd className="font-semibold">{group.goal_title}</dd>
          <dt className="text-muted">Items</dt><dd className="num font-semibold">{group.quantity}</dd>
          <dt className="text-muted">Target</dt><dd className="num font-semibold">{money(group.target_cents)}</dd>
          <dt className="text-muted">Deadline</dt><dd className="font-semibold">{fmtDate(group.deadline)}</dd>
          <dt className="text-muted">Group size</dt><dd className="num font-semibold">{members.length} of {group.group_size}</dd>
          <dt className="text-muted">Currency</dt><dd className="font-semibold">{group.currency} (Sandbox test money)</dd>
        </dl>
        {group.description && <p className="mt-3 text-sm text-muted">{group.description}</p>}
      </Panel>

      <Panel title="Rules everyone agreed to" icon="balance-scale">
        <div className="space-y-3 text-sm">
          <p><span className="font-semibold">If the target isn't reached. </span>{group.rules_missed_target}</p>
          <p><span className="font-semibold">Leaving or pausing. </span>{group.rules_exit}</p>
          <p><span className="font-semibold">About the money. </span>This prototype never holds, pools, lends or transfers real funds. Payments are PayPal Sandbox tests and balances are a simulated ledger.</p>
        </div>
      </Panel>

      <MyPlan id={group.id} group={group} me={me} totals={totals} reload={reload} />
      {isOwner && ["active", "target_reached"].includes(group.status) && <OwnerEdit id={group.id} group={group} totals={totals} members={members} reload={reload} />}
      <Leave id={group.id} group={group} />
    </div>
  );
}
