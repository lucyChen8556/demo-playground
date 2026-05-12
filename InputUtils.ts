import type { ClipboardEvent, KeyboardEvent } from 'react';

import { sanitizeNumericInputHandler, trimLeadingZerosOnBlur, trimNumericInputOnBlur } from './input/inputSanitizers';
import type { NumericBlurTrimOptions, NumericSanitizeOptions } from './input/inputSanitizers';
import {
  SKIP_KEYS,
  createNumericKeyDown,
  createNumericPaste,
  isValidNumericLiteralInputProgress,
} from './input/numericCore';
import type { NumericKeyDownOptions, PositiveIntegerKeyResolution } from './input/numericCore';

type NumericRuleOptions = NumericKeyDownOptions & {
  min?: number;
};

export type { PositiveIntegerKeyResolution };

export type NumericInputOptions = {
  min?: number;
  decimal?: number;
  previousValue?: string | number;
  exponent?: boolean;
  sign?: boolean;
  replaceLeadingZero?: boolean;
};

function toNumericKeyDownOptions(options?: NumericInputOptions): NumericKeyDownOptions {
  return {
    allowDecimal: true,
    allowExponent: options?.exponent ?? false,
    allowSign: options?.sign ?? false,
    replaceLeadingZero: options?.replaceLeadingZero ?? false,
    maxDecimalPlaces: options?.decimal,
  };
}

function toNumericRuleOptions(options?: NumericInputOptions): NumericRuleOptions {
  return {
    allowDecimal: true,
    allowExponent: options?.exponent ?? false,
    allowSign: options?.sign ?? false,
    replaceLeadingZero: options?.replaceLeadingZero ?? false,
    min: options?.min,
    maxDecimalPlaces: options?.decimal,
  };
}

export { isValidNumericLiteralInputProgress };

export function resolvePositiveIntegerKey(value: string, key: string): PositiveIntegerKeyResolution {
  if (!/^[0-9]$/.test(key)) {
    return { kind: 'block' };
  }
  if (key === '0' && value.startsWith('0')) {
    return { kind: 'block' };
  }

  if (value.startsWith('0')) {
    return { kind: 'replace', nextValue: value.replace(/^0/, key) };
  }
  return { kind: 'noop' };
}

export function applyPositiveIntegerKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
  createNumericKeyDown({
    allowDecimal: false,
    allowExponent: false,
    allowSign: false,
    replaceLeadingZero: true,
  })(e);
}

export function applyPositiveIntegerPaste(e: ClipboardEvent<HTMLInputElement>): void {
  createNumericPaste({
    allowDecimal: false,
    allowExponent: false,
    allowSign: false,
    replaceLeadingZero: true,
  })(e);
}

export function applyNumericLiteralKeyDown(e: KeyboardEvent<HTMLInputElement>, options?: NumericInputOptions): void {
  createNumericKeyDown(toNumericKeyDownOptions(options))(e);
}

export function applyNumericLiteralPaste(e: ClipboardEvent<HTMLInputElement>, options?: NumericInputOptions): void {
  createNumericPaste(toNumericKeyDownOptions(options))(e);
}

export const digitInputKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (SKIP_KEYS.has(e.key)) return;
  if (/^[0-9]$/.test(e.key)) return;
  e.preventDefault();
};

export function sanitizeDigitsOnly(input: string): string {
  const val = String(input ?? '');
  return val.replace(/\D/g, '');
}

export function sanitizePositiveInt(input: string, min?: number, previousValue?: string | number): string {
  return sanitizeNumericInputHandler(
    input,
    {
      allowDecimal: false,
      allowExponent: false,
      allowSign: false,
      min,
    } satisfies NumericSanitizeOptions,
    previousValue,
  );
}

export function sanitizeNumericInput(input: string, options?: NumericInputOptions, previousValue?: string): string {
  return sanitizeNumericInputHandler(input, toNumericRuleOptions(options), options?.previousValue ?? previousValue);
}

export function trimNumericLeadingZerosOnBlur(input: string): string {
  return trimLeadingZerosOnBlur(input);
}

export function trimNumericOnBlur(input: string, options?: NumericBlurTrimOptions): string {
  return trimNumericInputOnBlur(input, options);
}

export const integerInputKeyDown = applyPositiveIntegerKeyDown;

export const integerInputPaste = applyPositiveIntegerPaste;

export const numericInputKeyDown = applyNumericLiteralKeyDown;

export const numericInputPaste = applyNumericLiteralPaste;

export const numericLiteralInputKeyDown = applyNumericLiteralKeyDown;

export const numericLiteralInputPaste = applyNumericLiteralPaste;
