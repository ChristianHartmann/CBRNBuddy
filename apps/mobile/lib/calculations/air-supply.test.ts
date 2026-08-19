import { calculateAirSupply, type ExertionLevel } from './air-supply';

describe('calculateAirSupply', () => {
  // 300bar × 6L = 1800L total, 1200L usable
  // 300bar × 6.8L = 2040L total, 1360L usable
  // 200bar × 6L = 1200L total, 800L usable
  // 200bar × 6.8L = 1360L total, ~906.7L usable

  const cases: {
    pressure: number;
    volume: number;
    exertion: ExertionLevel;
    expectedTime: number;
    expectedRetreat: number;
  }[] = [
    // 300bar × 6L
    { pressure: 300, volume: 6, exertion: 'light', expectedTime: 30, expectedRetreat: 100 },
    { pressure: 300, volume: 6, exertion: 'medium', expectedTime: 24, expectedRetreat: 100 },
    { pressure: 300, volume: 6, exertion: 'heavy', expectedTime: 20, expectedRetreat: 100 },
    // 300bar × 6.8L
    { pressure: 300, volume: 6.8, exertion: 'light', expectedTime: 34, expectedRetreat: 100 },
    { pressure: 300, volume: 6.8, exertion: 'medium', expectedTime: 27.2, expectedRetreat: 100 },
    { pressure: 300, volume: 6.8, exertion: 'heavy', expectedTime: 22.6, expectedRetreat: 100 },
    // 200bar × 6L
    { pressure: 200, volume: 6, exertion: 'light', expectedTime: 20, expectedRetreat: 67 },
    { pressure: 200, volume: 6, exertion: 'medium', expectedTime: 16, expectedRetreat: 67 },
    { pressure: 200, volume: 6, exertion: 'heavy', expectedTime: 13.3, expectedRetreat: 67 },
    // 200bar × 6.8L
    { pressure: 200, volume: 6.8, exertion: 'light', expectedTime: 22.6, expectedRetreat: 67 },
    { pressure: 200, volume: 6.8, exertion: 'medium', expectedTime: 18.1, expectedRetreat: 67 },
    { pressure: 200, volume: 6.8, exertion: 'heavy', expectedTime: 15.1, expectedRetreat: 67 },
  ];

  it.each(cases)(
    '$pressure bar × $volume L @ $exertion → $expectedTime min, retreat $expectedRetreat bar',
    ({ pressure, volume, exertion, expectedTime, expectedRetreat }) => {
      const result = calculateAirSupply({ pressure, volume, exertion });
      expect(result.operatingTimeMin).toBe(expectedTime);
      expect(result.retreatPressure).toBe(expectedRetreat);
      expect(result.isValid).toBe(true);
    }
  );

  it('returns correct total and usable air liters', () => {
    const result = calculateAirSupply({ pressure: 300, volume: 6.8, exertion: 'medium' });
    expect(result.totalAirLiters).toBe(2040);
    expect(result.usableAirLiters).toBe(1360);
    expect(result.consumptionRate).toBe(50);
  });

  it('never overestimates operating time (floors, not rounds)', () => {
    // 200bar × 6.8L @ heavy: 1360 * 2/3 / 60 = 15.111... → floor to 15.1
    const result = calculateAirSupply({ pressure: 200, volume: 6.8, exertion: 'heavy' });
    expect(result.operatingTimeMin).toBeLessThanOrEqual(15.2);
  });

  it('returns isValid false for negative pressure', () => {
    const result = calculateAirSupply({ pressure: -300, volume: 6, exertion: 'light' });
    expect(result.isValid).toBe(false);
    expect(result.operatingTimeMin).toBe(0);
  });

  it('returns isValid false for zero volume', () => {
    const result = calculateAirSupply({ pressure: 300, volume: 0, exertion: 'light' });
    expect(result.isValid).toBe(false);
  });

  it('returns isValid false for NaN input', () => {
    const result = calculateAirSupply({ pressure: NaN, volume: 6, exertion: 'light' });
    expect(result.isValid).toBe(false);
  });

  it('always includes disclaimer with Einsatzleiter reference', () => {
    const result = calculateAirSupply({ pressure: 300, volume: 6, exertion: 'light' });
    expect(result.disclaimer).toContain('Einsatzleiter');
    expect(result.source).toContain('FwDV 7');
  });
});
