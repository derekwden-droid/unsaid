# unsaid plugin privacy policy

Last updated: October 10, 2026

The unsaid plugin for Claude Code collects no data. It has no servers, no accounts, no analytics
and no telemetry, and it never connects to the network.

## What the plugin accesses

Before Claude asks you a question or asks you to approve a plan, Claude Code passes the plugin the
tool call and the location of the session's transcript, which Claude Code keeps on your computer.
The plugin reads the end of that transcript to find the reply that made the call: its thinking,
its visible text and the tool result before it. It reads no other files.

## What happens to that data

The plugin either says nothing or returns a message. That message can quote a part of Claude's own
thinking that was written for you, so that Claude can send it to you as visible text, or so you
can see it as a notice. The plugin writes nothing to disk and keeps no logs, caches or copies.

Its messages become part of your conversation with Claude, like any other hook output. How
Anthropic handles your conversations is covered by Anthropic's own privacy policy, not this one.

## Retention

None. Nothing outlives the hook call that read it.

## Changes and contact

Changes to this policy are made in this file and recorded in the repository's history. Questions
go to [github.com/derekwden-droid/unsaid/issues](https://github.com/derekwden-droid/unsaid/issues).
