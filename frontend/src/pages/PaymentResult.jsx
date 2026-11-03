import { Link, useParams } from "react-router-dom";
import { api } from "../api.js";
import { ErrorNote, Icon, Notice, PageSkeleton, PaymentTag, Panel, SandboxTag } from "../components/ui.jsx";
import { fmtDateTime, money } from "../lib/format.js";
import { useAction, useLoad } from "../lib/hooks.js";
import { useGroup } from "./GroupLayout.jsx";

const COPY = {
  completed: ["ok", "Payment verified", "PayPal confirmed the capture and the amount matched. It now counts toward the group total."],
  pending: ["warn", "Payment pending", "PayPal is still processing this payment. It isn't counted yet. Check again in a few minutes."],
  failed: ["error", "Payment didn't go through", "Nothing was recorded in the ledger."],
  cancelled: ["info", "Payment cancelled", "Nothing was charged and nothing was recorded."],
  released: ["info", "Payment released", "This payment no longer counts toward the group total."],
};

export default function PaymentResult() {
  const { cid } = useParams();
  const { data: g, reload: reloadGroup } = useGroup();
  const { data, error, reload } = useLoad(() => api.contribution(cid), [cid]);
  const check = useAction();
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton />;
  const c = data.contribution;
  const [tone, title, text] = COPY[c.payment_status] || ["info", c.payment_status, ""];
  const mine = c.user_id === g.me.user_id;

  return (
    <div className="max-w-xl space-y-5">
      <h2 className="flex items-center gap-2 text-2xl font-semibold">Payment result {c.source === "paypal_sandbox" && <SandboxTag />}</h2>
      <Notice tone={tone} title={title}>
        {text} {c.failure_reason && <span>{c.failure_reason}</span>}
      </Notice>

      <Panel title="Details" icon="file-invoice-dollar">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-sm">
          <dt className="text-muted">Amount</dt><dd className="font-semibold num">{money(c.amount_cents)} {c.currency}</dd>
          <dt className="text-muted">Status</dt><dd><PaymentTag status={c.payment_status} /></dd>
          <dt className="text-muted">Member</dt><dd className="font-semibold">{c.display_name}</dd>
          <dt className="text-muted">Created</dt><dd>{fmtDateTime(c.created_at)}</dd>
          <dt className="text-muted">PayPal order</dt><dd className="break-all num">{c.paypal_order_id || "None"}</dd>
          <dt className="text-muted">PayPal capture</dt><dd className="break-all num">{c.paypal_capture_id || "None yet"}</dd>
          <dt className="text-muted">PayPal status</dt><dd className="num">{c.paypal_status || "None"}</dd>
        </dl>
      </Panel>

      <div className="flex flex-wrap gap-3">
        {c.payment_status === "pending" && mine && (
          <button className="btn btn-secondary" disabled={check.busy}
            onClick={() => check.run(async () => { await api.refresh(c.id); await reload(); await reloadGroup(); })}>
            <Icon name="sync-alt" /> {check.busy ? "Checking with PayPal" : "Check status with PayPal"}
          </button>
        )}
        <Link to={`/g/${c.group_id}`} className="btn btn-primary">Back to the dashboard</Link>
        <Link to={`/g/${c.group_id}/ledger`} className="btn btn-secondary">View the ledger</Link>
        {["failed", "cancelled"].includes(c.payment_status) && mine && <Link to={`/g/${c.group_id}/contribute`} className="btn btn-secondary">Try again</Link>}
      </div>
      {check.error && <Notice tone="error">{check.error.message}</Notice>}
    </div>
  );
}
