// Reads the reply that made a tool call back out of the session transcript. Claude Code writes
// each block of a reply (thinking, text, tool_use) as its own row, all sharing one message id,
// and every row is on disk before PreToolUse runs for that reply's tool call.

import fs from 'node:fs';

const TAIL_BYTES = 768 * 1024;

function readTail(file) {
  try {
    const size = fs.statSync(file).size;
    const length = Math.min(size, TAIL_BYTES);
    const fd = fs.openSync(file, 'r');
    try {
      const buf = Buffer.alloc(length);
      fs.readSync(fd, buf, 0, length, size - length);
      const text = buf.toString('utf8');
      return length < size ? text.slice(text.indexOf('\n') + 1) : text;
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return '';
  }
}

function parse(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

const blocks = (row) => (row && row.message && Array.isArray(row.message.content) ? row.message.content : []);

function resultText(block) {
  if (typeof block.content === 'string') return block.content;
  if (Array.isArray(block.content)) return block.content.map((b) => (b && typeof b.text === 'string' ? b.text : '')).join('\n');
  return '';
}

// The reply holding the tool call `toolUseId`:
// { thinking, text, previousResult } where thinking is the reply's non-empty thinking text,
// text is its visible text, and previousResult is the text of the last tool result before the
// reply (used to see whether unsaid already held this question once). Null when not found.
export function replyFor(file, toolUseId) {
  if (typeof file !== 'string' || !file || typeof toolUseId !== 'string' || !toolUseId) return null;
  const rows = [];
  for (const line of readTail(file).split('\n')) {
    if (!line.includes('"assistant"') && !line.includes('"tool_result"')) continue;
    const row = parse(line);
    if (row) rows.push(row);
  }
  const callAt = rows.findIndex((r) => r.type === 'assistant' && blocks(r).some((b) => b && b.type === 'tool_use' && b.id === toolUseId));
  if (callAt < 0) return null;
  const messageId = rows[callAt].message.id;
  const thinking = [];
  const text = [];
  let first = callAt;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.type !== 'assistant' || !row.message || (messageId ? row.message.id !== messageId : i !== callAt)) continue;
    first = Math.min(first, i);
    for (const b of blocks(row)) {
      if (b && b.type === 'thinking' && typeof b.thinking === 'string' && b.thinking.trim()) thinking.push(b.thinking.trim());
      if (b && b.type === 'text' && typeof b.text === 'string' && b.text.trim()) text.push(b.text.trim());
    }
  }
  let previousResult = '';
  for (let i = first - 1; i >= 0; i--) {
    const results = blocks(rows[i]).filter((b) => b && b.type === 'tool_result');
    if (results.length) {
      previousResult = results.map(resultText).join('\n');
      break;
    }
  }
  return { thinking: thinking.join('\n\n'), text: text.join('\n\n'), previousResult };
}
