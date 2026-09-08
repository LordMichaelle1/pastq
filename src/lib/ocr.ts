import { extractTextFromImage, isSupported } from 'expo-text-extractor';

import { parseQuestions } from './parse-paper';

/** Whether this device can recognise text at all. Vision on iOS, ML Kit on Android. */
export const ocrSupported: boolean = isSupported;

export type ScanOutcome =
  /** Text was recognised and at least one question came out of it. */
  | { status: 'ok'; questions: string[]; lines: string[] }
  /** Text was recognised but none of it looked like a numbered question. */
  | { status: 'empty'; lines: string[] }
  | { status: 'unsupported' }
  | { status: 'failed'; message: string };

export async function scanPaper(uri: string): Promise<ScanOutcome> {
  if (!isSupported) return { status: 'unsupported' };

  let lines: string[];
  try {
    lines = await extractTextFromImage(uri);
  } catch (error) {
    // A recogniser failure is not the same as a page with no questions on it,
    // and the two need different words in front of the user.
    return {
      status: 'failed',
      message: error instanceof Error ? error.message : 'Could not read that image.',
    };
  }

  const questions = parseQuestions(lines);
  return questions.length > 0 ? { status: 'ok', questions, lines } : { status: 'empty', lines };
}
