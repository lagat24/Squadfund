import { createContext, useContext } from "react";
import { Link, NavLink, Outlet, useParams } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import IdentityGate from "../components/IdentityGate.jsx";
import { ErrorNote, Icon, Notice, PageSkeleton, Tag } from "../components/ui.jsx";
import { useLoad } from "../lib/hooks.js";

const GroupContext = createContext(null);
export const useGroup = () => useContext(GroupContext);

const STATUS = {
  active: ["ink", "seedling", "Saving"],
  target_reached: ["ok", "check-circle", "Target reached"],
  purchase_simulated: ["warn", "flask", "Purchase simulated"],
  closed: ["", "lock", "Closed"],
};

const NAV = [
  ["", "Overview", "home", true],
  ["plan", "Plan and rules", "sliders-h"],
  ["contribute", "Contribute", "wallet"],
  ["ledger", "Ledger", "receipt"],
  ["coach", "AI coach", "lightbulb"],
  ["offer", "Offer and purchase", "shopping-cart"],
];

function Inner() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data, error, reload } = useLoad(() => api.group(id), [id, user?.id]);

  if (error?.status === 404) {
    return (
      <Notice tone="warn" title="You're not a member of this group">
        Groups are private to their members. If you have an invite code, <Link to="/join" className="font-semibold underline">join with it</Link>.
      </Notice>
    );
  }
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton />;

  const [tone, icon, label] = STATUS[data.group.status] || ["", "minus", data.group.status];
  const navCls = ({ isActive }) =>
    `flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-sm no-underline lg:border-b-0 lg:border-l-2 ${
      isActive ? "border-gold-500 font-semibold text-ink-900" : "border-transparent text-muted hover:text-ink-900"
    }`;

  return (
    <GroupContext.Provider value={{ data, reload }}>
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold">{data.group.name}</h1>
          <Tag tone={tone} icon={icon}>{label}</Tag>
        </div>
        <p className="mt-1 text-muted">{data.group.goal_title}</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        <nav aria-label="Group" className="-mx-4 flex overflow-x-auto border-b border-line px-4 lg:mx-0 lg:block lg:overflow-visible lg:border-b-0 lg:px-0">
          {NAV.map(([to, text, ic, end]) => (
            <NavLink key={to} to={to} end={end} className={navCls}>
              <Icon name={ic} className="text-base" />
              {text}
            </NavLink>
          ))}
        </nav>
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </GroupContext.Provider>
  );
}

export default function GroupLayout() {
  return (
    <IdentityGate title="Enter your name to open this group">
      <Inner />
    </IdentityGate>
  );
}
