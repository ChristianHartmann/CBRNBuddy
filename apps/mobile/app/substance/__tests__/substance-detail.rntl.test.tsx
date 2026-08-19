import { render, screen, userEvent } from '@testing-library/react-native';

import { createTestDatabase, ericard, substance } from '../../../lib/database/__tests__/test-db';
import SubstanceDetailScreen from '../[unNumber]';

// UN 1105 PENTANOLE really does exist twice in ADR Table A: Kemler 33 in packing group
// II and Kemler 30 in packing group III. That is the case the Kemler resolution exists
// for, so the fixture mirrors it.
const VARIANTS = [
  substance({ un_number: '1105', name_de: 'PENTANOLE', kemler_number: '33', packing_group: 'II' }),
  substance({ un_number: '1105', name_de: 'PENTANOLE', kemler_number: '30', packing_group: 'III' }),
];

let mockParams: { unNumber: string; kemler?: string } = { unNumber: '1105' };
const mockDb = createTestDatabase({
  substances: VARIANTS,
  ericards: [ericard({ un_number: '1105', substance_name: 'PENTANOLE', ericard_id: '3-07' })],
});

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('../../../lib/database/connection', () => ({
  getDatabase: () => mockDb,
}));

describe('SubstanceDetailScreen', () => {
  beforeEach(() => {
    mockParams = { unNumber: '1105' };
  });

  it('shows the substance behind the UN number', async () => {
    await render(<SubstanceDetailScreen />);

    expect(screen.getByText('PENTANOLE')).toBeOnTheScreen();
    expect(screen.getByText('UN 1105')).toBeOnTheScreen();
  });

  it('offers every variant when no Kemler number was scanned', async () => {
    await render(<SubstanceDetailScreen />);

    expect(screen.getByRole('button', { name: 'Variante VG II | Kemler 33' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Variante VG III | Kemler 30' })).toBeOnTheScreen();
  });

  it('preselects the most hazardous variant', async () => {
    await render(<SubstanceDetailScreen />);

    expect(screen.getByRole('button', { name: 'Variante VG II | Kemler 33' })).toBeSelected();
  });

  it('shows the data of the variant the user picks', async () => {
    await render(<SubstanceDetailScreen />);
    expect(screen.getByText('VG II')).toBeOnTheScreen();

    await userEvent.press(screen.getByRole('button', { name: 'Variante VG III | Kemler 30' }));

    expect(screen.getByText('VG III')).toBeOnTheScreen();
    expect(screen.getByText('Kemler 30')).toBeOnTheScreen();
  });

  it('resolves to the scanned variant and offers no choice when the Kemler number is known', async () => {
    mockParams = { unNumber: '1105', kemler: '30' };

    await render(<SubstanceDetailScreen />);

    expect(screen.getByText('VG III')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /Variante/ })).toBeNull();
  });

  it('falls back to every variant when the scanned Kemler number matches none', async () => {
    mockParams = { unNumber: '1105', kemler: '99' };

    await render(<SubstanceDetailScreen />);

    expect(screen.getByRole('button', { name: 'Variante VG II | Kemler 33' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Variante VG III | Kemler 30' })).toBeOnTheScreen();
  });

  it('writes the ERICard section titles in proper German', async () => {
    await render(<SubstanceDetailScreen />);

    expect(screen.getByText('Einsatzmaßnahmen')).toBeOnTheScreen();
    expect(screen.getByText('Persönlicher Schutz')).toBeOnTheScreen();
    expect(screen.getByText('Löschmittel / Brandbekämpfung')).toBeOnTheScreen();
    expect(screen.getByText('Maßnahmen bei Freisetzung')).toBeOnTheScreen();
  });

  it('says so when the UN number is unknown', async () => {
    mockParams = { unNumber: '9999' };

    await render(<SubstanceDetailScreen />);

    expect(screen.getByText('Stoff nicht gefunden')).toBeOnTheScreen();
  });
});
