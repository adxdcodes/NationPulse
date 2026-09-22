# NationPulse frontend

## What's real now vs. still mock

- **Auth is real.** Signup/login hit the actual API (`src/api/client.js` →
  `api/routers/auth_router.py`), issuing a real JWT stored in
  `localStorage`. This works for every account, including admins.
- **Admin is real.** The entire `/admin` console — Dashboard, **Bills &
  Processing** (new), Review queue, Published, Comparator — reads and
  writes the live API. There is no more mock admin password: `/admin` is
  gated by `user.isAdmin`, a flag only your database can grant (see
  `api/README.md` — `UPDATE users SET is_admin = true WHERE email = '...'`).
  `AdminLogin.jsx` still exists only as a redirect, in case anything had
  the old `/admin/login` URL bookmarked.
- **The public pages (Home, event detail, Topics, MPs, Digest, search)
  are still on `src/data/mockData.js`**, unchanged from before. That's a
  deliberate scope boundary for this pass, not an oversight — wiring
  those to real bills is the natural next piece of work. Comments and
  follows on those mock pages still use the `localStorage`-based
  simulation in `src/data/socialStore.js`, now just backed by a real
  signed-in user identity instead of a fully-fake one.

## New: Bills & Processing (admin)

This is the actual point of this pass — full admin control over which
bills get processed, with live status and the ability to stop a running
job. `src/pages/admin/AdminLayout.jsx`:

- Lists every ingested bill with its PDF-extraction and AI-summary status.
- **Process PDF** / **Generate summary** buttons per bill — nothing runs
  until you click. Buttons disable themselves once a stage is already
  done or already running, based on real state from the API, not local
  guesswork.
- A **Running now** panel at the top, polling every 1.5s, listing every
  in-flight job across all bills with a one-click **Stop**.
- Expandable per-bill history showing past jobs and any error messages —
  polls at a calmer 4s so it doesn't hammer the API in the common case
  where nothing's currently running.
- Talks directly to the endpoints proven working in `api/routers/processing.py`
  (`/admin/bills/{id}/process/pdf`, `/process/ai`, `/admin/jobs/{id}/cancel`,
  `/admin/bills/{id}/jobs`, `/admin/jobs?status=running`) — the same ones
  verified end-to-end against real subprocesses, real cancellation, and
  the retry-after-cancel fix.
- **Search** (debounced 350ms, so typing doesn't hit the API per keystroke),
  **sortable columns** (Bill, Date — click to sort, click again to flip
  direction), **pagination** (20/page), and **checkbox multi-select** with
  bulk **Process PDF** / **Generate summaries** for everything selected.
  Bulk actions fire one bill at a time, not all at once, and use the exact
  same eligibility rule as the per-row buttons — verified those two never
  disagree by testing 6 bill-state combinations directly. Selection is
  deliberately scoped to bills currently loaded on screen, cleared on
  page/sort/search change, so "12 selected" is never a guess about rows
  you haven't seen.
- **New tab: Processed Bills** — the same table and controls, but scoped
  to bills that have been through at least one processing stage
  (`processed_only=true`), with an extra status filter (Not yet
  summarized / Generating / Pending review / Approved / Rejected /
  Failed). Built as one shared `BillManager` component parameterized by
  `mode` rather than two separate implementations, so search, sort,
  pagination, and bulk actions behave identically in both places.
- **Document action links**, in each bill's expandable history panel: a
  "Source PDF" link (the original external URL, e.g. from sansad.in) and
  an "Extracted text" link (the locally-extracted plain text, served by
  the API's static file mount — see `api/README.md` "Serving extracted
  text"). Both come pre-built in `bill.documents` from `/admin/entities` —
  no extra request needed to show them when a row expands. Deliberately
  *not* a separate top-level "History" tab: `Processed Bills` already
  covers that exact need (search, filter, sort, pagination) with more
  capability than a simpler dedicated tab would add, so this extends the
  existing per-bill panel instead of duplicating a near-identical view.

## Setup

```bash
npm install
cp .env.example .env    # point VITE_API_URL at your running api/ service
npm run dev
```

The API needs to actually be running (`uvicorn main:app --reload` in
`api/`, per the root `RUNBOOK.md`) for anything past the public mock
pages to work — sign-up, login, and the entire admin console all make
real network calls now.

## Files that changed from the previous delivery

| File | What changed |
|---|---|
| `src/api/client.js` | **New.** Thin fetch wrapper for every API endpoint the frontend uses. |
| `src/context/AuthContext.jsx` | Rewritten — real `/auth/signup` \| `/auth/login` calls instead of a localStorage mock. Same function signatures, so nothing that calls `useAuth()` elsewhere needed to change. |
| `src/pages/admin/AdminLayout.jsx` | Fully rewritten against the live API, plus the new Bills & Processing tab. |
| `src/pages/admin/AdminLogin.jsx` | Reduced to a redirect stub — see above. |
| `src/App.jsx` | `RequireAdmin` now checks `useAuth().isAdmin` instead of a sessionStorage flag. |
| `src/pages/Login.jsx`, `Signup.jsx` | Minor: `login`/`signup` are now async (real network calls), so these await them and show a submitting state. |
| Everything else | Unchanged from the previous delivery. |

Verified: the whole project bundles cleanly (esbuild, dependency
resolution across every file) before packaging — same verification
approach as every other piece of this project.
