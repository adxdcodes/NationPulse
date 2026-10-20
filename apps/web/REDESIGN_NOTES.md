# NationPulse frontend redesign

The frontend uses the Cherry Blossom design system described in the
NationPulse Frontend Redesign PRD. The default light theme uses blush,
mint, pink and warm white surfaces with derived dark text and rose
controls. First-time visitors follow the operating-system theme
preference; saved choices persist.

The public landing page lives at `/`. The authenticated bill feed is at
`/bills`, with bill details at `/bills/:id`. Existing `/event/:id` links
redirect to the matching detail page. The landing page includes an
editorial product introduction, process steps, benefits, and recent bill
previews when the public bills request succeeds.

The bill feed uses the API's normalized status values and a responsive,
text-first multi-column layout. Bill detail pages use an editorial header,
readable summary measure, and a sticky facts panel on desktop. Shared
theme tokens are in `src/context/ThemeContext.jsx`; global and responsive
styles are in `src/index.css`.

The backend, database, API contracts, authentication rules, and AI
pipeline are unchanged. To run locally, install dependencies, configure
the root Vite environment, run the API, then start Vite with `npm run
dev`.
