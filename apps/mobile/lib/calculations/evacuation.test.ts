import { calculateEvacuationRadius } from './evacuation';

describe('calculateEvacuationRadius', () => {
  // --- Chlorine (UN 1017) - ERG specific entry ---
  it('returns ERG values for Chlorine small spill day', () => {
    const result = calculateEvacuationRadius({
      unNumber: '1017',
      quantity: 100,
      isNight: false,
    });
    expect(result.initialIsolationRadius).toBe(75); // 60m rounded up to 75
    expect(result.protectiveActionDistance).toBe(300); // 0.3km = 300m
    expect(result.isLargeSpill).toBe(false);
    expect(result.isFallback).toBe(false);
    expect(result.source).toContain('UN 1017');
  });

  it('returns ERG values for Chlorine large spill night', () => {
    const result = calculateEvacuationRadius({
      unNumber: '1017',
      quantity: 500,
      isNight: true,
    });
    expect(result.initialIsolationRadius).toBe(600); // 600m exactly
    expect(result.protectiveActionDistance).toBe(3900); // 3.9km = 3900m
    expect(result.isLargeSpill).toBe(true);
    expect(result.isFallback).toBe(false);
  });

  it('returns larger values at night vs day for Chlorine large spill', () => {
    const day = calculateEvacuationRadius({ unNumber: '1017', quantity: 500, isNight: false });
    const night = calculateEvacuationRadius({ unNumber: '1017', quantity: 500, isNight: true });
    expect(night.protectiveActionDistance).toBeGreaterThan(day.protectiveActionDistance);
  });

  // --- Ammonia (UN 1005) ---
  it('returns ERG values for Ammonia large spill night', () => {
    const result = calculateEvacuationRadius({
      unNumber: '1005',
      quantity: 1000,
      isNight: true,
    });
    expect(result.initialIsolationRadius).toBe(400);
    expect(result.protectiveActionDistance).toBe(4700); // 4.7km
    expect(result.isFallback).toBe(false);
  });

  // --- Phosgene (UN 1076) - highly toxic ---
  it('returns high values for Phosgene large spill night', () => {
    const result = calculateEvacuationRadius({
      unNumber: '1076',
      quantity: 500,
      isNight: true,
    });
    expect(result.initialIsolationRadius).toBe(500);
    expect(result.protectiveActionDistance).toBe(9500); // 9.5km
  });

  // --- Benzin (UN 1203) - no ERG entry, falls back to class ---
  it('falls back to class default for unknown UN with hazardClass', () => {
    const result = calculateEvacuationRadius({
      unNumber: '1203',
      hazardClass: '3',
      quantity: 100,
      isNight: false,
    });
    expect(result.isFallback).toBe(true);
    expect(result.source).toContain('Klasse 3');
  });

  // --- Unknown UN without class - falls back to 6.1 ---
  it('falls back to class 6.1 for completely unknown substance', () => {
    const result = calculateEvacuationRadius({
      unNumber: '9999',
      quantity: 100,
      isNight: false,
    });
    expect(result.isFallback).toBe(true);
    expect(result.source).toContain('6.1');
  });

  // --- Small vs large spill threshold ---
  it('uses small spill for quantity <= 208L', () => {
    const result = calculateEvacuationRadius({ unNumber: '1017', quantity: 208, isNight: false });
    expect(result.isLargeSpill).toBe(false);
  });

  it('uses large spill for quantity > 208L', () => {
    const result = calculateEvacuationRadius({ unNumber: '1017', quantity: 209, isNight: false });
    expect(result.isLargeSpill).toBe(true);
  });

  // --- Rounding to 25m ---
  it('rounds all results up to nearest 25m', () => {
    const result = calculateEvacuationRadius({
      unNumber: '1017',
      quantity: 100,
      isNight: false,
    });
    expect(result.initialIsolationRadius % 25).toBe(0);
    expect(result.protectiveActionDistance % 25).toBe(0);
  });

  // --- Minimum distance ---
  it('never returns 0m distance', () => {
    const result = calculateEvacuationRadius({
      unNumber: '9999',
      hazardClass: '6.2',
      quantity: 1,
      isNight: false,
    });
    expect(result.initialIsolationRadius).toBeGreaterThanOrEqual(25);
    expect(result.protectiveActionDistance).toBeGreaterThanOrEqual(25);
  });

  // --- Negative quantity (conservative: large spill) ---
  it('treats negative quantity as large spill (conservative)', () => {
    const result = calculateEvacuationRadius({
      unNumber: '1017',
      quantity: -100,
      isNight: false,
    });
    expect(result.isLargeSpill).toBe(true);
  });

  // --- Unknown quantity must never yield the smallest radius ---
  it('treats NaN quantity as large spill (conservative)', () => {
    const result = calculateEvacuationRadius({
      unNumber: '1017',
      quantity: NaN,
      isNight: false,
    });
    expect(result.isLargeSpill).toBe(true);
  });

  it('yields at least the large spill radius for an unparsable quantity', () => {
    const unknown = calculateEvacuationRadius({
      unNumber: '1017',
      quantity: parseFloat(''),
      isNight: false,
    });
    const small = calculateEvacuationRadius({
      unNumber: '1017',
      quantity: 10,
      isNight: false,
    });
    expect(unknown.initialIsolationRadius).toBeGreaterThan(small.initialIsolationRadius);
  });

  // --- Zero quantity ---
  it('uses small spill for quantity 0', () => {
    const result = calculateEvacuationRadius({
      unNumber: '1017',
      quantity: 0,
      isNight: false,
    });
    expect(result.isLargeSpill).toBe(false);
  });

  // --- Invalid UN number ---
  it('handles non-numeric UN number gracefully', () => {
    const result = calculateEvacuationRadius({
      unNumber: 'abc',
      quantity: 100,
      isNight: false,
    });
    expect(result.isFallback).toBe(true);
  });

  // --- Disclaimer always present ---
  it('always includes disclaimer', () => {
    const result = calculateEvacuationRadius({
      unNumber: '1017',
      quantity: 100,
      isNight: false,
    });
    expect(result.disclaimer).toContain('Einsatzleiter');
  });
});
