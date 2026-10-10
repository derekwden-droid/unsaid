// What unsaid does before Claude asks the user something (AskUserQuestion) or asks them to
// approve a plan (ExitPlanMode). If the reply making that call has no visible text, and its
// thinking holds a message written for the user, the user never saw that message. Then:
// - in "resend" mode (the default) the question is held once, and Claude is told to send the
//   message as visible text and ask again; if the next try slips the same way, it goes through
//   with the hidden message shown to the user as a notice;
// - in "show" mode the question goes through and the hidden message is shown as a notice.

import { addressedToUser } from './detect.mjs';
import { replyFor } from './transcript.mjs';

export const MARKER = '[unsaid]';
const TOOLS = new Set(['AskUserQuestion', 'ExitPlanMode']);
const QUOTE_MAX = 1500;
const MODES = new Set(['resend', 'show']);

// The options the hook was started with: --mode=resend|show.
export function settings(argv = []) {
  const arg = argv.find((a) => a.startsWith('--mode='));
  const mode = arg ? arg.slice('--mode='.length).trim().toLowerCase() : '';
  return { mode: MODES.has(mode) ? mode : 'resend' };
}

function quote(text) {
  return text.length > QUOTE_MAX ? text.slice(0, QUOTE_MAX).trimEnd() + ' [...]' : text;
}

const what = (tool) => (tool === 'ExitPlanMode' ? 'plan approval' : 'question');

function notice(tool, hidden) {
  return 'unsaid: Claude wrote this for you before the ' + what(tool) + ', but it went into a hidden thinking block:\n\n' + quote(hidden);
}

export function handle(input, config = { mode: 'resend' }) {
  if (!input || input.hook_event_name !== 'PreToolUse' || !TOOLS.has(input.tool_name)) return null;
  const reply = replyFor(input.transcript_path, input.tool_use_id);
  if (!reply || reply.text || !addressedToUser(reply.thinking)) return null;

  const tool = input.tool_name;
  const heldBefore = reply.previousResult.includes(MARKER);
  if (config.mode === 'show' || heldBefore) {
    return {
      systemMessage: notice(tool, reply.thinking),
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        additionalContext: MARKER + ' The message you wrote before this ' + what(tool) + ' was in a thinking block, which the user cannot see. unsaid showed it to the user as a notice, so they have it now; next time, write messages for the user as visible text.',
      },
    };
  }
  return {
    systemMessage: 'unsaid: the message Claude wrote before this ' + what(tool) + ' went into a hidden thinking block. Asking Claude to send it as visible text first.',
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: MARKER + ' Held this ' + what(tool) + ': the user cannot see thinking blocks, and the message you wrote for them before it is in one, so they never saw it:\n\n' + quote(reply.thinking) + '\n\nWrite that message again as visible text in your reply, then call ' + tool + ' again with the same input. This is not an error in the ' + what(tool) + ' itself.',
    },
  };
}
