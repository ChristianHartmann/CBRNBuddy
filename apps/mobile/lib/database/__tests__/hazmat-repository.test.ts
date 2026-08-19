import { selectMostHazardousVariant, selectVariantsByKemler } from '../hazmat-repository';
import type { ISubstanceDetail } from '../hazmat-repository';

const variant = (packingGroup: string | null, kemler: string | null): ISubstanceDetail =>
  ({
    id: 1,
    un_number: '1105',
    name_de: 'PENTANOLE',
    name_en: null,
    hazard_class: '3',
    hazard_class_name: null,
    kemler_number: kemler,
    packing_group: packingGroup,
    cas_number: null,
    tunnel_code: null,
    special_provisions: null,
    labels: null,
  }) as ISubstanceDetail;

describe('selectMostHazardousVariant', () => {
  it('returns null when there is no variant', () => {
    expect(selectMostHazardousVariant([])).toBeNull();
  });

  it('returns the only variant unchanged', () => {
    const only = variant('III', '30');

    expect(selectMostHazardousVariant([only])).toBe(only);
  });

  it('prefers packing group I over II and III', () => {
    const rows = [variant('III', '30'), variant('I', '33'), variant('II', '33')];

    expect(selectMostHazardousVariant(rows)?.packing_group).toBe('I');
  });

  it('prefers packing group II over III regardless of input order', () => {
    const rows = [variant('III', '30'), variant('II', '33')];

    expect(selectMostHazardousVariant(rows)?.packing_group).toBe('II');
  });

  it('ranks a variant without packing group below one with a packing group', () => {
    const rows = [variant(null, '30'), variant('III', '30')];

    expect(selectMostHazardousVariant(rows)?.packing_group).toBe('III');
  });

  it('is stable when no variant carries a packing group', () => {
    const first = variant(null, '30');
    const rows = [first, variant(null, '33')];

    expect(selectMostHazardousVariant(rows)).toBe(first);
  });
});

describe('selectVariantsByKemler', () => {
  // UN 1105 PENTANOLE: Kemler 33 is packing group II, Kemler 30 is packing group III.
  const pgII = variant('II', '33');
  const pgIII = variant('III', '30');
  const rows = [pgIII, pgII];

  it('returns every variant when no Kemler number is known', () => {
    expect(selectVariantsByKemler(rows, null)).toEqual(rows);
  });

  it('returns every variant for a blank Kemler number', () => {
    expect(selectVariantsByKemler(rows, '  ')).toEqual(rows);
  });

  it('narrows to the variant carrying the scanned Kemler number', () => {
    expect(selectVariantsByKemler(rows, '33')).toEqual([pgII]);
  });

  it('matches a Kemler number with an X prefix regardless of case', () => {
    const corrosive = variant('I', 'X423');

    expect(selectVariantsByKemler([corrosive, pgII], 'x423')).toEqual([corrosive]);
  });

  it('keeps every matching variant when the Kemler number is not unique', () => {
    const alsoPgII = variant('II', '33');

    expect(selectVariantsByKemler([pgIII, pgII, alsoPgII], '33')).toEqual([pgII, alsoPgII]);
  });

  it('falls back to every variant when the Kemler number matches none, since the reading may be wrong', () => {
    expect(selectVariantsByKemler(rows, '99')).toEqual(rows);
  });
});
