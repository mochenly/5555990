# Mnema modules

- `index.js` — composition root: chat lifecycle, feature coordination and event bindings.
- `renderer.js` — all feature rendering and participant visuals.
- `gallery-images.js` — image-provider requests, references, uploads and generation state.
- `template.js` — popup and sendbar menu markup.
- `calendar.js` — story-date parsing, calendar updates and calendar rendering.
- `prompts.js` — sparse model output contract, analysis/arc prompts, enabled-state projection and readable hidden memory.
- `state.js` — chat metadata persistence, normalization and sparse section updates.
- `analysis.js` — participant profiles, message selection, manual arc validation and rebuilding helpers.
- `model-api.js` — Connection Manager and manual Extra API transport.
- `config.js` — identifiers, defaults and shared feature metadata.
- `utils.js` — small DOM-safe helpers.

Keep feature-specific parsing, transport and rendering outside `index.js`; it should only coordinate modules and SillyTavern events.

## Memory contract

Analysis instructions are English; natural-language values follow the user's conversation language. Requests include character description/personality/scenario and the active persona description. Each automatic interval receives enabled section state and that interval's messages, without earlier interval notes. Notes are retained for final automatic arc summarization only. New chats start before message 0; older skipped greetings remain eligible.

Manual range and whole-chat analysis each send one request with all selected original messages and their existing indices. The model returns chronological arcs with inclusive `start_index`/`end_index`, title and summary. Validation requires complete, non-overlapping coverage. Whole-chat analysis also returns final section updates and `closed` per arc; an open final arc stays visible with a pending summary. Historical range analysis does not overwrite current section state. Replacement is staged until the response passes validation; cancellation, malformed responses or edits made during the request leave existing memory intact. No automatic chunking or follow-up summary request is used.

Updates are patches: missing/null/empty fields preserve known values. The relationship keeps its own ordered ladder per chat: analysis builds `relationship.ladder` (rungs named in the conversation language, with a note each) from this story's setting and bond, `phase` points at the rung reached, and `nextStep` names the nearest thing that has to happen before the next one. Rungs up to and including the current one are frozen — a later analysis may refine notes, re-draw what lies ahead, or insert an intermediate rung, but not rename, reorder or drop history. Analysis climbs one rung per interval so none is skipped; the first record may land anywhere, downward moves are unrestricted, and the editor allows any manual change including rewriting the ladder itself. Conditions use stable names and explicit `healed`/`resolved` status for removal; plans use stable titles and `cancelled`/`completed`. A location move clears the previous place's description and indoor flag. Secret disclosure moves the entry between lists.

The extension prompt includes readable current world, health, relationship, calendar, secrets and gallery data, respecting section toggles. It refreshes after analysis, setting changes and before generation. Unknown values are omitted; newer story events take precedence. Existing chronological arc messages remain in place; only legacy arcs without such messages use the fallback injection.

Regression checks (from repository root):

```sh
node --experimental-vm-modules --test public/scripts/extensions/third-party/Mnema/tests/memory.test.mjs public/scripts/extensions/third-party/Mnema/tests/manual.test.mjs
```
