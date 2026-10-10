# unsaid

Sometimes Claude writes a message for you, then calls a tool in the same reply, and the message lands in a thinking block instead of the visible reply. You never see it. This hurts most right before a question: Claude explains three options, then asks "Which one?", and the explanation isn't there. Claude can't tell either. It behaves as though it told you, and a rule in CLAUDE.md doesn't help, because Claude believes it already followed the rule.

This is open on Anthropic's tracker as anthropics/claude-code 97504, with related reports in 95764, 94354, 91939, 89672 and 95621. It shows up with several models and has got worse with Opus 5.5. One user counted 0 of 1,611 replies with this shape on Opus 5 against 313 of 2,208 (14%) after switching to Opus 5.5.

unsaid checks right before Claude asks you something (AskUserQuestion) or asks you to approve a plan (ExitPlanMode). If the reply making that call has no visible text, and its thinking holds a message addressed to you, the question is held once. Claude gets the hidden message quoted back and is told to send it as visible text, then ask again. You see a one-line notice that this happened.

When Claude's reply already has visible text, or its thinking is ordinary reasoning ("the user wants...", "let me check..."), unsaid says nothing.

Here is what Claude receives when a question is held (the quoted message is from a real session):

```
[unsaid] Held this question: the user cannot see thinking blocks, and the message you wrote for them before it is in one, so they never saw it:

WPS's only street pants brand is RST, with about 12 styles I'll filter to those with 3+ sizes in stock. I have enough to proceed - here's the certificate plan, followed by three quick questions for you.

Write that message again as visible text in your reply, then call AskUserQuestion again with the same input. This is not an error in the question itself.
```

## How well it tells the two apart

Replayed against 96 real session transcripts, unsaid would have held 5 of 58 questions and plan approvals. All 5 had lost a message meant for the user, and it held none where nothing was lost. Across 3,805 reasoning blocks, its wording test mistook 41 (1.1%) for a message to the user. Those only matter when the same reply also asks a question and has no visible text.

## Try it

The slip comes and goes, so a single prompt may not trigger it. These prompts put context right before a question, which is where it happens:

1. "Compare three ways to cache this API's responses, explain the trade-offs, then ask me which one to use."
2. "Look through this repository, summarise what you find, then ask me what to work on first."
3. "Plan how to add dark mode to this app and ask me to approve the plan."

Whenever the context comes out hidden, Claude writes it out again before the question appears.

## Settings

There is one option, **When a message is hidden** (`on_hidden_message`). You can change it in `/config`.

- `resend` (the default): hold the question once and have Claude send the message as visible text first.
- `show`: let the question through and show you the hidden message as a notice.

If Claude slips again on the retry, the question goes through, and you see the hidden message as a notice. unsaid never holds the same question twice.

## What's included

- **One hook.** PreToolUse runs `node scripts/unsaid.mjs` before AskUserQuestion and ExitPlanMode, and before no other tool.

## What it reads, runs and sends

- **Reads** the end of this session's transcript. It uses this to find the reply that made the call and to see whether unsaid already held it once. It reads no other files.
- **Writes** nothing, and keeps no logs or state.
- **Runs** `node scripts/unsaid.mjs` before a question or plan approval only. That takes about 10 ms on top of starting Node.
- **Sends** nothing over the network. There is no telemetry and no account. See [PRIVACY.md](PRIVACY.md).

Its messages go into your conversation with Claude, like any other hook output.

## Limits

- It only checks questions and plan approvals. A message that slips before any other tool call, such as a progress note before a file read, is left alone, because those are frequent and mostly harmless.
- The wording test is tuned on English reasoning. A hidden message in another script, such as Japanese or Russian, counts as addressed to you. A hidden message in another Latin-script language is only caught if it uses English words like "you".
- If your setup records Claude's thinking as visible summaries, a rare reasoning block written in the second person can hold a question once. The cost is one extra message.
- It was checked live on Claude Code 2.1.295. Every row of a reply, its thinking included, is in the transcript before PreToolUse runs for that reply's tool call, and a held tool call reaches Claude with its reason. Both were checked with a probe hook; a real slip can't be produced on demand, so the held-question path itself is covered by the tests and the replay. The replay figures come from 96 transcripts on one Windows machine.
- If anything goes wrong inside the hook, nothing is blocked, and Claude Code shows a hook error notice.

## Requirements

- A Claude Code version with exec-form hooks (`"command"` plus `"args"`) and plugin options. Verified on 2.1.295 on Windows 11.
- Node.js 20 or later on your `PATH`.

## Development

`node --test` runs the tests. They need nothing beyond Node.

## License

MIT. See [LICENSE](LICENSE).
