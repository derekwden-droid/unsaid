// unsaid's hook entry point. The plugin's hooks.json runs it before AskUserQuestion and
// ExitPlanMode (PreToolUse). It reads the hook input as JSON on standard input and prints a JSON
// reply only when the message Claude wrote for the user went into a hidden thinking block. Any
// error exits with status 1, which Claude Code reports without stopping anything.

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function main() {
  const raw = await readStdin();
  const { handle, settings } = await import('./lib/hook.mjs');
  const reply = handle(JSON.parse(raw), settings(process.argv.slice(2)));
  if (reply) process.stdout.write(JSON.stringify(reply));
}

main().catch((err) => {
  process.stderr.write('unsaid: ' + (err && err.message ? err.message : String(err)) + '\n');
  process.exitCode = 1;
});
