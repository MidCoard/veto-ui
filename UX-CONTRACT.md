# Question workflow contract

- Pending questions have no implicit selected answer. Users select an option or enter a custom answer before submitting.
- A completed tool call reads its own persisted result, matched by call ID; answers match question IDs, never array position.
- Exact option-label matches show a localized Selected marker. Other answers display as user-entered text.
- Failed, cancelled, missing and malformed results never imply a selection.
- Refreshing history preserves recorded selections. A new call does not inherit local answer state.
- Conversation summaries show the complete batch and wrap long labels. Detailed records expose the same stored answers.
- Current locales are English and Simplified Chinese. Use the existing theme tokens in both themes.

# Connection and conversation state contract

- The real-time bus owns connection labels. Header and both composers use the same localized labels; a disconnected socket does not prove the backend process stopped.
- When disconnected, keep cached conversation content and editable message drafts. Disable sending, cancelling, approvals and question submission until reconnected. Do not show live running animations or elapsed timers.
- Cached agent state must be marked as awaiting update; do not present it as live activity or repeat actionable wait instructions as current facts.
- First-message invitations appear only after history loads successfully and is empty. Loading and failed loads have distinct copy. Missing system prompts have neutral copy without claims about data loss.
- Test disconnection, reconnection, retained drafts, empty/loading/error history, and stale agent cards in both locales.

- Questions accept 2–5 options. The application marks the first as recommended; models provide plain labels. Recommendation never implies selection. Presentation uses userQuestionLabel for pending, summary and detailed views, preserving raw labels and answer identities (including legacy suffixes).

# Recoverable model response errors

- Parser/schema rejections with `recoverable: true` are counted per agent in ConversationPane, including persisted history after reload. They do not create stopped-run cards or end the session. Raw records retain diagnostic details.
- Terminal execution errors keep their existing actionable error cards; cancellation and request budgets still apply.
- The count is localized, compact, and shared by primary and selected-agent conversation headers.
