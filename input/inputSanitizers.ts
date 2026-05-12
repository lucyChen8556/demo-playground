import type { BaseKeyDownOptions, NumericKeyDownOptions } from './numericCore';
import { filterNumericChars } from './numericCore';

export type NumericSanitizeOptions = BaseKeyDownOptions & {
  min?: number;
};

export type NumericBlurTrimOptions = {
  leadingZeros?: boolean;
  leadingDecimalPoint?: boolean;
  trailingFractionZeros?: boolean;
};

function isSingleDeletion(previousValue: string, nextValue: string): boolean {
  if (nextValue.length !== previousValue.length - 1) {
    return false;
  }

  return Array.from(
    { length: previousValue.length },
    (_, index) => `${previousValue.slice(0, index)}${previousValue.slice(index + 1)}`,
  ).includes(nextValue);
}

function shouldPreserveLeadingZeroProgress(previousValue: string | number, nextValue: string): boolean {
  const previous = String(previousValue ?? '');

  if (!/^0[\d.]+$/.test(nextValue)) {
    return false;
  }

  if (/^[1-9]\d*(?:\.\d+)?$/.test(previous) && nextValue === `0${previous}`) {
    return true;
  }

  if (/^0[\d.]+$/.test(previous)) {
    return true;
  }

  if (/^0\.\d+$/.test(previous) && nextValue === previous.replace('.', '')) {
    return true;
  }

  return false;
}

function normalizeNumericMantissaLeadingZeros(input: string): string {
  const match = input.match(/^([+-]?)(\d+)(\.\d*)?([eE].*)?$/);
  if (!match) {
    return input;
  }

  const [, sign, integerPart, fractionPart = '', exponentPart = ''] = match;
  const normalizedIntegerPart = integerPart.replace(/^0+(?=\d)/, '');

  return `${sign}${normalizedIntegerPart || '0'}${fractionPart}${exponentPart}`;
}

function normalizeLeadingDecimalPoint(input: string): string {
  const match = input.match(/^([+-]?)\.(\d*)([eE].*)?$/);
  if (!match) {
    return input;
  }

  const [, sign = '', fractionPart = '', exponentPart = ''] = match;
  return `${sign}0.${fractionPart}${exponentPart}`;
}
function trimTrailingFractionZeros(input: string): string {
  return input.replace(/(\.\d*?[1-9])0+([eE].*)?$/, '$1$2').replace(/\.0*([eE].*)?$/, '$1');
}

export function trimNumericInputOnBlur(input: string, options: NumericBlurTrimOptions = {}): string {
  const { leadingZeros = false, leadingDecimalPoint = false, trailingFractionZeros = false } = options;

  let normalizedInput = String(input ?? '');

  if (normalizedInput.trim() === '') {
    return '';
  }

  if (leadingDecimalPoint) {
    normalizedInput = normalizeLeadingDecimalPoint(normalizedInput);
  }

  if (leadingZeros) {
    normalizedInput = normalizeNumericMantissaLeadingZeros(normalizedInput);
  }

  if (trailingFractionZeros) {
    normalizedInput = trimTrailingFractionZeros(normalizedInput);
  }

  return normalizedInput;
}

export function trimLeadingZerosOnBlur(input: string): string {
  return trimNumericInputOnBlur(input, {
    leadingDecimalPoint: true,
    leadingZeros: true,
  });
}

function normalizeExpandedNumber(input: string): string {
  const match = input.match(/^([+-]?)(\d+)(?:\.(\d+))?$/);
  if (!match) {
    return input;
  }

  const [, rawSign, integerPart, fractionPart = ''] = match;
  const sign = rawSign === '-' ? '-' : '';
  const normalizedIntegerPart = integerPart.replace(/^0+(?=\d)/, '');
  const normalizedFractionPart = fractionPart.replace(/0+$/, '');

  if (normalizedFractionPart === '') {
    return `${sign}${normalizedIntegerPart || '0'}`;
  }

  return `${sign}${normalizedIntegerPart || '0'}.${normalizedFractionPart}`;
}

function expandScientificNotation(input: string): string {
  const match = input.match(/^([+-]?)(\d+)(?:\.(\d*))?[eE]([+-]?)(\d+)$/);
  if (!match) {
    return input;
  }

  const [, rawSign, integerPart, fractionPart = '', exponentSign = '', exponentDigits] = match;

  const sign = rawSign === '-' ? '-' : '';
  const exponent = Number(`${exponentSign}${exponentDigits}`);
  const digits = `${integerPart}${fractionPart}`;
  const decimalIndex = integerPart.length;
  const shiftedDecimalIndex = decimalIndex + exponent;

  if (/^0+$/.test(digits)) {
    return '0';
  }

  if (shiftedDecimalIndex <= 0) {
    return normalizeExpandedNumber(`${sign}0.${'0'.repeat(Math.abs(shiftedDecimalIndex))}${digits}`);
  }

  if (shiftedDecimalIndex >= digits.length) {
    return normalizeExpandedNumber(`${sign}${digits}${'0'.repeat(shiftedDecimalIndex - digits.length)}`);
  }

  return normalizeExpandedNumber(`${sign}${digits.slice(0, shiftedDecimalIndex)}.${digits.slice(shiftedDecimalIndex)}`);
}

function getMantissaParts(input: string): {
  sign: string;
  integerPart: string;
  fractionPart: string;
  exponentPart: string;
} | null {
  const match = input.match(/^([+-]?)(\d*)(?:\.(\d*))?([eE].*)?$/);
  if (!match) {
    return null;
  }

  const [, sign = '', integerPart = '', fractionPart = '', exponentPart = ''] = match;
  return {
    sign,
    integerPart,
    fractionPart,
    exponentPart,
  };
}

function trimToMaxDecimalPlaces(input: string, maxDecimalPlaces?: number): string {
  if (maxDecimalPlaces === undefined) return input;
  const parts = getMantissaParts(input);
  if (!parts) return input;

  const {
    sign, integerPart, fractionPart, exponentPart,
  } = parts;

  if (fractionPart.length <= maxDecimalPlaces) {
    if (maxDecimalPlaces === 0 && input.includes('.')) {
      return `${sign}${integerPart}${exponentPart}`;
    }
    return input;
  }

  const trimmedFractionPart = fractionPart.slice(0, maxDecimalPlaces);
  const decimalPart = maxDecimalPlaces > 0 ? `.${trimmedFractionPart}` : '';

  return `${sign}${integerPart}${decimalPart}${exponentPart}`;
}

export function sanitizeNumericInputHandler(
  input: string,
  options: NumericSanitizeOptions,
  previousValue?: string | number,
): string {
  const {
    allowDecimal, allowExponent, allowSign, min,
  } = options;

  if (Number.isNaN(input) || (min !== undefined && (input as unknown as number) < min)) {
    return min?.toString() ?? '0';
  }

  let s = String(input ?? '');
  if (s.trim() === '') {
    return '';
  }

  const previous = String(previousValue ?? '');

  if (
    previous
    && !allowDecimal
    && !allowExponent
    && !allowSign
    && /[^\d]/.test(previous)
    && isSingleDeletion(previous, s)
  ) {
    return s;
  }

  if (allowSign) {
    s = s.replace(/\+{2,}/g, '+');
    s = s.replace(/-{2,}/g, '-');
  } else {
    s = s.replace(/[+-]/g, '');
  }

  if (allowExponent) {
    s = s.replace(/^([+-]?)[eE]+(?=\d)/, '$1');
    s = s.replace(/^([+-]?)[eE]+$/, '$1');
  } else {
    s = s.replace(/[eE]/g, '');
  }

  if (!allowDecimal) {
    s = s.replace(/\./g, '');
  }

  if (previous && shouldPreserveLeadingZeroProgress(previous, s)) {
    return s;
  }

  s = filterNumericChars(s, {
    allowDecimal,
    allowExponent,
    allowSign,
    maxDecimalPlaces: options.maxDecimalPlaces,
    replaceLeadingZero: false,
  } satisfies NumericKeyDownOptions);

  if (s === '') {
    return '';
  }

  s = normalizeLeadingDecimalPoint(s);
  s = normalizeNumericMantissaLeadingZeros(s);
  s = expandScientificNotation(s);
  s = trimToMaxDecimalPlaces(s, options.maxDecimalPlaces);

  return s;
}
