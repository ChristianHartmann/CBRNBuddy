import { extractNumbers, findPlacardPair, type INumberBlock } from '../placard-pairing';

/** Placard geometry: Kemler on top, UN below, both centred on the same axis. */
const block = (cleaned: string, centerY: number, centerX = 100): INumberBlock => ({
  cleaned,
  centerX,
  centerY,
  width: 60,
  height: 20,
});

const KNOWS_NOTHING = () => false;
const KNOWS_EVERYTHING = () => true;
const knowsOnly =
  (...known: string[]) =>
  (un: string) =>
    known.includes(un);

describe('findPlacardPair', () => {
  it('pairs a Kemler number above a UN number', () => {
    const pair = findPlacardPair([block('33', 100), block('1203', 130)], KNOWS_EVERYTHING);

    expect(pair).toMatchObject({ kemler: '33', un: '1203' });
  });

  it('ignores numbers that are not horizontally aligned', () => {
    const blocks = [block('33', 100, 100), block('1203', 130, 400)];

    expect(findPlacardPair(blocks, KNOWS_EVERYTHING)).toBeNull();
  });

  it('ignores numbers that are vertically too far apart', () => {
    const blocks = [block('33', 100), block('1203', 400)];

    expect(findPlacardPair(blocks, KNOWS_EVERYTHING)).toBeNull();
  });

  it('prefers the pair whose UN number is known, even if another pair sits closer', () => {
    const blocks = [
      block('33', 100, 100),
      block('9999', 115, 100), // closer, but unknown
      block('30', 300, 100),
      block('1203', 330, 100), // further apart, but known
    ];

    expect(findPlacardPair(blocks, knowsOnly('1203'))).toMatchObject({ un: '1203', unInDb: true });
  });

  it('picks the closest pair when no UN number is known, so two placards are not mixed', () => {
    const blocks = [
      block('33', 100, 100),
      block('1203', 130, 100),
      block('80', 500, 100),
    ];

    expect(findPlacardPair(blocks, KNOWS_NOTHING)).toMatchObject({ kemler: '33', un: '1203' });
  });

  it('splits a single block holding both numbers', () => {
    const pair = findPlacardPair([block('331203', 100)], KNOWS_EVERYTHING);

    expect(pair).toMatchObject({ kemler: '33', un: '1203' });
  });

  it('reports a paired but unknown UN number instead of discarding it', () => {
    const pair = findPlacardPair([block('33', 100), block('1203', 130)], KNOWS_NOTHING);

    expect(pair).toMatchObject({ un: '1203', unInDb: false });
  });

  it('returns null when there is no plausible pair', () => {
    expect(findPlacardPair([block('7', 100)], KNOWS_EVERYTHING)).toBeNull();
  });
});

describe('extractNumbers', () => {
  it('extracts a Kemler and a UN number from separate texts', () => {
    const result = extractNumbers(['33', '1203'], KNOWS_EVERYTHING);

    expect(result).toMatchObject({ kemlerNumber: '33', unNumber: '1203', unInDb: true });
  });

  it('strips surrounding characters before matching', () => {
    expect(extractNumbers(['(1203)'], KNOWS_EVERYTHING).unNumber).toBe('1203');
  });

  it('prefers a UN number that exists in the database', () => {
    const result = extractNumbers(['9999', '1203'], knowsOnly('1203'));

    expect(result.unNumber).toBe('1203');
  });

  it('still reports a UN number that is unknown to the database', () => {
    const result = extractNumbers(['9999'], KNOWS_NOTHING);

    expect(result).toMatchObject({ unNumber: '9999', unInDb: false });
  });

  it('accepts an X-prefixed Kemler number', () => {
    expect(extractNumbers(['X423', '1017'], KNOWS_EVERYTHING).kemlerNumber).toBe('X423');
  });

  it('splits a concatenated reading when nothing else matched', () => {
    const result = extractNumbers(['331203'], KNOWS_EVERYTHING);

    expect(result).toMatchObject({ kemlerNumber: '33', unNumber: '1203' });
  });
});
