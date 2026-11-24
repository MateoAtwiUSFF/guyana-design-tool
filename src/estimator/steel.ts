// Steel part pricing, following the USFF ERP pricing method (packages/shared
// pricing.ts, in-house roll-formed path):
//
//   weight     = weightPerFt × lft
//   material   = weight × pricePerLb / yield
//   overhead   = weight × overheadPerLb
//   labor      = lft × rollFormLaborPerLft
//   cost       = material + overhead + labor
//   price      = cost / (1 - margin)
//
// The ERP's changeover fee and minimum-run flag are left out: the design tool
// prices whole houses, not production runs.
import Decimal from 'decimal.js';
import type { Money } from './money';
import type { ProfileSetting, Settings } from './settings';

export interface SteelUnitPrice {
  code: string;
  weightPerFtLb: number;
  costPerLft: Money;
  pricePerLft: Money;
}

export const findProfile = (settings: Settings, code: string): ProfileSetting | undefined =>
  settings.steel.profiles.find((p) => p.code.toUpperCase() === code.toUpperCase());

export const steelPricePerLft = (settings: Settings, code: string): SteelUnitPrice => {
  const profile = findProfile(settings, code);
  if (!profile) throw new Error(`Steel profile ${code} is not set up on the admin page`);
  const gauge = settings.steel.gauges[String(profile.mil)];
  if (!gauge) throw new Error(`No steel price for ${profile.mil} mil (${code}) on the admin page`);

  const w = new Decimal(profile.weightPerFtLb);
  const material = w.mul(gauge.pricePerLbUsd).div(gauge.yield || 1);
  const overhead = w.mul(settings.steel.overheadPerLbUsd);
  const labor = new Decimal(settings.steel.rollFormLaborPerLftUsd);
  const costPerLft = material.plus(overhead).plus(labor);
  const margin = settings.steel.marginPct;
  const pricePerLft = margin >= 1 ? costPerLft : costPerLft.div(1 - margin);
  return { code: profile.code, weightPerFtLb: profile.weightPerFtLb, costPerLft, pricePerLft };
};
