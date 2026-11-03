import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import IdentityGate from "../components/IdentityGate.jsx";
import { DollarInput, Field, Icon, Notice, Panel } from "../components/ui.jsx";
import { dollarsText, money, parseDollars, todayPlus } from "../lib/format.js";
import { useAction } from "../lib/hooks.js";

const EXAMPLE = { name: "Study Squad Laptops", goal: "6 refurbished laptops for our study group", target: "3600.00", size: "6" };

function Form() {
  const nav = useNavigate();
  const { busy, error, run } = useAction();
  const [f, setF] = useState({ name: "", goal_title: "", description: "", target: "", quantity: "", size: "4", deadline: todayPlus(56), mine: "" });
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v?.target ? v.target.value : v }));
  const targetCents = parseDollars(f.target);
  const size = parseInt(f.size, 10);
  const suggested = useMemo(() => (targetCents && size >= 2 ? Math.ceil(targetCents / size / 100) * 100 : null), [targetCents, size]);
  const errs = error?.field ? { [error.field]: error.message } : {};

  function submit(e) {
    e.preventDefault();
    run(async () => {
      const r = await api.createGroup({
        name: f.name, goal_title: f.goal_title, description: f.description,
        target_cents: targetCents, deadline: f.deadline, group_size: size,
        quantity: f.quantity ? parseInt(f.quantity, 10) : size,
        personal_target_cents: parseDollars(f.mine) ?? suggested,
      });
      nav(`/g/${r.group_id}`);
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-5">
        <Field label="Group name" htmlFor="name" error={errs.name}>
          <input id="name" className="input" value={f.name} onChange={set("name")} maxLength={80} required placeholder={EXAMPLE.name} />
        </Field>
        <Field label="What are you buying?" htmlFor="goal" error={errs.goal_title} hint="One shared purchase.">
          <input id="goal" className="input" value={f.goal_title} onChange={set("goal_title")} maxLength={120} required placeholder={EXAMPLE.goal} />
        </Field>
        <Field label="Notes for members (optional)" htmlFor="desc" error={errs.description}>
          <textarea id="desc" className="input" rows={2} value={f.description} onChange={set("description")} maxLength={500} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Target total" htmlFor="target" error={errs.target_cents} hint="Between $50 and $50,000.">
            <DollarInput id="target" value={f.target} onChange={set("target")} invalid={!!errs.target_cents} required />
          </Field>
          <Field label="Deadline" htmlFor="deadline" error={errs.deadline} hint="At least a week away.">
            <input id="deadline" type="date" className="input" value={f.deadline} min={todayPlus(7)} onChange={set("deadline")} required />
          </Field>
          <Field label="Group size" htmlFor="size" error={errs.group_size} hint="Including you.">
            <input id="size" type="number" min={2} max={30} className="input num" value={f.size} onChange={set("size")} required />
          </Field>
          <Field label="Number of items" htmlFor="qty" error={errs.quantity} hint="Used for the bulk-price comparison. Defaults to the group size.">
            <input id="qty" type="number" min={1} max={500} className="input num" value={f.quantity} onChange={set("quantity")} placeholder={f.size} />
          </Field>
        </div>
        <Field label="Your personal target" htmlFor="mine" error={errs.personal_target_cents}
          hint={suggested ? `An even split is ${money(suggested)}. Choose what you can afford; you can change it later.` : "Choose what you can afford; you can change it later."}>
          <DollarInput id="mine" value={f.mine} onChange={set("mine")} invalid={!!errs.personal_target_cents} placeholder={suggested ? dollarsText(suggested) : "0.00"} />
        </Field>
        {error && !error.field && <Notice tone="error">{error.message}</Notice>}
        <button className="btn btn-primary" disabled={busy || !targetCents}>
          {busy ? "Creating the group" : "Create group"}
          <Icon name="arrow-right" />
        </button>
      </div>
      <aside className="space-y-3 text-sm">
        <Panel title="What members will agree to" icon="balance-scale">
          <ul className="space-y-2 text-muted">
            <li>No penalties, fines or forfeits for missing a milestone.</li>
            <li>Members can pause, adjust their target, or leave, and contributions recorded under their name are released.</li>
            <li>If the target is not reached, the group can extend, lower the target, or close with everything released.</li>
          </ul>
        </Panel>
        <Notice>Default milestones at 25, 50, 75 and 100 percent are added for you. The AI coach can suggest a better schedule later.</Notice>
      </aside>
    </form>
  );
}

export default function CreateGroup() {
  return (
    <div>
      <h1 className="mb-1 text-3xl font-semibold">Start a group</h1>
      <p className="mb-6 max-w-xl text-muted">Set the goal once. You'll get an invite code to share with the people buying with you.</p>
      <IdentityGate title="First, enter your name"><Form /></IdentityGate>
    </div>
  );
}
