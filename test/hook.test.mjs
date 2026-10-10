// Runs scripts/unsaid.mjs the way Claude Code does: hook input as JSON on stdin, reply as JSON
// on stdout, against transcripts shaped like Claude Code's session JSONL (one row per block,
// rows of one reply sharing a message id).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { addressedToUser, mostlyNonLatin } from '../scripts/lib/detect.mjs';
import { replyFor } from '../scripts/lib/transcript.mjs';
import { MARKER, settings } from '../scripts/lib/hook.mjs';

const SCRIPT = fileURLToPath(new URL('../scripts/unsaid.mjs', import.meta.url));
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'unsaid-'));
test.after(() => fs.rmSync(root, { recursive: true, force: true }));

// Japanese: "The plan is as follows. I have three questions." Stored as hex to keep this file ASCII.
const JA = Buffer.from('e8a888e794bbe381afe6aca1e381aee381a8e3818ae3828ae381a7e38199e38082e4b889e381a4e8b3aae5958fe3818ce38182e3828ae381bee38199e38082', 'hex').toString('utf8');

// Shaped like slips found in real transcripts.
const SLIP = "WPS's only street pants brand is RST, with about 12 styles. I have enough to proceed, so here's the certificate plan, followed by three quick questions for you.";
const SLIP_CURLY = 'Before rebuilding the resumes, I have a few quick questions' + String.fromCharCode(0x2014) + 'AI screeners mostly match on machine names, so your certifications matter. Here' + String.fromCharCode(0x2019) + 's what I need.';
// Shaped like real reasoning.
const REASONING = 'The user wants the export to keep the BOM. Let me check how the writer handles it before I ask which format they prefer.';
const NARRATION = 'Validation passes with 1 hook and no always-on tokens. Before committing, I will refine the placeholder rules.';

const ASK_INPUT = { questions: [{ question: 'Which plan?', header: 'Plan', options: [{ label: 'A', description: 'a' }, { label: 'B', description: 'b' }], multiSelect: false }] };

let count = 0;
// A transcript whose last reply has the given thinking and text and calls `tool`.
function transcript({ thinking = '', text = '', tool = 'AskUserQuestion', previous = 'ok', rows: extra = [] } = {}) {
  count += 1;
  const file = path.join(root, 'session-' + count + '.jsonl');
  const id = 'toolu_' + count;
  const mid = 'msg_' + count;
  const rows = [
    { type: 'user', message: { role: 'user', content: 'help me pick a plan' } },
    { type: 'assistant', message: { id: 'msg_prev' + count, role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_prev' + count, name: 'Read', input: {} }] } },
    { type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_prev' + count, content: previous }] } },
    { type: 'attachment' },
    ...extra,
    { type: 'assistant', message: { id: mid, role: 'assistant', content: [{ type: 'thinking', thinking, signature: 'sig' }] } },
  ];
  if (text) rows.push({ type: 'assistant', message: { id: mid, role: 'assistant', content: [{ type: 'text', text }] } });
  rows.push({ type: 'assistant', message: { id: mid, role: 'assistant', content: [{ type: 'tool_use', id, name: tool, input: ASK_INPUT }] } });
  fs.writeFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  return { file, id };
}

function run(input, args = []) {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], {
    input: typeof input === 'string' ? input : JSON.stringify(input),
    encoding: 'utf8',
  });
  return { status: result.status, stderr: result.stderr, reply: result.stdout ? JSON.parse(result.stdout) : null };
}

const pre = (t, tool = 'AskUserQuestion') => ({ hook_event_name: 'PreToolUse', transcript_path: t.file, tool_name: tool, tool_input: ASK_INPUT, tool_use_id: t.id });

test('tells messages for the user apart from reasoning', () => {
  assert.equal(addressedToUser(SLIP), true);
  assert.equal(addressedToUser(SLIP_CURLY), true);
  assert.equal(addressedToUser(JA), true);
  assert.equal(addressedToUser(REASONING), false);
  assert.equal(addressedToUser(NARRATION), false);
  assert.equal(addressedToUser(''), false);
  assert.equal(mostlyNonLatin(JA + ' API'), true);
  assert.equal(mostlyNonLatin('plain words'), false);
});

test('reads the calling reply back out of the transcript', () => {
  const t = transcript({ thinking: SLIP, text: 'Visible.', previous: 'file contents' });
  assert.deepEqual(replyFor(t.file, t.id), { thinking: SLIP, text: 'Visible.', previousResult: 'file contents' });
  assert.equal(replyFor(t.file, 'toolu_missing'), null);
  assert.equal(replyFor(path.join(root, 'missing.jsonl'), t.id), null);
});

test('holds a question whose context went into thinking, and quotes it back', () => {
  const r = run(pre(transcript({ thinking: SLIP })));
  assert.equal(r.status, 0);
  const out = r.reply.hookSpecificOutput;
  assert.equal(out.hookEventName, 'PreToolUse');
  assert.equal(out.permissionDecision, 'deny');
  assert.ok(out.permissionDecisionReason.startsWith(MARKER));
  assert.ok(out.permissionDecisionReason.includes(SLIP));
  assert.ok(out.permissionDecisionReason.includes('call AskUserQuestion again'));
  assert.match(r.reply.systemMessage, /^unsaid: the message Claude wrote before this question went into a hidden thinking block/);
});

test('covers plan approval too', () => {
  const r = run(pre(transcript({ thinking: SLIP_CURLY, tool: 'ExitPlanMode' }), 'ExitPlanMode'));
  assert.equal(r.reply.hookSpecificOutput.permissionDecision, 'deny');
  assert.ok(r.reply.hookSpecificOutput.permissionDecisionReason.includes('plan approval'));
});

test('holds a question whose context is in the user\'s own language', () => {
  const r = run(pre(transcript({ thinking: JA })));
  assert.equal(r.reply.hookSpecificOutput.permissionDecision, 'deny');
});

test('stays quiet when the reply has visible text', () => {
  assert.equal(run(pre(transcript({ thinking: SLIP, text: 'Here is the plan.' }))).reply, null);
});

test('stays quiet on reasoning, narration and empty thinking', () => {
  assert.equal(run(pre(transcript({ thinking: REASONING }))).reply, null);
  assert.equal(run(pre(transcript({ thinking: NARRATION }))).reply, null);
  assert.equal(run(pre(transcript({ thinking: '' }))).reply, null);
});

test('holds only once: a second slip goes through with a notice', () => {
  const r = run(pre(transcript({ thinking: SLIP, previous: MARKER + ' Held this question: ...' })));
  assert.equal(r.reply.hookSpecificOutput.permissionDecision, undefined);
  assert.ok(r.reply.hookSpecificOutput.additionalContext.startsWith(MARKER));
  assert.ok(r.reply.systemMessage.includes(SLIP));
});

test('show mode lets the question through and shows the hidden message', () => {
  const r = run(pre(transcript({ thinking: SLIP })), ['--mode=show']);
  assert.equal(r.reply.hookSpecificOutput.permissionDecision, undefined);
  assert.ok(r.reply.systemMessage.startsWith('unsaid: Claude wrote this for you before the question'));
  assert.ok(r.reply.systemMessage.includes(SLIP));
});

test('shortens a very long hidden message', () => {
  const long = SLIP + ' ' + 'More detail for you. '.repeat(200);
  const r = run(pre(transcript({ thinking: long })));
  assert.ok(r.reply.hookSpecificOutput.permissionDecisionReason.includes(' [...]'));
  assert.ok(r.reply.hookSpecificOutput.permissionDecisionReason.length < 2200);
});

test('reads its option and falls back to resend', () => {
  assert.deepEqual(settings(['--mode=show']), { mode: 'show' });
  assert.deepEqual(settings(['--mode=SHOW ']), { mode: 'show' });
  assert.deepEqual(settings(['--mode=']), { mode: 'resend' });
  assert.deepEqual(settings(['--mode=loud']), { mode: 'resend' });
  assert.deepEqual(settings([]), { mode: 'resend' });
});

test('ignores other tools and events', () => {
  const t = transcript({ thinking: SLIP, tool: 'Bash' });
  assert.equal(run(pre(t, 'Bash')).reply, null);
  assert.equal(run({ ...pre(transcript({ thinking: SLIP })), hook_event_name: 'PostToolUse' }).reply, null);
});

test('stays quiet when the tool call is not in the transcript', () => {
  const t = transcript({ thinking: SLIP });
  assert.equal(run({ ...pre(t), tool_use_id: 'toolu_other' }).reply, null);
  assert.equal(run({ ...pre(t), transcript_path: path.join(root, 'missing.jsonl') }).reply, null);
});

test('finds the reply when its rows are not next to each other', () => {
  const t = transcript({ thinking: SLIP, rows: [{ type: 'assistant', message: { id: 'msg_other', role: 'assistant', content: [{ type: 'text', text: 'Earlier visible text.' }] } }] });
  assert.equal(run(pre(t)).reply.hookSpecificOutput.permissionDecision, 'deny');
});

test('fails open on bad input', () => {
  const r = run('not json');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /^unsaid: /);
  assert.equal(r.reply, null);
});
