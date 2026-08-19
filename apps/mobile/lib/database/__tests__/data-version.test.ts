import { needsReseed, serializeDataVersion } from '../data-version';

const VERSION = {
  substances: 'a1b2c3',
  ericards: 'd4e5f6',
} as const;

describe('needsReseed', () => {
  it('seeds on a fresh install, when no version is stored', () => {
    expect(needsReseed(null, VERSION)).toBe(true);
  });

  it('does not seed when the stored version matches the data', () => {
    expect(needsReseed(serializeDataVersion(VERSION), VERSION)).toBe(false);
  });

  it('seeds again when a dataset changed', () => {
    const stored = serializeDataVersion(VERSION);

    expect(needsReseed(stored, { ...VERSION, substances: 'CHANGED' })).toBe(true);
  });

  it('seeds again when a dataset is added', () => {
    const stored = serializeDataVersion(VERSION);

    expect(needsReseed(stored, { ...VERSION, ghsPictograms: 'added' })).toBe(true);
  });

  it('seeds again when the stored version is unreadable', () => {
    expect(needsReseed('not-a-valid-value', VERSION)).toBe(true);
  });
});

describe('serializeDataVersion', () => {
  it('is independent of the key order', () => {
    const a = serializeDataVersion({ substances: 'x', ericards: 'y' });
    const b = serializeDataVersion({ ericards: 'y', substances: 'x' });

    expect(a).toBe(b);
  });
});
