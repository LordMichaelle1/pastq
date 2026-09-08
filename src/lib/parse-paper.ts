/**
 * Turns raw OCR lines into candidate questions.
 *
 * Exam papers are more structured than free text: numbered items, a preamble
 * of instructions nobody wants to revise, and questions that wrap across
 * several lines. This splits on the numbering and throws the rest away.
 *
 * Pure on purpose — the recogniser is a native module, but deciding what counts
 * as a question is ordinary logic and should be testable without a device.
 */

/** "1." "2)" "(3)" "Q4" "Question 5" — the ways papers number a question. */
const QUESTION_START =
  /^\s*\(?\s*(?:Q(?:uestion)?\s*\.?\s*)?(\d{1,2})\s*(?:[.)\]:]|\s)\s*(?=\S)/i;

/** Lines that belong to the paper's furniture rather than to a question. */
const BOILERPLATE =
  /^\s*(?:section\b|answer\s|attempt\s|instructions?\b|time\s+allowed|do\s+not\b|university\b|faculty\b|department\b|college\b|course\s+(?:code|title)\b|semester\b|session\b|total\s+marks?\b|page\s+\d|marks?\s*[:=]|turn\s+over\b)/i;

/** Sub-parts stay with their parent; "(a)" alone is not a question. */
const SUBPART_ONLY = /^\s*\(?[a-z]\)?[.)]?\s*$/i;

const MIN_LENGTH = 12;

export type ParseOptions = {
  /** Shortest run of text accepted as a question. */
  minLength?: number;
};

function isNoise(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (BOILERPLATE.test(trimmed)) return true;
  if (SUBPART_ONLY.test(trimmed)) return true;
  // A line of digits, marks or rules carries nothing to revise.
  if (/^[\d\s.,;:_\-—–|]+$/.test(trimmed)) return true;
  return false;
}

export function parseQuestions(lines: string[], options: ParseOptions = {}): string[] {
  const minLength = options.minLength ?? MIN_LENGTH;

  const questions: string[] = [];
  let current: string[] | null = null;

  for (const raw of lines) {
    const line = raw.replace(/\s+/g, ' ').trim();
    if (!line) continue;

    const start = QUESTION_START.exec(line);

    if (start) {
      if (current) questions.push(current.join(' '));
      // Drop the number itself; it means nothing once the question is a card.
      current = [line.slice(start[0].length).trim()];
      continue;
    }

    // Anything before the first numbered item is preamble.
    if (!current) continue;
    if (isNoise(line)) continue;

    current.push(line);
  }

  if (current) questions.push(current.join(' '));

  return questions
    .map((q) => q.replace(/\s+/g, ' ').trim())
    .filter((q) => q.length >= minLength);
}
