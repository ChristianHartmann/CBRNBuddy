import TextRecognition from '@react-native-ml-kit/text-recognition';

import {
  cleanToDigitsAndX,
  extractNumbers,
  findPlacardPair,
  scoreCandidate,
  type INumberBlock,
  type UnNumberValidator,
} from './placard-pairing';

export interface IOCRResult {
  kemlerNumber: string | null;
  unNumber: string | null;
  allNumbers: string[];
  rawText: string;
  confidence: number;
}

// --- ML Kit (on-device) ---

/**
 * Read an image and turn it into a Kemler/UN pair.
 *
 * `isKnownUn` decides whether a read UN number exists, and is passed in rather than
 * looked up here: this module then depends on ML Kit alone, and the substance source
 * can be swapped by handing in a different function. See un-lookup.ts for the adapter
 * backed by the local database.
 */
export const recognizeText = async (
  imageUri: string,
  isKnownUn: UnNumberValidator
): Promise<IOCRResult> => {
  const result = await TextRecognition.recognize(imageUri);

  // Build geometry-aware number blocks from ML Kit lines AND blocks
  const numberBlocks: INumberBlock[] = [];
  for (const block of result.blocks) {
    // Line-level entries drive geometric pairing of separate lines (Strategy 1).
    let lineAdded = false;
    for (const line of block.lines) {
      if (!line.frame) continue;
      const cleaned = cleanToDigitsAndX(line.text);
      if (cleaned.length < 2 || cleaned.length > 5) continue;
      numberBlocks.push({
        cleaned,
        centerX: line.frame.left + line.frame.width / 2,
        centerY: line.frame.top + line.frame.height / 2,
        width: line.frame.width,
        height: line.frame.height,
      });
      lineAdded = true;
    }

    // Block-level entry is only worth adding when it contributes something the
    // line entries can't: a concatenated "33\n1203" (length >= 6, for Strategy 2)
    // or geometry for a short block whose lines had no usable frame. Adding it for
    // a short block already covered by a line entry only duplicates pairing work.
    if (block.frame) {
      const blockCleaned = cleanToDigitsAndX(block.text);
      if (blockCleaned.length >= 6 || (blockCleaned.length >= 2 && !lineAdded)) {
        numberBlocks.push({
          cleaned: blockCleaned,
          centerX: block.frame.left + block.frame.width / 2,
          centerY: block.frame.top + block.frame.height / 2,
          width: block.frame.width,
          height: block.frame.height,
        });
      }
    }
  }

  // Try geometric pairing first (high confidence). A geometrically matched pair
  // whose UN is not in the DB is still surfaced, but at reduced confidence.
  const pair = findPlacardPair(numberBlocks, isKnownUn);
  if (pair) {
    return {
      kemlerNumber: pair.kemler,
      unNumber: pair.un,
      allNumbers: [pair.kemler, pair.un],
      rawText: result.text,
      confidence: pair.unInDb ? 1.0 : 0.55,
    };
  }

  // Fallback: simple extraction from all text (DB presence affects confidence,
  // never suppression - an unknown UN is still reported for manual lookup).
  const texts = result.blocks.map((block) => block.text);
  const { kemlerNumber, unNumber, allNumbers, unInDb } = extractNumbers(texts, isKnownUn);
  let confidence = scoreCandidate(kemlerNumber, unNumber);
  if (unNumber && !unInDb) confidence = Math.min(confidence, 0.5);

  return {
    kemlerNumber,
    unNumber,
    allNumbers,
    rawText: result.text,
    confidence,
  };
};
