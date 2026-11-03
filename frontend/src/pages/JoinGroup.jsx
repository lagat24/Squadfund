import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import IdentityGate from "../components/IdentityGate.jsx";
import { DollarInput, ErrorNote, Field, Icon, Notice, Panel, Skeleton } from "../components/ui.jsx";
import { dollarsText, fmtDate, money, parseDollars } from "../lib/format.js";
import { useAction, useLoad } from "../lib/hooks.js";

function CodeEntry() {
  const nav = useNavigate();
  const [code, setCode] = useState("");
  return (
    <form className="max-w-md space-y-3" onSubmit={(e) => { e.preventDefault(); nav(`/join/${code.trim().toUpperCase()}`); }}>
      <Field label="Invite code" htmlFor="code" hint="Looks like ABCD-2345. The example group uses DEMO-SQUAD.">
        <input id="code" className="input num uppercase" value={code} onChange={(e) => setCode(e.target.value)} placeholder="DEMO-SQUAD" required />
      </Field>
      <button className="btn btn-primary" disabled={code.trim().length < 4}>Find group <Icon name="arrow-right" /></button>
    </form>
  );
}

function Preview({ code }) {
  const nav = useNavigate();
  const { user } = useAuth();
  const { data, error, loading, reload } = useLoad(() => api.invite(code), [code, user?.id]);
  const [mine, setMine] = useState("");
  const [ok, setOk] = useState(false);
  const { busy, error: joinErr, run } = useAction();

  useEffect(() => {
    if (data && !mine) setMine(dollarsText(data.group.suggested_target_cents));
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return (
    <div className="max-w-md space-y-3">
      <Notice tone="error" title="Group not found">{error.message}</Notice>
      <Link to="/join" className="btn btn-secondary btn-sm">Try another code</Link>
    </div>
  );
  if (loading && !data) return <div className="max-w-2xl space-y-3"><Skeleton className="h-8 w-1/2" /><Skeleton className="h-48" /></div>;
  const g = data.group;
  if (data.already_member) {
    return (
      <Notice tone="ok" title={`You're already in ${g.name}`}>
        <Link to={`/g/${data.group_id}`} className="font-semibold underline">Open the dashboard</Link>
      </Notice>
    );
  }
  const cents = parseDollars(mine);
  return (
    <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
      <div>
        <h1 className="text-3xl font-semibold">{g.name}</h1>
        <p className="mt-1 text-lg text-muted">{g.goal_title}</p>
        <dl className="mt-5 grid max-w-md grid-cols-2 gap-y-3 text-sm">
          <dt className="text-muted">Target</dt><dd className="num font-semibold">{money(g.target_cents)}</dd>
          <dt className="text-muted">Deadline</dt><dd className="font-semibold">{fmtDate(g.deadline)}</dd>
          <dt className="text-muted">Members</dt><dd className="num font-semibold">{g.member_count} of {g.group_size}</dd>
          <dt className="text-muted">Started by</dt><dd className="font-semibold">{g.owner_name}</dd>
        </dl>
        {g.description && <p className="mt-5 max-w-lg text-muted">{g.description}</p>}
        <Panel title="Group rules" icon="balance-scale" className="mt-6 max-w-xl">
          <div className="space-y-3 text-sm">
            <p><span className="font-semibold">If the target isn't reached. </span>{g.rules_missed_target}</p>
            <p><span className="font-semibold">Leaving or pausing. </span>{g.rules_exit}</p>
            <p className="text-muted">Contributions in this prototype are PayPal Sandbox test payments in a simulated ledger. No real money is held.</p>
          </div>
        </Panel>
      </div>
      <div>
        {!data.joinable ? (
          <Notice tone="warn" title="This group can't take new members">It is full or no longer saving.</Notice>
        ) : (
          <IdentityGate title="Enter your name to join">
            <form className="panel space-y-4 p-4" onSubmit={(e) => { e.preventDefault(); run(async () => { const r = await api.join(code, { personal_target_cents: cents, accepted_rules: ok }); nav(`/g/${r.group_id}`); }); }}>
              <h2 className="text-lg font-semibold">Join this group</h2>
              <Field label="Your personal target" htmlFor="mine" error={joinErr?.field === "personal_target_cents" ? joinErr.message : null}
                hint={`An even split is ${money(g.suggested_target_cents)}. Pick what you can comfortably afford; you can change it any time.`}>
                <DollarInput id="mine" value={mine} onChange={setMine} />
              </Field>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1 h-4 w-4 accent-[#1B4A58]" checked={ok} onChange={(e) => setOk(e.target.checked)} />
                <span>I've read the group rules, including what happens if the target isn't reached.</span>
              </label>
              {joinErr && joinErr.field !== "personal_target_cents" && <Notice tone="error">{joinErr.message}</Notice>}
              <button className="btn btn-primary w-full" disabled={busy || !ok || !cents}>{busy ? "Joining" : "Join group"}</button>
            </form>
          </IdentityGate>
        )}
      </div>
    </div>
  );
}

export default function JoinGroup() {
  const { code } = useParams();
  return code ? <Preview code={code} /> : (
    <div>
      <h1 className="mb-1 text-3xl font-semibold">Join with a code</h1>
      <p className="mb-6 max-w-xl text-muted">Enter the invite code you were sent. You'll see the group's rules before you decide.</p>
      <CodeEntry />
    </div>
  );
}
