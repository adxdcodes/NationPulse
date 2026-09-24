/** Thin fetch wrapper for the NationPulse API. Every function here mirrors
 * one endpoint in api/routers/*.py — see api/README.md for the full list.
 * Set VITE_API_URL in a .env file at the project root; defaults to the
 * local dev server.
 */
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

class ApiError extends Error {
  constructor(status, detail) {
    super(typeof detail === "string" ? detail : (detail ? JSON.stringify(detail) : `Request failed with status ${status}`));
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
  checkDocumentLink: (token, id) => request(`/admin/documents/${id}/check-link`, {method:"POST",token}),
  checkBillLinks: (token,id) => request(`/admin/bills/${id}/check-links`, {method:"POST",token}),
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

  ingestionStatus: (token) => request("/admin/ingestion/status", { token }),
  startIngestion: (token, house, dry_run) => request("/admin/ingestion/start", { method: "POST", token, body: { house, dry_run } }),
  ingestionLogs: (token, runId) => request(`/admin/ingestion/logs/${runId}`, { token }),

  // --- admin: entities / dashboard ---
  adminEntities: (token, params) => request("/admin/entities", { token, params }),
  adminDashboard: (token) => request("/admin/dashboard", { token }),

  // --- admin: bill processing (selective, cancellable) ---
  processPdf: (token, billId, documentId) => request(`/admin/bills/${billId}/process/pdf${documentId ? `?document_id=${documentId}` : ""}`, { method: "POST", token }),
  processAi: (token, billId, documentId) => request(`/admin/bills/${billId}/process/ai${documentId ? `?document_id=${documentId}` : ""}`, { method: "POST", token }),
  cancelJob: (token, jobId) => request(`/admin/jobs/${jobId}/cancel`, { method: "POST", token }),
  billJobs: (token, billId) => request(`/admin/bills/${billId}/jobs`, { token }),
  listJobs: (token, status) => request("/admin/jobs", { token, params: { status } }),
};

export { ApiError };
