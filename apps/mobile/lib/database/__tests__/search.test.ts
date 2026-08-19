import { searchSubstances } from '../search';
import { createTestDatabase, substance } from './test-db';

const FIXTURE = [
  substance({ un_number: '0033', name_de: 'TESTSTOFF NULLDREIDREI', kemler_number: '10' }),
  substance({ un_number: '1105', name_de: 'PENTANOLE', kemler_number: '33', packing_group: 'II' }),
  substance({ un_number: '3312', name_de: 'GAS, VERFLUESSIGT', kemler_number: '223' }),
  substance({ un_number: '1203', name_de: 'BENZIN', kemler_number: '33' }),
  substance({ un_number: '1744', name_de: 'BROM', kemler_number: 'X886' }),
];

const unNumbers = (rows: { un_number: string }[]): string[] => rows.map((r) => r.un_number);

describe('searchSubstances', () => {
  const db = createTestDatabase({ substances: FIXTURE });

  it('returns nothing for a blank query', () => {
    expect(searchSubstances(db, '   ')).toEqual([]);
  });

  it('finds a substance by its full UN number', () => {
    expect(unNumbers(searchSubstances(db, '1203'))).toContain('1203');
  });

  it('finds a substance by name', () => {
    expect(unNumbers(searchSubstances(db, 'Pentanole'))).toContain('1105');
  });

  it('finds substances by their Kemler number', () => {
    const found = unNumbers(searchSubstances(db, '33'));

    expect(found).toContain('1105');
    expect(found).toContain('1203');
  });

  it('still finds the UN number when the same digits are also a Kemler number', () => {
    expect(unNumbers(searchSubstances(db, '33'))).toContain('0033');
  });

  it('finds a substance by an X-prefixed Kemler number', () => {
    expect(unNumbers(searchSubstances(db, 'X886'))).toContain('1744');
  });

  it('does not return the same substance twice', () => {
    const found = unNumbers(searchSubstances(db, '33'));

    expect(found).toHaveLength(new Set(found).size);
  });
});
