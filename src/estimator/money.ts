// Money is always a Decimal, never a JS number (same rule as the USFF ERP).
// Prices are stored and computed in USD; the client sees GYD.
import Decimal from 'decimal.js';

export { Decimal };
export type Money = Decimal;

export const ZERO = new Decimal(0);

export const usd = (n: number | string | Decimal): Money => new Decimal(n);

export const sum = (values: ReadonlyArray<Money>): Money =>
  values.reduce<Money>((acc, v) => acc.plus(v), ZERO);

export const toGyd = (amountUsd: Money, gydPerUsd: number): Money =>
  amountUsd.mul(gydPerUsd);

const fmt = (n: Decimal, digits: number) =>
  n
    .toDecimalPlaces(digits, Decimal.ROUND_HALF_UP)
    .toNumber()
    .toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** "G$1,234,000" — GYD is shown without cents. */
export const formatGyd = (amountUsd: Money, gydPerUsd: number): string =>
  `G$${fmt(toGyd(amountUsd, gydPerUsd), 0)}`;

/** "US$1,234.56" */
export const formatUsd = (amountUsd: Money): string => `US$${fmt(amountUsd, 2)}`;
