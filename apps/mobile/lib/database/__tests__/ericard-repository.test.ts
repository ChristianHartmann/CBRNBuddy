import { dedupeERICards, getERICardsByUnNumber, type IERICard } from '../ericard-repository';
import { createTestDatabase } from './test-db';

const card = (overrides: Partial<IERICard> = {}): IERICard => ({
  id: 1,
  un_number: '1105',
  substance_name: 'PENTANOLE',
  ericard_id: '3-11',
  immediate_actions: '["Zuendquellen beseitigen"]',
  firefighting: '[]',
  personal_protection: '[]',
  first_aid: '[]',
  spillage: '[]',
  hazards: '[]',
  physical_properties: '[]',
  evacuation_distance_m: 50,
  water_hazard_class: 'WGK 2',
  ...overrides,
});

describe('dedupeERICards', () => {
  it('returns a single card unchanged', () => {
    const only = card();

    expect(dedupeERICards([only])).toEqual([only]);
  });

  it('drops a card that only differs in its row id', () => {
    // Six UN numbers carry byte-identical duplicates from the scrape.
    const cards = [card({ id: 1 }), card({ id: 2 })];

    expect(dedupeERICards(cards)).toHaveLength(1);
  });

  it('keeps cards with different ERICard ids', () => {
    const cards = [card({ id: 1, ericard_id: '3-11' }), card({ id: 2, ericard_id: '3-05' })];

    expect(dedupeERICards(cards)).toHaveLength(2);
  });

  it('keeps cards whose measures differ', () => {
    const cards = [
      card({ id: 1, immediate_actions: '["A"]' }),
      card({ id: 2, immediate_actions: '["B"]' }),
    ];

    expect(dedupeERICards(cards)).toHaveLength(2);
  });
});

describe('getERICardsByUnNumber', () => {
  const CARDS = [
    card({ un_number: '1105', ericard_id: '3-11' }),
    card({ un_number: '1105', ericard_id: '3-05' }),
    card({ un_number: '1203', ericard_id: '3-07' }),
  ];

  it('returns every card of the UN number', () => {
    const db = createTestDatabase({ ericards: CARDS });

    expect(getERICardsByUnNumber(db, '1105')).toHaveLength(2);
  });

  it('orders cards by their ERICard id, so the list does not depend on insertion order', () => {
    const db = createTestDatabase({ ericards: CARDS });

    expect(getERICardsByUnNumber(db, '1105').map((c) => c.ericard_id)).toEqual(['3-05', '3-11']);
  });

  it('accepts an unpadded UN number', () => {
    const db = createTestDatabase({ ericards: [card({ un_number: '0033' })] });

    expect(getERICardsByUnNumber(db, '33')).toHaveLength(1);
  });

  it('returns nothing for an unknown UN number', () => {
    const db = createTestDatabase({ ericards: CARDS });

    expect(getERICardsByUnNumber(db, '9999')).toEqual([]);
  });
});
