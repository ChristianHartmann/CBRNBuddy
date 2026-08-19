/**
 * Turning OCR text into a Kemler/UN pair.
 *
 * Free of native modules and database access, so the rules deciding which
 * substance an incident commander is shown can be tested directly. The database
 * lookup is injected as an UnNumberValidator.
 */

// --- Number extraction (mirrors backend extract_numbers logic) ---

const KEMLER_PATTERN = /^X?\d{2,3}$/;
const UN_PATTERN = /^\d{4}$/;

export const cleanToDigitsAndX = (text: string): string =>
  text.toUpperCase().replace(/[^X\d]/g, '');

export type UnNumberValidator = (unNumber: string) => boolean;

export const extractNumbers = (
  texts: string[],
  isKnownUn: UnNumberValidator,
): {
  kemlerNumber: string | null;
  unNumber: string | null;
  allNumbers: string[];
  unInDb: boolean;
} => {
  // Up to 7 characters: a concatenated "331203" is 6 to 7 long and would otherwise be
  // dropped here, leaving the split fallback below unreachable. Such a string matches
  // neither the Kemler nor the UN pattern, so admitting it changes nothing else.
  const allNumbers: string[] = [];
  for (const text of texts) {
    const cleaned = cleanToDigitsAndX(text);
    if (cleaned.length >= 2 && cleaned.length <= 7) {
      allNumbers.push(cleaned);
    }
  }

  const unCandidates = allNumbers.filter((n) => UN_PATTERN.test(n));
  let kemlerNumber: string | null =
    allNumbers.find((n) => KEMLER_PATTERN.test(n)) ?? null;

  // Prefer a UN that exists in the local DB, but never discard a correctly-read
  // one - an unknown-but-valid UN must still surface (e.g. for "not in DB → TUIS").
  let unNumber: string | null =
    unCandidates.find((n) => isKnownUn(n)) ?? unCandidates[0] ?? null;
  let unInDb = unNumber !== null && isKnownUn(unNumber);

  // Fallback: try splitting concatenated strings (e.g. "331203")
  if (!kemlerNumber && !unNumber) {
    for (const num of allNumbers) {
      const split = trySplitKemlerUn(num, isKnownUn);
      if (split) {
        kemlerNumber = split.kemler;
        unNumber = split.un;
        unInDb = split.unInDb;
        break;
      }
    }
  }

  return { kemlerNumber, unNumber, allNumbers, unInDb };
};

export const scoreCandidate = (kemler: string | null, un: string | null): number => {
  let score = 0;
  if (un) score += 0.6;
  if (kemler) score += 0.3;
  if (un && kemler) score += 0.1;
  return score;
};

// --- Textblock geometry analysis (replaces HSV color detection) ---

export interface INumberBlock {
  cleaned: string;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
}

/**
 * Try to split a single text into Kemler + UN (e.g. "331203" or "33 1203").
 * Structural validity (Kemler + UN regex) gates the split; DB presence is
 * reported via `unInDb` for confidence scoring, not used to suppress the result.
 */
const trySplitKemlerUn = (
  text: string,
  isKnownUn: UnNumberValidator,
): { kemler: string; un: string; unInDb: boolean } | null => {
  const cleaned = cleanToDigitsAndX(text);
  if (cleaned.length >= 6 && cleaned.length <= 7) {
    const kemler = cleaned.slice(0, cleaned.length - 4);
    const un = cleaned.slice(-4);
    if (KEMLER_PATTERN.test(kemler) && UN_PATTERN.test(un)) {
      return { kemler, un, unInDb: isKnownUn(un) };
    }
  }
  return null;
};

/**
 * Find a Kemler/UN pair from ML Kit text blocks.
 * Strategy 1: Two separate number blocks vertically stacked (geometric pairing).
 * Strategy 2: A single block containing both numbers (e.g. "33\n1203").
 */
export const findPlacardPair = (
  blocks: INumberBlock[],
  isKnownUn: UnNumberValidator,
): { kemler: string; un: string; unInDb: boolean } | null => {
  const candidates = blocks.filter((b) => /^X?\d{2,5}$/.test(b.cleaned));

  // Strategy 1: Two blocks geometrically arranged like a placard.
  // Collect every geometrically valid pair, then pick the best: prefer a UN that
  // exists in the DB, and within the same tier the spatially closest pair (so a
  // Kemler/UN from two different placards in frame is not wrongly combined).
  let best:
    | { kemler: string; un: string; unInDb: boolean; distance: number }
    | null = null;
  for (const a of candidates) {
    for (const b of candidates) {
      if (a === b) continue;

      const un = UN_PATTERN.test(a.cleaned) ? a : UN_PATTERN.test(b.cleaned) ? b : null;
      const kemler = KEMLER_PATTERN.test(a.cleaned) ? a : KEMLER_PATTERN.test(b.cleaned) ? b : null;
      if (!un || !kemler || un === kemler) continue;

      // Horizontally aligned? (centers within half the wider block's width)
      const horizontalOffset = Math.abs(un.centerX - kemler.centerX);
      const maxWidth = Math.max(un.width, kemler.width);
      if (horizontalOffset > maxWidth * 0.5) continue;

      // Vertically close? (gap less than 3x the taller block's height)
      const verticalGap = Math.abs(un.centerY - kemler.centerY);
      const maxHeight = Math.max(un.height, kemler.height);
      if (verticalGap > maxHeight * 3) continue;

      const unInDb = isKnownUn(un.cleaned);
      const distance = horizontalOffset + verticalGap;
      if (
        !best ||
        (unInDb && !best.unInDb) ||
        (unInDb === best.unInDb && distance < best.distance)
      ) {
        best = { kemler: kemler.cleaned, un: un.cleaned, unInDb, distance };
      }
    }
  }
  if (best) {
    return { kemler: best.kemler, un: best.un, unInDb: best.unInDb };
  }

  // Strategy 2: Single block with concatenated Kemler+UN (e.g. "331203")
  for (const block of blocks) {
    const split = trySplitKemlerUn(block.cleaned, isKnownUn);
    if (split) return split;
  }

  return null;
};
