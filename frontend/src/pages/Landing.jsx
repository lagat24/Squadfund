import { Link } from "react-router-dom";
import { api } from "../api.js";
import { Icon, Panel, ProgressRuler, Skeleton, SimulatedTag } from "../components/ui.jsx";
import { fmtDate, money } from "../lib/format.js";
import { useLoad } from "../lib/hooks.js";

const STEPS = [
  ["flag-checkered", "Create a group goal", "Name the purchase, then set the target amount, deadline and group size."],
  ["user-friends", "Invite members", "Members read the rules first, then choose a personal target they can afford."],
  ["wallet", "Contribute through PayPal Sandbox", "Each payment is created and verified on the server before it appears in the ledger."],
  ["chart-line", "Track progress together", "One dashboard shows every member's progress, the group total and the next milestone."],
  ["lightbulb", "Get AI support", "The AI suggests milestones, drafts optional reminders, and recommends adjustments when someone falls behind."],
  ["balance-scale", "Compare bulk prices", "At the target the group sees simulated supplier offers. They are labelled as demo data."],
];

const RULES = [
  ["No penalties.", "Missing a milestone never costs anyone a fine, a forfeit or a public mark."],
  ["You keep ownership of your money.", "Pause, change your target, or leave. Contributions recorded under your name are released when you leave."],
  ["Nobody is pushed.", "There are no compulsory deposits and no pressure to give more than you can afford."],
  ["Simulated ledger.", "This prototype never holds, pools, lends or transfers real funds."],
  ["AI suggests, people decide.", "The AI never changes balances, payment outcomes or membership."],
];

function Example() {
  const { data, loading } = useLoad(() => api.demo(), []);
  const g = data?.group;
  if (loading && !data) return <Skeleton className="h-64 w-full" />;
  if (!g) return null;
  return (
    <Panel className="w-full">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Example group</p>
          <h2 className="text-xl font-semibold">{g.name}</h2>
          <p className="text-sm text-muted">{g.goal_title}</p>
        </div>
        <SimulatedTag />
      </div>
      <p className="mt-5 font-display text-3xl font-semibold num text-ink-900">{money(g.recorded_cents)}</p>
      <p className="mb-4 text-sm text-muted num">recorded of {money(g.target_cents)}, due {fmtDate(g.deadline)}</p>
      <ProgressRuler percent={g.percent} milestones={g.milestones} />
      <p className="mt-3 text-sm text-muted">{g.members} of {g.group_size} members have joined. This is seeded demo data you can explore.</p>
      <Link to={`/join/${g.invite_code}`} className="btn btn-secondary mt-4">
        Join the example group
      </Link>
    </Panel>
  );
}

export default function Landing() {
  return (
    <div className="space-y-16">
      <section className="grid items-start gap-10 md:grid-cols-[1.15fr_1fr]">
        <div>
          <h1 className="max-w-xl text-4xl font-semibold leading-tight sm:text-5xl">Save for one purchase, together.</h1>
          <p className="mt-5 max-w-lg text-lg text-muted">
            A small group sets a target and a deadline, each person picks a share they can afford, and everyone sees the same progress.
            When the target is met, the group compares bulk prices.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/start" className="btn btn-primary">Start a group</Link>
            <Link to="/join" className="btn btn-secondary">Join with a code</Link>
          </div>
          <p className="mt-4 max-w-md text-sm text-muted">Built for friends, classmates, colleagues and community groups buying one thing, such as a set of laptops.</p>
        </div>
        <Example />
      </section>

      <section aria-labelledby="how">
        <h2 id="how" className="text-2xl font-semibold">How it works</h2>
        <ol className="mt-5 max-w-3xl divide-y divide-line border-y border-line">
          {STEPS.map(([icon, title, text], i) => (
            <li key={title} className="flex gap-4 py-4">
              <span className="w-6 pt-0.5 font-display text-lg font-semibold text-ink-400 num">{i + 1}</span>
              <div className="flex-1">
                <h3 className="flex items-center gap-2 text-base font-semibold"><Icon name={icon} className="text-lg text-ink-600" />{title}</h3>
                <p className="mt-0.5 text-muted">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="rules" className="grid gap-6 md:grid-cols-[1fr_1.6fr]">
        <div>
          <h2 id="rules" className="text-2xl font-semibold">Ground rules</h2>
          <p className="mt-2 max-w-xs text-muted">Every member sees these before joining, and they apply to everyone equally.</p>
        </div>
        <dl className="divide-y divide-line border-y border-line">
          {RULES.map(([t, d]) => (
            <div key={t} className="py-3">
              <dt className="font-semibold text-ink-900">{t}</dt>
              <dd className="text-muted">{d}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
