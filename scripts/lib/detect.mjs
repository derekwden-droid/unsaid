// Tells a message written for the user apart from Claude's own reasoning. Both can end up in a
// thinking block, so the wording decides:
// - reasoning talks about the user in the third person and to itself ("the user wants",
//   "let me check", "I should");
// - a message meant for the user talks to them ("you", "your", "here's the plan", "below").
// Measured on 96 real session transcripts: this flags 5 of 6 slipped messages before a question
// and 41 of 3,805 reasoning blocks (1.1%).
// Text that is mostly outside the Latin alphabet (Japanese, Korean, Russian and so on) counts as
// addressed to the user unless it uses the English self-talk phrases, since a reply written in
// the user's own language is the slip and reasoning is usually written in English.

const APOSTROPHES = [String.fromCharCode(0x2018), String.fromCharCode(0x2019)];

const ADDRESSED = /\b(you|your|yours|you're|you'll|you'd|you've|here's|here are|here is|below|let me know|shall i|should i|would you|do you|want me to)\b/i;
const SELF_TALK = /\b(the user|the user's|they want|they asked|let me|let's|i need to|i'll need|i should|i must|i'm going to|i will now|okay,|hmm)\b/i;

function plain(text) {
  let out = String(text || '');
  for (const a of APOSTROPHES) out = out.split(a).join("'");
  return out;
}

// True when most letters in the text are outside the basic Latin alphabet.
export function mostlyNonLatin(text) {
  let latin = 0;
  let other = 0;
  for (const ch of String(text || '')) {
    if (/[A-Za-z]/.test(ch)) latin++;
    else if (/\p{L}/u.test(ch)) other++;
  }
  return other > 0 && other >= latin;
}

// True when `thinking` reads as a message for the user rather than reasoning.
export function addressedToUser(thinking) {
  const text = plain(thinking).trim();
  if (!text) return false;
  if (SELF_TALK.test(text)) return false;
  return ADDRESSED.test(text) || mostlyNonLatin(text);
}
