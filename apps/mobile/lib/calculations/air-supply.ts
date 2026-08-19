import { APPROXIMATION_DISCLAIMER } from '../disclaimers';

export type ExertionLevel = 'light' | 'medium' | 'heavy';

export interface IAirSupplyInput {
  pressure: number;
  volume: number;
  exertion: ExertionLevel;
}

export interface IAirSupplyResult {
  totalAirLiters: number;
  usableAirLiters: number;
  consumptionRate: number;
  operatingTimeMin: number;
  retreatPressure: number;
  isValid: boolean;
  source: string;
  disclaimer: string;
}

const CONSUMPTION_RATES: Record<ExertionLevel, number> = {
  light: 40,
  medium: 50,
  heavy: 60,
};

const USABLE_FRACTION = 2 / 3;
const RETREAT_FRACTION = 1 / 3;
const DISCLAIMER = APPROXIMATION_DISCLAIMER;

export const calculateAirSupply = (input: IAirSupplyInput): IAirSupplyResult => {
  if (!Number.isFinite(input.pressure) || input.pressure <= 0 ||
      !Number.isFinite(input.volume) || input.volume <= 0) {
    return {
      totalAirLiters: 0,
      usableAirLiters: 0,
      consumptionRate: 0,
      operatingTimeMin: 0,
      retreatPressure: 0,
      isValid: false,
      source: 'Berechnung nach FwDV 7 (Drittelalarm)',
      disclaimer: DISCLAIMER,
    };
  }

  const totalAirLiters = input.pressure * input.volume;
  const usableAirLiters = totalAirLiters * USABLE_FRACTION;
  const consumptionRate = CONSUMPTION_RATES[input.exertion];
  // Round DOWN conservatively - never overestimate safe operating time
  const operatingTimeMin = Math.floor((usableAirLiters / consumptionRate) * 10) / 10;
  const retreatPressure = Math.round(input.pressure * RETREAT_FRACTION);

  return {
    totalAirLiters,
    usableAirLiters: Math.round(usableAirLiters),
    consumptionRate,
    operatingTimeMin,
    retreatPressure,
    isValid: true,
    source: 'Berechnung nach FwDV 7 (Drittelalarm)',
    disclaimer: DISCLAIMER,
  };
};
