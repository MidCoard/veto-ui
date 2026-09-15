# Question workflow contract

- Pending questions have no implicit selected answer. Users select an option or enter a custom answer before submitting.
- A completed tool call reads its own persisted result, matched by call ID; answers match question IDs, never array position.
- Exact option-label matches show a localized Selected marker. Other answers display as user-entered text.
- Failed, cancelled, missing and malformed results never imply a selection.
- Refreshing history preserves recorded selections. A new call does not inherit local answer state.
- Conversation summaries show the complete batch and wrap long labels. Detailed records expose the same stored answers.
- Current locales are English and Simplified Chinese. Use the existing theme tokens in both themes.
