import { render, screen, userEvent } from '@testing-library/react-native';

import { OptionChips } from '../option-chips';

const OPTIONS = ['VG I | Kemler 33', 'VG II | Kemler 33', 'VG III | Kemler 30'];

describe('OptionChips', () => {
  it('renders one button per option', async () => {
    await render(<OptionChips options={OPTIONS} selectedIndex={0} onSelect={jest.fn()} />);

    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('renders nothing when there is only one option, since there is nothing to choose', async () => {
    await render(<OptionChips options={['VG II | Kemler 33']} selectedIndex={0} onSelect={jest.fn()} />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders nothing without options', async () => {
    await render(<OptionChips options={[]} selectedIndex={0} onSelect={jest.fn()} />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('marks the selected option for assistive technology', async () => {
    await render(<OptionChips options={OPTIONS} selectedIndex={1} onSelect={jest.fn()} />);

    expect(screen.getByRole('button', { name: OPTIONS[1] })).toBeSelected();
    expect(screen.getByRole('button', { name: OPTIONS[0] })).not.toBeSelected();
  });

  it('reports the index of the pressed option', async () => {
    const onSelect = jest.fn();
    await render(<OptionChips options={OPTIONS} selectedIndex={0} onSelect={onSelect} />);

    await userEvent.press(screen.getByRole('button', { name: OPTIONS[2] }));

    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it('prefixes the accessibility label when asked to', async () => {
    await render(
      <OptionChips
        options={OPTIONS}
        selectedIndex={0}
        onSelect={jest.fn()}
        accessibilityLabelPrefix="Variante"
      />
    );

    expect(screen.getByRole('button', { name: `Variante ${OPTIONS[0]}` })).toBeOnTheScreen();
  });

  it('shows the hint above the options', async () => {
    await render(
      <OptionChips
        options={OPTIONS}
        selectedIndex={0}
        onSelect={jest.fn()}
        hint="3 Eintraege zu UN 1133."
      />
    );

    expect(screen.getByText('3 Eintraege zu UN 1133.')).toBeOnTheScreen();
  });

  it('leaves out the hint when there is nothing to choose', async () => {
    await render(
      <OptionChips
        options={['nur eine']}
        selectedIndex={0}
        onSelect={jest.fn()}
        hint="sollte nicht erscheinen"
      />
    );

    expect(screen.queryByText('sollte nicht erscheinen')).toBeNull();
  });
});
