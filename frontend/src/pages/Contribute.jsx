import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { DollarInput, Field, Icon, Notice, Panel, SandboxTag, Skeleton } from "../components/ui.jsx";
import { dollarsText, money, parseDollars } from "../lib/format.js";
import { useLoad } from "../lib/hooks.js";
import { useGroup } from "./GroupLayout.jsx";

function usePayPalSdk(clientId, currency) {
  const [state, setState] = useState({ ready: !!window.paypal, error: null });
  useEffect(() => {
    if (!clientId || window.paypal) return;
    const s = document.createElement("script");
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${currency}&intent=capture&components=buttons&disable-funding=credit,card`;
    s.async = true;
    s.onload = () => setState({ ready: true, error: null });
    s.onerror = () => setState({ ready: false, error: "The PayPal checkout script didn't load. Check your connection and the Sandbox client ID, then reload." });
    document.head.appendChild(s);
  }, [clientId, currency]);
  return state;
}

export default function Contribute() {
  const nav = useNavigate();
  const { data, reload } = useGroup();
  const { group, totals, me } = data;
  const cfg = useLoad(() => api.config(), []);
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState(null); // { tone, text }
  const [working, setWorking] = useState(false);
  const holder = useRef(null);
  const latest = useRef({ amount: "", contribution: null });
  latest.current.amount = amount;

  const paypal = cfg.data?.paypal;
  const sdk = usePayPalSdk(paypal?.enabled ? paypal.client_id : null, cfg.data?.currency || "USD");
  const cents = parseDollars(amount);
  const remaining = totals.remaining_cents;
  const amountError = amount && (!cents ? "Enter an amount like 25 or 25.50." : cents < 100 ? "The minimum is $1.00." : cents > remaining ? `The group only needs ${money(remaining)} more.` : null);
  const canPay = group.status === "active" && me.status === "active";

  useEffect(() => {
    if (!sdk.ready || !holder.current || !window.paypal || !canPay) return undefined;
    const buttons = window.paypal.Buttons({
      style: { layout: "vertical", shape: "rect", label: "pay", height: 44 },
      onClick: (_d, actions) => {
        const c = parseDollars(latest.current.amount);
        if (!c || c < 100 || c > remaining) {
          setMessage({ tone: "error", text: "Enter a valid amount above before paying." });
          return actions.reject();
        }
        setMessage(null);
        return actions.resolve();
      },
      createOrder: async () => {
        const r = await api.createOrder(group.id, parseDollars(latest.current.amount));
        latest.current.contribution = r.contribution_id;
        return r.order_id;
      },
      onApprove: async (d) => {
        setWorking(true);
        try {
          const r = await api.capture(d.orderID);
          await reload();
          nav(`/g/${group.id}/payments/${r.contribution.id}`);
        } catch (e) {
          setWorking(false);
          if (latest.current.contribution) {
            setMessage({ tone: "warn", text: `${e.message} You can check this payment's status on its result page.` });
          } else {
            setMessage({ tone: "error", text: e.message });
          }
        }
      },
      onCancel: async (d) => {
        await api.cancelOrder(d.orderID).catch(() => {});
        setMessage({ tone: "info", text: "Checkout closed. Nothing was charged and nothing was recorded." });
      },
      onError: () => setMessage({ tone: "error", text: "PayPal couldn't complete checkout. Nothing was recorded. Try again, or check your Sandbox account." }),
    });
    if (buttons.isEligible()) buttons.render(holder.current);
    return () => { try { buttons.close(); } catch { /* already closed */ } };
  }, [sdk.ready, canPay, group.id, remaining]); // eslint-disable-line react-hooks/exhaustive-deps

  const chips = [...new Set([me.weekly_cents, me.remaining_cents, 2500, 5000])].filter((c) => c >= 100 && c <= remaining).slice(0, 4);

  return (
    <div className="max-w-xl space-y-5">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-semibold">Contribute <SandboxTag /></h2>
        <p className="mt-1 text-muted">Pay what suits you. There's no minimum beyond $1 and no pressure to hit a weekly figure.</p>
      </div>

      <Notice tone="warn" title="Sandbox test payment">
        {cfg.data?.disclosure || "This is a prototype. Payments use PayPal Sandbox test money and SquadFund does not hold funds."} Log in to PayPal with a Sandbox personal test account, not your real one.
      </Notice>

      {cfg.loading && !cfg.data ? <Skeleton className="h-40" /> : !paypal?.enabled ? (
        <Notice tone="error" title="Checkout isn't switched on yet">
          This server has no PayPal Sandbox keys. Add <code>PAYPAL_CLIENT_ID</code> and <code>PAYPAL_CLIENT_SECRET</code> to the environment, then restart. Nothing else in the app is affected.
        </Notice>
      ) : !canPay ? (
        <Notice tone="info" title="Contributions are closed for you right now">
          {me.status === "paused" ? <>Your plan is paused. <Link to="../plan" className="font-semibold underline">Resume it</Link> to contribute.</> : "This group isn't accepting contributions."}
        </Notice>
      ) : (
        <Panel>
          <Field label="Amount" htmlFor="amt" error={amountError} hint={`The group still needs ${money(remaining)}. Your target has ${money(me.remaining_cents)} left.`}>
            <DollarInput id="amt" value={amount} onChange={setAmount} invalid={!!amountError} />
          </Field>
          {chips.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {chips.map((c) => (
                <button key={c} type="button" className="btn btn-secondary btn-sm num" onClick={() => setAmount(dollarsText(c))}>
                  {money(c)}{c === me.weekly_cents ? " weekly step" : c === me.remaining_cents ? " rest of target" : ""}
                </button>
              ))}
            </div>
          )}
          {message && <Notice tone={message.tone} className="mt-4">{message.text}</Notice>}
          {sdk.error && <Notice tone="error" className="mt-4">{sdk.error}</Notice>}
          <div className="mt-5 min-h-[56px]">
            {!sdk.ready && !sdk.error && <Skeleton className="h-11 w-full" />}
            {working && <p className="mb-2 flex items-center gap-2 text-sm text-muted"><Icon name="sync-alt" /> Verifying your payment with PayPal</p>}
            <div ref={holder} className={working ? "pointer-events-none opacity-50" : ""} />
          </div>
          <p className="mt-3 text-[13px] text-muted">After you approve, our server captures the payment with PayPal and checks the amount before it is added to the ledger.</p>
        </Panel>
      )}
    </div>
  );
}
