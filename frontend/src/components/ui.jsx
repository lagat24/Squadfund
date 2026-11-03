import { useState } from "react";
import { copyText } from "../lib/format.js";

// Icons8 Line Awesome. Purely decorative here; text always carries the meaning.
export function Icon({ name, className = "" }) {
  return <i className={`las la-${name} ${className}`} aria-hidden="true" />;
}

export function Panel({ title, icon, action, children, className = "", pad = true }) {
  return (
    <section className={`panel ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            {icon && <Icon name={icon} className="text-lg text-ink-600" />}
            {title}
          </h2>
          {action}
        </header>
      )}
      <div className={pad ? "p-4" : ""}>{children}</div>
    </section>
  );
}

export function Field({ label, hint, error, children, htmlFor }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-ink-900">{label}</label>
      {children}
      {hint && !error && <p className="mt-1 text-[13px] text-muted">{hint}</p>}
      {error && <p className="mt-1 text-[13px] text-danger" role="alert">{error}</p>}
    </div>
  );
}

export function DollarInput({ id, value, onChange, invalid, ...rest }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">$</span>
      <input id={id} className={`input num pl-7 ${invalid ? "input-error" : ""}`} inputMode="decimal" autoComplete="off"
        value={value} onChange={(e) => onChange(e.target.value)} placeholder="0.00" {...rest} />
    </div>
  );
}

const NOTICE = {
  info: { box: "border-ink-200 bg-ink-50 text-ink-900", icon: "info-circle" },
  warn: { box: "border-gold-400 bg-[#FBF4E1] text-gold-700", icon: "exclamation-triangle" },
  error: { box: "border-danger/40 bg-danger-soft text-danger", icon: "exclamation-triangle" },
  ok: { box: "border-ok/30 bg-ok-soft text-ok", icon: "check-circle" },
};

export function Notice({ tone = "info", title, children, className = "" }) {
  const t = NOTICE[tone];
  return (
    <div className={`flex gap-3 rounded-md border px-3.5 py-3 text-sm ${t.box} ${className}`} role={tone === "error" ? "alert" : "note"}>
      <Icon name={t.icon} className="mt-0.5 text-lg" />
      <div>
        {title && <p className="font-semibold">{title}</p>}
        <div className={title ? "mt-0.5" : ""}>{children}</div>
      </div>
    </div>
  );
}

export function ErrorNote({ error, onRetry }) {
  return (
    <Notice tone="error" title="That didn't load">
      <p>{error?.message || "Something went wrong."}</p>
      {onRetry && <button className="mt-2 font-semibold underline" onClick={onRetry}>Try again</button>}
    </Notice>
  );
}

export function Skeleton({ className = "" }) {
  return <div className={`animate-pulse rounded bg-ink-100 ${className}`} aria-hidden="true" />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading">
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-28 w-full" />
    </div>
  );
}

export function Tag({ tone, icon, children }) {
  const cls = { ink: "tag-ink", ok: "tag-ok", warn: "tag-warn", bad: "tag-bad" }[tone] || "";
  return (
    <span className={`tag ${cls}`}>
      {icon && <Icon name={icon} />}
      {children}
    </span>
  );
}

export const SimulatedTag = () => <Tag tone="warn" icon="flask">Simulated</Tag>;
export const SandboxTag = () => <Tag tone="warn" icon="flask">Sandbox</Tag>;

const PACE = {
  ahead: ["ok", "arrow-up", "Ahead of pace"],
  on_pace: ["ok", "check", "On pace"],
  catching_up: ["ink", "hourglass-half", "Room to catch up"],
  complete: ["ok", "check-circle", "Target met"],
  paused: ["", "pause-circle", "Paused"],
};
export function PaceTag({ pace }) {
  const [tone, icon, text] = PACE[pace] || ["", "minus", pace];
  return <Tag tone={tone} icon={icon}>{text}</Tag>;
}

const PAYMENT = {
  completed: ["ok", "check-circle", "Verified"],
  pending: ["warn", "hourglass-half", "Pending"],
  failed: ["bad", "times-circle", "Failed"],
  cancelled: ["", "ban", "Cancelled"],
  released: ["", "undo", "Released"],
};
export function PaymentTag({ status }) {
  const [tone, icon, text] = PAYMENT[status] || ["", "minus", status];
  return <Tag tone={tone} icon={icon}>{text}</Tag>;
}

export function CopyButton({ text, label = "Copy", className = "" }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className={`btn btn-secondary btn-sm ${className}`}
      onClick={async () => { if (await copyText(text)) { setDone(true); setTimeout(() => setDone(false), 1800); } }}>
      <Icon name={done ? "check" : "copy"} />
      {done ? "Copied" : label}
    </button>
  );
}

// The memorable element: a thin ruler with gold checkpoint ticks.
export function ProgressRuler({ percent = 0, milestones = [], label }) {
  const pct = Math.max(0, Math.min(100, percent));
  const ticks = milestones.filter((m) => m.percent < 100);
  return (
    <div role="img" aria-label={label || `${pct}% of the target recorded`}>
      <div className="relative h-3 rounded-sm bg-ink-100">
        <div className="absolute inset-y-0 left-0 rounded-sm bg-ink-700 transition-[width] duration-700" style={{ width: `${pct}%` }} />
        {ticks.map((m, i) => (
          <span key={i} className="absolute -bottom-1 -top-1 w-[3px] rounded-sm bg-gold-500" style={{ left: `calc(${m.percent}% - 1.5px)` }} />
        ))}
      </div>
      <div className="relative mt-2 h-4 text-xs text-muted num" aria-hidden="true">
        {ticks.map((m, i) => (
          <span key={i} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${m.percent}%` }}>{Math.round(m.percent)}%</span>
        ))}
        <span className="absolute right-0">100%</span>
      </div>
    </div>
  );
}

export function MiniBar({ percent = 0 }) {
  return (
    <div className="h-1.5 w-full rounded-sm bg-ink-100" aria-hidden="true">
      <div className="h-full rounded-sm bg-ink-600" style={{ width: `${Math.min(100, percent)}%` }} />
    </div>
  );
}

export function Empty({ icon = "inbox", title, children }) {
  return (
    <div className="px-4 py-10 text-center">
      <Icon name={icon} className="text-3xl text-ink-300" />
      <p className="mt-2 font-semibold text-ink-900">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-sm text-sm text-muted">{children}</div>}
    </div>
  );
}

export function Logo({ className = "h-7 w-7" }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="6" fill="#0F3A45" />
      <rect x="6" y="18" width="20" height="3" rx="1" fill="#fff" />
      <rect x="11" y="9" width="2.5" height="9" fill="#D2A63A" />
      <rect x="18.5" y="9" width="2.5" height="9" fill="#D2A63A" />
    </svg>
  );
}
