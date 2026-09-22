/** Thin fetch wrapper for the NationPulse API. Every function here mirrors
 * one endpoint in api/routers/*.py — see api/README.md for the full list.
 * Set VITE_API_URL in a .env file at the project root; defaults to the
 * local dev server.
 */
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

class ApiError extends Error {
  constructor(status, detail) {
    super(detail || `Request failed with status ${status}`);
    this.status = status;
  }
}

async function request(path, { method = "GET", token, body, params } = {}) {
  let url = `${BASE_URL}${path}`;
  if (params) {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== ""));
    if ([...qs].length) url += `?${qs}`;
  }
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) throw new ApiError(res.status, data?.detail);
  return data;
}

export const api = {
  // --- auth ---
  signup: (name, email, password) => request("/auth/signup", { method: "POST", body: { name, email, password } }),
  login: (email, password) => request("/auth/login", { method: "POST", body: { email, password } }),
  me: (token) => request("/auth/me", { token }),

  // --- public ---
  listBills: (params) => request("/bills", { params }),
  getBill: (id) => request(`/bills/${id}`),
  listTopics: () => request("/topics"),
  listMPs: (params) => request("/mps", { params }),
  getMP: (id) => request(`/mps/${id}`),
  getDigest: (weeks) => request("/digest", { params: { weeks } }),

  // --- comments / follows (require token) ---
  listComments: (billId) => request(`/bills/${billId}/comments`),
  postComment: (token, billId, body) => request(`/bills/${billId}/comments`, { method: "POST", token, body: { body } }),
  deleteComment: (token, commentId) => request(`/comments/${commentId}`, { method: "DELETE", token }),
  myFollows: (token) => request("/me/follows", { token }),
  follow: (token, kind, targetId) => request("/follows", { method: "POST", token, body: { kind, target_id: targetId } }),
  unfollow: (token, kind, targetId) => request(`/follows/${kind}/${targetId}`, { method: "DELETE", token }),

  // --- admin: review queue ---
  adminQueue: (token) => request("/admin/queue", { token }),
  approveContent: (token, contentId) => request(`/admin/queue/${contentId}/approve`, { method: "POST", token }),
  rejectContent: (token, contentId) => request(`/admin/queue/${contentId}/reject`, { method: "POST", token }),
  editContent: (token, contentId, fields) => request(`/admin/queue/${contentId}`, { method: "PATCH", token, body: fields }),

  // --- admin: entities / dashboard ---
  adminEntities: (token, params) => request("/admin/entities", { token, params }),
  adminDashboard: (token) => request("/admin/dashboard", { token }),

  // --- admin: bill processing (selective, cancellable) ---
  processPdf: (token, billId) => request(`/admin/bills/${billId}/process/pdf`, { method: "POST", token }),
  processAi: (token, billId) => request(`/admin/bills/${billId}/process/ai`, { method: "POST", token }),
  cancelJob: (token, jobId) => request(`/admin/jobs/${jobId}/cancel`, { method: "POST", token }),
  billJobs: (token, billId) => request(`/admin/bills/${billId}/jobs`, { token }),
  listJobs: (token, status) => request("/admin/jobs", { token, params: { status } }),
};

export { ApiError };
