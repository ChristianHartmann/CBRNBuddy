import { Text } from 'react-native';
import { render, screen, userEvent } from '@testing-library/react-native';

import { ChoiceRow } from '../choice-row';
import { Disclaimer } from '../disclaimer';
import { LabeledInput } from '../labeled-input';
import { PrimaryButton } from '../primary-button';
import { ResultCard } from '../result-card';
import { ResultRow } from '../result-row';
import { Screen } from '../screen';
import { Section } from '../section';

describe('Screen', () => {
  it('shows what it wraps', async () => {
    await render(
      <Screen>
        <Text>Inhalt</Text>
      </Screen>
    );

    expect(screen.getByText('Inhalt')).toBeOnTheScreen();
  });
});

describe('Section', () => {
  it('shows its title', async () => {
    await render(<Section title="Flaschendruck" />);

    expect(screen.getByText('Flaschendruck')).toBeOnTheScreen();
  });

  it('works without a title', async () => {
    await render(
      <Section>
        <Text>ohne Titel</Text>
      </Section>
    );

    expect(screen.getByText('ohne Titel')).toBeOnTheScreen();
  });
});

describe('PrimaryButton', () => {
  it('reports a press', async () => {
    const onPress = jest.fn();
    await render(<PrimaryButton label="Berechnen" onPress={onPress} />);

    await userEvent.press(screen.getByRole('button', { name: 'Berechnen' }));

    expect(onPress).toHaveBeenCalled();
  });

  it('ignores presses while disabled', async () => {
    const onPress = jest.fn();
    await render(<PrimaryButton label="Berechnen" onPress={onPress} disabled />);

    await userEvent.press(screen.getByRole('button', { name: 'Berechnen' }));

    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('LabeledInput', () => {
  it('links label and field, so the field is reachable by its label', async () => {
    await render(
      <LabeledInput label="Freigesetzte Menge (Liter)" value="" onChangeText={jest.fn()} />
    );

    expect(screen.getByLabelText('Freigesetzte Menge (Liter)')).toBeOnTheScreen();
  });

  it('reports what was typed', async () => {
    const onChangeText = jest.fn();
    await render(<LabeledInput label="Menge" value="" onChangeText={onChangeText} />);

    await userEvent.type(screen.getByLabelText('Menge'), '500');

    expect(onChangeText).toHaveBeenCalled();
  });

  it('shows a hint below the field', async () => {
    await render(
      <LabeledInput label="Menge" value="" onChangeText={jest.fn()} hint="Klein: bis 208 L" />
    );

    expect(screen.getByText('Klein: bis 208 L')).toBeOnTheScreen();
  });
});

describe('ChoiceRow', () => {
  const OPTIONS = [
    { value: 200, label: '200 bar' },
    { value: 300, label: '300 bar' },
  ];

  it('offers every choice as a radio', async () => {
    await render(
      <ChoiceRow label="Flaschendruck" options={OPTIONS} selected={300} onSelect={jest.fn()} />
    );

    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });

  it('marks the current choice', async () => {
    await render(
      <ChoiceRow label="Flaschendruck" options={OPTIONS} selected={300} onSelect={jest.fn()} />
    );

    expect(screen.getByRole('radio', { name: '300 bar' })).toBeSelected();
    expect(screen.getByRole('radio', { name: '200 bar' })).not.toBeSelected();
  });

  it('reports the chosen value, not its index', async () => {
    const onSelect = jest.fn();
    await render(
      <ChoiceRow label="Flaschendruck" options={OPTIONS} selected={300} onSelect={onSelect} />
    );

    await userEvent.press(screen.getByRole('radio', { name: '200 bar' }));

    expect(onSelect).toHaveBeenCalledWith(200);
  });

  it('shows an icon without letting it into the accessibility label', async () => {
    await render(
      <ChoiceRow
        label="Behälterform"
        options={[{ value: 'cylinder', label: 'Zylinder', icon: '\u{1F6E2}' }]}
        selected="cylinder"
        onSelect={jest.fn()}
      />
    );

    expect(screen.getByText('\u{1F6E2}')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Zylinder' })).toBeOnTheScreen();
  });

  it('shows a description under an option', async () => {
    await render(
      <ChoiceRow
        label="Belastung"
        options={[{ value: 'heavy', label: 'Schwer', description: '60 L/min' }]}
        selected="heavy"
        onSelect={jest.fn()}
      />
    );

    expect(screen.getByText('60 L/min')).toBeOnTheScreen();
  });
});

describe('ResultCard and ResultRow', () => {
  it('shows title, values and source together', async () => {
    await render(
      <ResultCard title="Ergebnis" source="FwDV 7">
        <ResultRow label="Einsatzzeit" value={22.6} unit="min" />
      </ResultCard>
    );

    expect(screen.getByText('Ergebnis')).toBeOnTheScreen();
    expect(screen.getByText('Einsatzzeit')).toBeOnTheScreen();
    expect(screen.getByText('22.6')).toBeOnTheScreen();
    expect(screen.getByText('min')).toBeOnTheScreen();
    expect(screen.getByText('Quelle: FwDV 7')).toBeOnTheScreen();
  });

  it('leaves out the source line when there is none', async () => {
    await render(
      <ResultCard title="Ergebnis">
        <ResultRow label="Einsatzzeit" value={22.6} />
      </ResultCard>
    );

    expect(screen.queryByText(/Quelle:/)).toBeNull();
  });

  it('reads a row as one label and value pair for assistive technology', async () => {
    await render(<ResultRow label="Rückzugsdruck" value={100} unit="bar" />);

    expect(screen.getByLabelText('Rückzugsdruck: 100 bar')).toBeOnTheScreen();
  });
});

describe('Disclaimer', () => {
  it('shows the text it is given', async () => {
    await render(<Disclaimer text="Die Entscheidung liegt beim Einsatzleiter." />);

    expect(screen.getByText('Die Entscheidung liegt beim Einsatzleiter.')).toBeOnTheScreen();
  });
});
