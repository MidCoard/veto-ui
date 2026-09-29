# Plugin administration

- The administrator plugin list shows the installed package lifecycle state and offers a single enable or disable action for each package.
- An in-flight transition disables refresh and other plugin actions. A successful transition reloads the catalog; a failed transition retains the prior catalog and shows the server error.
- Disabled or declined packages may be retried with enable. This page does not delete plugin data.

# Plugin question workflow contract

- Builtin owns pending question cards, labels, selections, custom answers and authenticated list/answer/cancel actions.
- No answer is implicitly selected. Complete batches and a maximum of 500 Unicode code points per answer are required before submission.
- Locale changes and temporary disconnection retain local input; disconnected controls cannot submit or cancel. Failed writes preserve input and permit an explicit retry.
- Confirmed answer/cancel removes the card; failed requests do not. Session changes, agent changes and plugin unloading remove old cards and abort requests.
- Historical calls retain complete question JSON and persisted results as inert generic text; no host feature-specific selection inference is made.

# Connection and conversation state contract

- The real-time bus owns connection labels. Header and both composers use the same localized labels; a disconnected socket does not prove the backend process stopped.
- When disconnected, keep cached conversation content and editable message drafts. Disable sending, cancelling, approvals and question submission until reconnected. Do not show live running animations or elapsed timers.
- Cached agent state must be marked as awaiting update; do not present it as live activity or repeat actionable wait instructions as current facts.
- First-message invitations appear only after history loads successfully and is empty. Loading and failed loads have distinct copy. Missing system prompts have neutral copy without claims about data loss.
- Test disconnection, reconnection, retained drafts, empty/loading/error history, and stale agent cards in both locales.


# Recoverable model response errors

- Parser/schema rejections with `recoverable: true` are counted per agent in ConversationPane, including persisted history after reload. They do not create stopped-run cards or end the session. Raw records retain diagnostic details.
- Terminal execution errors keep their existing actionable error cards; cancellation and request budgets still apply.
- The count is localized, compact, and shared by primary and selected-agent conversation headers.

# Select ownership

Existing model-tier, session-role and pattern-filter selects intentionally use native select behavior and browser keyboard/popup handling. Keep their existing styled triggers; this extraction introduces no replacement select.

# Plugin-owned inspectors

The host mounts generic registered panels and provides scoped actions, connection state and invalidations. Each plugin owns labels, empty/error/loading states, stale-data handling and pending-action cancellation. Disconnected panels retain cached content and disable writes. Feature-specific monitor translations and controls ship with builtin, not the host.

# Plugin tool rendering contract

- Calls, results and compact conversation previews resolve through one generic registry. Producer plugin/local identity takes priority; old aliases only match one owner.
- Reject foreign IDs and duplicate declarations for one producer across modules. Catalog alias changes refresh registrations; unload restores safe generic rendering.
- Raw input and output stay available after malformed data, missing plugins and rendering failures. Failed conversation calls keep one visible failure reason; full result payloads stay in Records or raw disclosures.
- Plugin call/result content retains readable links, inert untrusted text, bilingual labels and bounded narrow-screen previews.

# Background task interaction

Task actions submit the displayed immutable instance ID once. Stop/remove failures remain visible and trigger a read refresh; they are never replayed automatically. Disconnection disables writes while preserving cached output. Only confirmed empty responses show the empty state. Lists and live output have explicit More/Refresh controls; refresh resets the live buffer cursor.
