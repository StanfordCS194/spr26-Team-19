/** Common small numbers the model spells out when over-avoiding "code-like" prompts. */
const WORD_TO_DIGIT: Record<string, string> = {
  zero: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  ten: "10",
  eleven: "11",
  twelve: "12",
  thirteen: "13",
  fourteen: "14",
  fifteen: "15",
  sixteen: "16",
  seventeen: "17",
  eighteen: "18",
  nineteen: "19",
  twenty: "20",
  thirty: "30",
  forty: "40",
  fifty: "50",
};

const SPELLED_NUMBER = new RegExp(
  `\\b(${Object.keys(WORD_TO_DIGIT).join("|")})\\b`,
  "gi",
);

/** Normalize prompts that spell out data values ("five" → "5"). */
export function normalizePromptDigits(prompt: string): string {
  return prompt.replace(SPELLED_NUMBER, (word) => {
    const key = word.toLowerCase();
    return WORD_TO_DIGIT[key] ?? word;
  });
}

export function promptUsesSpelledNumbers(prompt: string): boolean {
  return SPELLED_NUMBER.test(prompt);
}

/** Count data integers listed before "Set answer" (source array values). */
export function countSourceValuesInPrompt(prompt: string): number {
  const beforeAnswer = prompt.split(/\bset\s+`?answer\b/i)[0] ?? prompt;
  return beforeAnswer.match(/\d+/g)?.length ?? 0;
}

/**
 * Reject ambiguous wording like "the middle element" on an even-length array (4 values → no single middle).
 */
export function promptAmbiguityIssues(prompt: string): string | null {
  if (!/\bmiddle element\b/i.test(prompt)) return null;
  const n = countSourceValuesInPrompt(prompt);
  if (n >= 2 && n % 2 === 0) {
    return `even-length array (${n} values) with singular "middle element" is ambiguous — use an index (e.g. index 1) or say "two middle elements"`;
  }
  return null;
}
