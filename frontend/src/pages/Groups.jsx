import { Link } from "react-router-dom";
import { api } from "../api.js";
import IdentityGate from "../components/IdentityGate.jsx";
import { Empty, ErrorNote, Icon, MiniBar, Panel, Skeleton, Tag } from "../components/ui.jsx";
import { fmtDate, money } from "../lib/format.js";
import { useLoad } from "../lib/hooks.js";

const STATUS = { active: "Saving", target_reached: "Target reached", purchase_simulated: "Purchase simulated", closed: "Closed" };

function List() {
  const { data, error, loading, reload } = useLoad(() => api.myGroups(), []);
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (loading && !data) return <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>;
  const groups = data.groups;
  if (!groups.length) {
    return (
      <Panel pad={false}>
        <Empty icon="users" title="You're not in a group yet">
          Start one for a purchase you're planning, or join with a code from a friend.
          <div className="mt-4 flex justify-center gap-2">
            <Link to="/start" className="btn btn-primary btn-sm">Start a group</Link>
            <Link to="/join" className="btn btn-secondary btn-sm">Join with a code</Link>
          </div>
        </Empty>
      </Panel>
    );
  }
  return (
    <ul className="space-y-3">
      {groups.map((g) => (
        <li key={g.id}>
          <Link to={`/g/${g.id}`} className="panel block p-4 no-underline hover:border-ink-400">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-lg font-semibold text-ink-900">{g.name}</p>
                <p className="text-sm text-muted">{g.goal_title}</p>
              </div>
              <div className="flex gap-2">
                {g.role === "owner" && <Tag tone="ink" icon="key">Owner</Tag>}
                <Tag>{STATUS[g.status] || g.status}</Tag>
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between text-sm num">
              <span className="font-semibold text-ink-900">{money(g.recorded_cents)} <span className="font-normal text-muted">of {money(g.target_cents)}</span></span>
              <span className="text-muted">due {fmtDate(g.deadline)}</span>
            </div>
            <div className="mt-2"><MiniBar percent={g.percent} /></div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function Groups() {
  return (
    <div className="max-w-3xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">Your groups</h1>
        <div className="flex gap-2">
          <Link to="/join" className="btn btn-secondary btn-sm"><Icon name="door-open" /> Join with a code</Link>
          <Link to="/start" className="btn btn-primary btn-sm"><Icon name="plus" /> Start a group</Link>
        </div>
      </div>
      <IdentityGate title="Enter your name to see your groups"><List /></IdentityGate>
    </div>
  );
}
