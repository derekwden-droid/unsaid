# Changelog

## 1.0.0 - 2026-10-10

- PreToolUse hook on AskUserQuestion and ExitPlanMode: when the reply making the call has no
  visible text and its thinking holds a message addressed to the user, holds the call once and
  has Claude send the message as visible text first, quoting it back.
- Never holds the same question twice: a second slip goes through with the hidden message shown
  to the user as a notice.
- `on_hidden_message` option: `resend` (the default) or `show`, which never holds anything and only
  shows the hidden message.
- Tells messages for the user apart from reasoning by wording: second person and "here's" against
  "the user", "let me" and "I should". Text mostly outside the Latin alphabet counts as addressed
  to the user.
