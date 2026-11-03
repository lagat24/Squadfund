const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export const money = (cents) => usd.format((cents || 0) / 100);

// "1,234.50" -> 123450 (integer cents) or null. No floating point involved.
export function parseDollars(text) {
  const t = String(text ?? "").trim().replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const [d, c = ""] = t.split(".");
  return parseInt(d, 10) * 100 + parseInt((c + "00").slice(0, 2), 10);
}

export const dollarsText = (cents) => (cents / 100).toFixed(2);

export function fmtDate(iso) {
  if (!iso) return "";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + "T00:00:00") : new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function fmtDateTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export function todayPlus(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}
