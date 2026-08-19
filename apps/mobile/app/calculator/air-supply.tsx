import { useState } from 'react';

import {
  calculateAirSupply,
  type ExertionLevel,
} from '../../lib/calculations/air-supply';
import { ChoiceRow, type IChoice } from '../../components/ui/choice-row';
import { Disclaimer } from '../../components/ui/disclaimer';
import { PrimaryButton } from '../../components/ui/primary-button';
import { ResultCard } from '../../components/ui/result-card';
import { ResultRow } from '../../components/ui/result-row';
import { Screen } from '../../components/ui/screen';
import { Section } from '../../components/ui/section';

const PRESSURE_OPTIONS: IChoice<number>[] = [
  { value: 300, label: '300 bar' },
  { value: 200, label: '200 bar' },
];

const VOLUME_OPTIONS: IChoice<number>[] = [
  { value: 6.8, label: '6,8 L' },
  { value: 6.0, label: '6,0 L' },
];

const EXERTION_OPTIONS: IChoice<ExertionLevel>[] = [
  { value: 'light', label: 'Leicht', description: '40 L/min' },
  { value: 'medium', label: 'Mittel', description: '50 L/min' },
  { value: 'heavy', label: 'Schwer', description: '60 L/min' },
];

export default function AirSupplyCalculatorScreen() {
  const [pressure, setPressure] = useState(300);
  const [volume, setVolume] = useState(6.8);
  const [exertion, setExertion] = useState<ExertionLevel>('medium');
  const [result, setResult] = useState<ReturnType<typeof calculateAirSupply> | null>(null);

  const handleCalculate = () => {
    setResult(calculateAirSupply({ pressure, volume, exertion }));
  };

  return (
    <Screen>
      <Section title="Flaschendruck">
        <ChoiceRow
          label="Flaschendruck"
          options={PRESSURE_OPTIONS}
          selected={pressure}
          onSelect={setPressure}
        />
      </Section>

      <Section title="Flaschenvolumen">
        <ChoiceRow
          label="Flaschenvolumen"
          options={VOLUME_OPTIONS}
          selected={volume}
          onSelect={setVolume}
        />
      </Section>

      <Section title="Belastungsstufe">
        <ChoiceRow
          label="Belastungsstufe"
          options={EXERTION_OPTIONS}
          selected={exertion}
          onSelect={setExertion}
        />
      </Section>

      <PrimaryButton label="Einsatzzeit berechnen" onPress={handleCalculate} />

      {result?.isValid && (
        <>
          <ResultCard title="Ergebnis" source={result.source}>
            <ResultRow label="Einsatzzeit" value={result.operatingTimeMin} unit="min" />
            <ResultRow label="Rückzugsdruck" value={result.retreatPressure} unit="bar" />
            <ResultRow label="Luftvorrat gesamt" value={result.totalAirLiters} unit="L" secondary />
            <ResultRow label="Nutzbar (2/3)" value={result.usableAirLiters} unit="L" secondary />
            <ResultRow label="Verbrauch" value={result.consumptionRate} unit="L/min" secondary />
          </ResultCard>

          <Disclaimer text={result.disclaimer} />
        </>
      )}
    </Screen>
  );
}
