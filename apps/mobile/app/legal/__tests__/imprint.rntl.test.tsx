import { render, screen } from '@testing-library/react-native';

import ImprintScreen from '../imprint';

// The published repository carries no contact details, so the default is empty and the
// screen has to cope with that rather than render a half filled section.
//
// Read through getters: jest.mock is hoisted above the declaration below, so returning
// the object directly would hand over undefined. The getters run at render time instead.
jest.mock('../../../constants/contact', () => ({
  get MAINTAINER() {
    return mockContact.MAINTAINER;
  },
  get CONTACT_EMAIL() {
    return mockContact.CONTACT_EMAIL;
  },
}));

const mockContact = { MAINTAINER: '', CONTACT_EMAIL: '' };

describe('ImprintScreen', () => {
  beforeEach(() => {
    mockContact.MAINTAINER = '';
    mockContact.CONTACT_EMAIL = '';
  });

  it('leaves out the responsible party when none is configured', async () => {
    await render(<ImprintScreen />);

    expect(screen.queryByText('Verantwortlich')).toBeNull();
  });

  it('shows the responsible party once configured', async () => {
    mockContact.MAINTAINER = 'Musterwehr IT';
    mockContact.CONTACT_EMAIL = 'kontakt@example.org';

    await render(<ImprintScreen />);

    expect(screen.getByText('Verantwortlich')).toBeOnTheScreen();
    expect(screen.getByText(/Musterwehr IT/)).toBeOnTheScreen();
    expect(screen.getByText(/kontakt@example.org/)).toBeOnTheScreen();
  });

  it('keeps the parts that matter regardless of contact details', async () => {
    await render(<ImprintScreen />);

    expect(screen.getByText('Haftungsausschluss')).toBeOnTheScreen();
    expect(screen.getByText('Datenquellen')).toBeOnTheScreen();
    expect(screen.getByText('Datenschutz')).toBeOnTheScreen();
  });

  it('names the map tiles as the one network access', async () => {
    await render(<ImprintScreen />);

    expect(screen.getByText(/OpenStreetMap/)).toBeOnTheScreen();
  });
});
