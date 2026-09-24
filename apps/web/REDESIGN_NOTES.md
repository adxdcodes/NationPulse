# NationPulse — Pulse AI visual redesign

This ZIP contains the complete `web/` frontend source. Replace the previous web folder (keep your local `.env` values).

The redesign changes the actual shared theme tokens used by existing inline-styled React pages, not only CSS focus rules. Dark mode is the default for first-time visitors; existing saved theme preferences remain respected. Both themes use Pulse AI's blue palette, with rounded feed cards, blue-gradient feed header, refreshed navigation, consistent inputs and controls, and the existing floating chatbot.

No backend/API contracts were changed. The chatbot remains frontend-only.

Install and build: `npm ci && npm run build`; start: `npm run dev`.

The React build could not run in the packaging environment because Vite dependencies were unavailable offline. Verify it in your local installation after `npm ci`.
