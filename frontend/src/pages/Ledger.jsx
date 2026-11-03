import { api } from "../api.js";
import { Empty, ErrorNote, Panel, PaymentTag, Skeleton, Tag } from "../components/ui.jsx";
import { fmtDateTime, money } from "../lib/format.js";
import { useLoad } from "../lib/hooks.js";
import { Link } from "react-router-dom";
import { useGroup } from "./GroupLayout.jsx";

const SOURCE = { paypal_sandbox: "PayPal Sandbox", seed: "Seeded example" };

export default function Ledger() {
  const { data: g } = useGroup();
  const { data, error, loading, reload } = useLoad(() => api.ledger(g.group.id), [g.group.id, g.totals.recorded_cents]);
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (loading && !data) return <Skeleton className="h-64" />;
  const rows = data.contributions;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Ledger</h2>
          <p className="text-sm text-muted">A simulated record of contributions. Only verified payments count toward the total.</p>
        </div>
        <p className="text-right text-sm text-muted">Verified total<br /><span className="font-display text-2xl font-semibold text-ink-900 num">{money(data.recorded_cents)}</span></p>
      </div>
      <Panel pad={false}>
        {rows.length === 0 ? (
          <Empty icon="receipt" title="No contributions yet">
            Verified payments appear here with their PayPal references. <Link to="../contribute" className="font-semibold underline">Make the first one.</Link>
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-line text-muted">
                <tr><th className="px-4 py-2.5 font-medium">Member</th><th className="px-4 py-2.5 font-medium">Date</th><th className="px-4 py-2.5 text-right font-medium">Amount</th><th className="px-4 py-2.5 font-medium">Status</th><th className="px-4 py-2.5 font-medium">Source</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-2.5 font-semibold text-ink-900">{c.display_name}</td>
                    <td className="px-4 py-2.5 text-muted">{fmtDateTime(c.created_at)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold num">{money(c.amount_cents)}</td>
                    <td className="px-4 py-2.5"><PaymentTag status={c.payment_status} /></td>
                    <td className="px-4 py-2.5">
                      {c.source === "seed" ? <Tag tone="warn">{SOURCE.seed}</Tag> : (
                        <Link to={`../payments/${c.id}`} className="text-[13px]">{c.paypal_capture_id ? `Capture ${c.paypal_capture_id}` : SOURCE[c.source]}</Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
