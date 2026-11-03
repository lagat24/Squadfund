import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { CopyButton, Icon, Notice, PaceTag, Panel, Skeleton, Tag } from "../components/ui.jsx";
import { fmtDate, money } from "../lib/format.js";
import { useAction } from "../lib/hooks.js";
import { useGroup } from "./GroupLayout.jsx";

function Source({ r }) {
  if (r.source === "ai") return <Tag tone="ink" icon="magic">AI draft</Tag>;
  const why = /not configured/i.test(r.fallback_reason || "")
    ? "AI isn't set up on this server yet, so this draft comes from fixed rules."
    : "The AI didn't return a usable answer, so this draft comes from fixed rules.";
  return (
    <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
      <Tag icon="cogs">Rule-based draft</Tag> {why}
    </p>
  );
}

// Calls an AI endpoint, shows loading and errors, and renders the validated result.
function Runner({ intro, label, icon = "magic", call, children }) {
  const [result, setResult] = useState(null);
  const { busy, error, run } = useAction();
  return (
    <div>
      <p className="mb-4 max-w-xl text-sm text-muted">{intro}</p>
      <button className="btn btn-primary" disabled={busy} onClick={() => run(async () => setResult(await call()))}>
        <Icon name={icon} /> {busy ? "Working on it" : result ? "Generate again" : label}
      </button>
      {error && <Notice tone="error" className="mt-4">{error.message}</Notice>}
      {busy && !result && <div className="mt-5 space-y-2"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-5 w-full" /><Skeleton className="h-5 w-4/5" /></div>}
      {result && <div className={`mt-5 space-y-4 ${busy ? "opacity-60" : ""}`}><Source r={result} />{children(result)}</div>}
    </div>
  );
}

function CoachTab({ data, reload }) {
  const { group, me } = data;
  const isOwner = group.owner_id === me.user_id;
  const apply = useAction();
  const [done, setDone] = useState({});
  const act = (key, fn) => apply.run(async () => { await fn(); await reload(); setDone((d) => ({ ...d, [key]: true })); });
  return (
    <Runner label="Ask the coach" icon="lightbulb" call={() => api.aiCoach(group.id)}
      intro="The coach looks at your own progress and the group's pace, then suggests options. You choose what to do. It never changes a balance or a payment.">
      {(r) => (
        <>
          <div className="flex items-center gap-3"><PaceTag pace={r.pace} /></div>
          <p className="max-w-2xl text-ink-900">{r.summary}</p>
          <ul className="divide-y divide-line rounded-md border border-line">
            {r.recommendations.map((rec, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="max-w-lg">
                  <p className="text-[13px] font-medium text-muted">{{ keep_going: "Keep going", smaller_steps: "Smaller steps", lower_personal_target: "Lower your target", extend_deadline: "Extend the deadline" }[rec.action]}</p>
                  <p className="text-sm text-ink-900">{rec.message}</p>
                </div>
                {rec.action === "lower_personal_target" && r.options.lower_personal_target && (
                  done.lower ? <Tag tone="ok" icon="check">Target updated</Tag> :
                  <button className="btn btn-secondary btn-sm" disabled={apply.busy} onClick={() => act("lower", () => api.editMembership(group.id, { personal_target_cents: r.options.lower_personal_target.suggested_cents }))}>
                    Set my target to {money(r.options.lower_personal_target.suggested_cents)}
                  </button>
                )}
                {rec.action === "extend_deadline" && r.options.extend_deadline && (isOwner ? (
                  done.extend ? <Tag tone="ok" icon="check">Deadline extended</Tag> :
                  <button className="btn btn-secondary btn-sm" disabled={apply.busy} onClick={() => act("extend", () => api.editGroup(group.id, { deadline: r.options.extend_deadline.suggested_date }))}>
                    Extend to {fmtDate(r.options.extend_deadline.suggested_date)}
                  </button>
                ) : <span className="text-[13px] text-muted">Only the owner can change the deadline.</span>)}
                {rec.action === "smaller_steps" && r.options.smaller_steps && (
                  <Link to="../contribute" className="btn btn-secondary btn-sm">Contribute {money(r.options.smaller_steps.step_cents)}</Link>
                )}
              </li>
            ))}
          </ul>
          {apply.error && <Notice tone="error">{apply.error.message}</Notice>}
        </>
      )}
    </Runner>
  );
}

function MilestonesTab({ data, reload }) {
  const { group, me } = data;
  const isOwner = group.owner_id === me.user_id;
  const apply = useAction();
  const [applied, setApplied] = useState(false);
  return (
    <Runner label="Suggest milestones" icon="flag-checkered" call={async () => { setApplied(false); return api.aiMilestones(group.id); }}
      intro="Suggests checkpoints between where the group is now and the deadline, plus a weekly guide for each member based on their own target. Amounts and dates are calculated by the app.">
      {(r) => (
        <>
          <p className="max-w-2xl text-sm text-ink-900">{r.rationale}</p>
          <ol className="divide-y divide-line rounded-md border border-line">
            {r.milestones.map((m, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div>
                  <p className="font-semibold text-ink-900">{m.title}</p>
                  <p className="text-sm text-muted">{m.note ? `${m.note} ` : ""}Aim for {fmtDate(m.due_date)}.</p>
                </div>
                <p className="text-right text-sm num"><span className="font-semibold text-ink-900">{money(m.target_cents)}</span><br /><span className="text-muted">{m.percent}%</span></p>
              </li>
            ))}
          </ol>
          {r.plan_shortfall_cents > 0 && <Notice>Members' personal targets are {money(r.plan_shortfall_cents)} short of the goal. Open spots or higher targets would close that.</Notice>}
          <div>
            <h3 className="mb-2 text-base font-semibold">Weekly guide, {r.schedule.weeks_left} {r.schedule.weeks_left === 1 ? "week" : "weeks"} left</h3>
            <div className="overflow-x-auto rounded-md border border-line">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead className="border-b border-line text-muted"><tr><th className="px-4 py-2 font-medium">Member</th><th className="px-4 py-2 text-right font-medium">Still to go</th><th className="px-4 py-2 text-right font-medium">A week</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {r.schedule.members.map((m) => (
                    <tr key={m.user_id}><td className="px-4 py-2">{m.display_name}{m.status === "paused" && <span className="ml-2 text-muted">(paused)</span>}</td>
                      <td className="px-4 py-2 text-right num">{money(m.remaining_cents)}</td><td className="px-4 py-2 text-right num">{m.status === "paused" ? "None" : money(m.weekly_cents)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[13px] text-muted">A guide to spread things out, not a requirement.</p>
          </div>
          {isOwner ? (
            applied ? <Tag tone="ok" icon="check">Milestones updated</Tag> : (
              <button className="btn btn-secondary" disabled={apply.busy}
                onClick={() => apply.run(async () => { await api.setMilestones(group.id, r.milestones.map((m) => ({ title: m.title, percent: m.percent }))); await reload(); setApplied(true); })}>
                Use these milestones
              </button>
            )
          ) : <p className="text-sm text-muted">The group owner can apply these milestones.</p>}
          {apply.error && <Notice tone="error">{apply.error.message}</Notice>}
        </>
      )}
    </Runner>
  );
}

function TextBox({ initial }) {
  const [text, setText] = useState(initial);
  return (
    <div className="space-y-2">
      <label className="sr-only" htmlFor="draft">Draft text</label>
      <textarea id="draft" className="input" rows={6} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="flex flex-wrap items-center gap-3"><CopyButton text={text} label="Copy text" /><span className="text-[13px] text-muted">Edit freely. Nothing is sent from here; paste it wherever your group chats.</span></div>
    </div>
  );
}

function UpdateTab({ data }) {
  return (
    <Runner label="Write a group update" icon="paper-plane" call={() => api.aiUpdate(data.group.id)}
      intro="Turns the verified numbers into a short, encouraging update. It thanks recent contributors and never names anyone who hasn't contributed.">
      {(r) => <TextBox key={r.body} initial={r.body} />}
    </Runner>
  );
}

function ReminderTab({ data }) {
  const [audience, setAudience] = useState("self");
  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink-900">Who is the reminder for?</legend>
        <div className="flex flex-wrap gap-5 text-sm">
          {[["self", "A note to myself"], ["group", "A note to the whole group"]].map(([v, t]) => (
            <label key={v} className="flex items-center gap-2"><input type="radio" name="aud" className="h-4 w-4 accent-[#1B4A58]" checked={audience === v} onChange={() => setAudience(v)} />{t}</label>
          ))}
        </div>
      </fieldset>
      <Runner key={audience} label="Draft a reminder" icon="bell" call={() => api.aiReminder(data.group.id, audience)}
        intro={`Reminders are optional. You decide whether to send one, and the draft never names or singles anyone out. ${data.totals.reminder_opt_ins} ${data.totals.reminder_opt_ins === 1 ? "member has" : "members have"} opted in to gentle reminders.`}>
        {(r) => <TextBox key={r.body} initial={r.body} />}
      </Runner>
    </div>
  );
}

const TABS = [["coach", "Progress coach", "lightbulb"], ["milestones", "Milestone plan", "flag-checkered"], ["update", "Group update", "paper-plane"], ["reminder", "Reminder", "bell"]];

export default function Coach() {
  const { data, reload } = useGroup();
  const [tab, setTab] = useState("coach");
  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h2 className="text-2xl font-semibold">AI coach</h2>
        <p className="mt-1 text-muted">Suggestions only. Totals, percentages and payments are calculated and verified by the app, and the AI never changes them.</p>
      </div>
      <div role="tablist" aria-label="AI tools" className="flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map(([k, t, ic]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-sm ${tab === k ? "border-gold-500 font-semibold text-ink-900" : "border-transparent text-muted hover:text-ink-900"}`}>
            <Icon name={ic} /> {t}
          </button>
        ))}
      </div>
      <Panel>
        {tab === "coach" && <CoachTab data={data} reload={reload} />}
        {tab === "milestones" && <MilestonesTab data={data} reload={reload} />}
        {tab === "update" && <UpdateTab data={data} />}
        {tab === "reminder" && <ReminderTab data={data} />}
      </Panel>
    </div>
  );
}
