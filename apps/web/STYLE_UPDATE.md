# NationPulse frontend — Pulse AI visual refresh

This archive is the complete `web` folder, not a partial patch. It uses the existing frontend from the ingestion-control update and includes the subsequent Pulse AI frontend files.

## Changes
- Unified input, textarea, select, button, focus, scrollbar, and typography styling across the frontend.
- Light/dark adaptive theme tokens and restrained blue focus states.
- Removed the hard-edged blue rectangle that appeared inside the chatbot composer on focus. The rounded outer composer retains a subtle accessible focus indicator.
- Kept the chatbot frontend-only; no Gemini calls or backend modifications.
- Preserved admin ingestion controls, authentication, and existing routes.

## Run
`npm install` then `npm run dev` from this folder.

## Note
The design update is primarily a shared stylesheet to respect existing page-specific inline styles. Components with explicit inline backgrounds/borders retain their existing colors until individually migrated to theme tokens.
