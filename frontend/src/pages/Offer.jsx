import { api } from "../api.js";
import { ErrorNote, Icon, Notice, PageSkeleton, Panel, SimulatedTag, Tag } from "../components/ui.jsx";
import { fmtDate, fmtDateTime, money } from "../lib/format.js";
import { useAction, useLoad } from "../lib/hooks.js";
import { useGroup } from "./GroupLayout.jsx";

function Summary({ d }) {
  const o = d.selected_offer;
  const steps = [
    ["check-circle", "Target reached", `${money(d.recorded_cents)} verified of ${money(d.target_cents)}`],
    ["check-circle", "Offer chosen", `${o.supplier_label} (simulated), chosen ${fmtDateTime(d.purchased_at)}`],
    ["circle", "Real purchase", "Not part of this prototype. No order has been placed."],
  ];
  return (
    <div className="space-y-5">
      <Notice tone="warn" title="Simulated purchase complete"><SimulatedTag /> <span className="ml-1">No supplier was contacted, no order exists and no money moved.</span></Notice>
      <Panel title="Purchase status" icon="clipboard-check">
        <ol className="space-y-4">
          {steps.map(([ic, t, s], i) => (
            <li key={t} className="flex gap-3">
              <Icon name={ic} className={`mt-0.5 text-xl ${i < 2 ? "text-gold-500" : "text-ink-300"}`} />
              <div><p className="font-semibold text-ink-900">{t}</p><p className="text-sm text-muted">{s}</p></div>
            </li>
          ))}
        </ol>
      </Panel>
      <Panel title="Summary" icon="receipt">
        <dl className="grid max-w-md grid-cols-2 gap-y-2.5 text-sm">
          <dt className="text-muted">Purchase</dt><dd className="font-semibold">{d.goal_title}</dd>
          <dt className="text-muted">Items</dt><dd className="num font-semibold">{o.quantity}</dd>
          <dt className="text-muted">Group's own estimate</dt><dd className="num font-semibold">{money(o.list_total_cents)}</dd>
          <dt className="text-muted">Simulated quote</dt><dd className="num font-semibold">{money(o.quoted_total_cents)}</dd>
          <dt className="text-muted">Simulated difference</dt><dd className="num font-semibold text-gold-600">{money(o.savings_cents)}</dd>
        </dl>
        <h3 className="mb-2 mt-5 text-base font-semibold">Verified contributions by member</h3>
        <ul className="divide-y divide-line text-sm">
          {d.members.map((m) => <li key={m.display_name} className="flex justify-between py-2"><span>{m.display_name}</span><span className="num font-semibold">{money(m.recorded_cents)}</span></li>)}
        </ul>
      </Panel>
      <Panel title="What a real version would do next" icon="route" >
        <p className="text-sm text-muted">Send the group's demand to real suppliers for confirmed quotes, let members approve a final price, and only then arrange payment, with members' money never pooled by SquadFund. That is future work and is not built here.</p>
      </Panel>
    </div>
  );
}

export default function Offer() {
  const { data: g, reload } = useGroup();
  const { data, error, reload: again } = useLoad(() => api.offers(g.group.id), [g.group.id, g.group.status]);
  const choose = useAction();
  if (error) return <ErrorNote error={error} onRetry={again} />;
  if (!data) return <PageSkeleton />;
  const isOwner = g.group.owner_id === g.me.user_id;
  if (data.status === "purchase_simulated" && data.selected_offer) return <div className="max-w-3xl"><h2 className="mb-4 text-2xl font-semibold">Offer and purchase</h2><Summary d={data} /></div>;

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-semibold">Offer and purchase <SimulatedTag /></h2>
        <p className="mt-1 text-muted">{data.is_preview ? "A preview of how bulk offers will look once the group reaches its target." : "The group reached its target. Compare the simulated offers below."}</p>
      </div>
      <Notice tone="warn" title="Demo data">{data.notice}</Notice>
      {data.is_preview && <Notice>This is a preview. Choosing an offer unlocks when verified contributions reach {money(data.target_cents)}. The group has {money(data.recorded_cents)} so far.</Notice>}

      <Panel title={`Bulk-price comparison for ${data.quantity} ${data.quantity === 1 ? "item" : "items"}`} icon="balance-scale" pad={false}>
        <p className="border-b border-line px-4 py-3 text-sm text-muted">The group's own estimate is <span className="font-semibold text-ink-900 num">{money(data.target_cents)}</span>. These figures are made-up examples of what a bulk quote could look like.</p>
        <ul className="divide-y divide-line">
          {data.offers.map((o) => (
            <li key={o.supplier_label} className="flex flex-wrap items-center justify-between gap-4 px-4 py-4">
              <div className="max-w-sm">
                <p className="flex items-center gap-2 font-semibold text-ink-900">{o.supplier_label} <Tag tone="warn">Simulated</Tag></p>
                <p className="text-sm text-muted">{o.description}</p>
              </div>
              <div className="text-right">
                <p className="font-display text-xl font-semibold num text-ink-900">{money(o.quoted_total_cents)}</p>
                <p className="text-sm num text-gold-600">{money(o.savings_cents)} below the estimate</p>
              </div>
              {!data.is_preview && isOwner && (
                <button className="btn btn-primary btn-sm" disabled={choose.busy}
                  onClick={() => choose.run(async () => { await api.purchase(g.group.id, o.id); await reload(); await again(); })}>
                  Choose this offer
                </button>
              )}
            </li>
          ))}
        </ul>
      </Panel>
      {!data.is_preview && !isOwner && <p className="text-sm text-muted">The group owner chooses the offer to finish the simulated purchase.</p>}
      {choose.error && <Notice tone="error">{choose.error.message}</Notice>}
    </div>
  );
}
