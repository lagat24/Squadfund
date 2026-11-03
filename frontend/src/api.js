export class ApiError extends Error {
  constructor(status, message, code, field) {
    super(message);
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

async function request(method, path, body) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      headers: method === "GET" || method === "DELETE" ? {} : { "Content-Type": "application/json" },
      body: method === "GET" || method === "DELETE" ? undefined : JSON.stringify(body ?? {}),
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.", "network");
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON response */
  }
  if (!res.ok) {
    throw new ApiError(res.status, data?.error?.message || "Something went wrong. Try again.", data?.error?.code, data?.error?.field);
  }
  return data;
}

const get = (p) => request("GET", p);
const post = (p, b) => request("POST", p, b);
const patch = (p, b) => request("PATCH", p, b);
const put = (p, b) => request("PUT", p, b);

export const api = {
  config: () => get("/config"),
  demo: () => get("/demo"),
  me: () => get("/auth/me"),
  signUp: (display_name) => post("/auth/session", { display_name }),
  resume: (token) => post("/auth/resume", { token }),
  signOut: () => request("DELETE", "/auth/session"),
  myGroups: () => get("/groups"),
  createGroup: (b) => post("/groups", b),
  invite: (code) => get(`/invites/${encodeURIComponent(code)}`),
  join: (code, b) => post(`/invites/${encodeURIComponent(code)}/join`, b),
  group: (id) => get(`/groups/${id}`),
  editGroup: (id, b) => patch(`/groups/${id}`, b),
  editMembership: (id, b) => patch(`/groups/${id}/membership`, b),
  leave: (id) => post(`/groups/${id}/leave`),
  setMilestones: (id, milestones) => put(`/groups/${id}/milestones`, { milestones }),
  ledger: (id) => get(`/groups/${id}/contributions`),
  createOrder: (id, amount_cents) => post(`/groups/${id}/orders`, { amount_cents }),
  capture: (orderId) => post(`/orders/${orderId}/capture`),
  cancelOrder: (orderId) => post(`/orders/${orderId}/cancel`),
  contribution: (id) => get(`/contributions/${id}`),
  refresh: (id) => post(`/contributions/${id}/refresh`),
  offers: (id) => get(`/groups/${id}/offers`),
  purchase: (id, offer_id) => post(`/groups/${id}/purchase`, { offer_id }),
  aiMilestones: (id) => post(`/groups/${id}/ai/milestones`),
  aiCoach: (id) => post(`/groups/${id}/ai/coach`),
  aiUpdate: (id) => post(`/groups/${id}/ai/update`),
  aiReminder: (id, audience) => post(`/groups/${id}/ai/reminder`, { audience }),
};
