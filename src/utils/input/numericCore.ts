import type { ClipboardEvent, KeyboardEvent } from 'react';

export const SKIP_KEYS = new Set([
  'Backspace',
  'Delete',
  'Tab',
  'Escape',
  'Enter',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
]);

export type BaseKeyDownOptions = {
  allowDecimal: boolean;
  allowExponent: boolean;
  allowSign: boolean;
  maxDecimalPlaces?: number;
};

export type NumericKeyDownOptions = BaseKeyDownOptions & {
  replaceLeadingZero: boolean;
};

export type PositiveIntegerKeyResolution =
  | { kind: 'noop' }
  | { kind: 'block' }
  | { kind: 'replace'; nextValue: string };

const isBasicBlockKey = (e: KeyboardEvent<HTMLInputElement>): boolean => {
  if (e.ctrlKey || e.metaKey || e.altKey) return true;
  return false;
};

function sliceAfterTypedKey(value: string, start: number, end: number, key: string): string {
  return `${value.slice(0, start)}${key}${value.slice(end)}`;
}

function replaceInputValue(el: HTMLInputElement, nextValue: string): void {
  const prototype = Object.getPrototypeOf(el) as HTMLInputElement;
  const valueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

  if (valueSetter) {
    valueSetter.call(el, nextValue);
  } else {
    // eslint-disable-next-line no-param-reassign -- programmatic input value sync
    el.value = nextValue;
  }

  el?.dispatchEvent?.(new Event('input', { bubbles: true }));
}

function getMantissaParts(input: string): {
  fractionPart: string;
} | null {
  const match = input.match(/^([+-]?)(\d*)(?:\.(\d*))?([eE].*)?$/);
  if (!match) {
    return null;
  }

  const [, , , fractionPart = ''] = match;
  return {
    fractionPart,
  };
}

function exceedsMaxDecimalPlaces(input: string, maxDecimalPlaces?: number): boolean {
  if (maxDecimalPlaces === undefined) return false;
  const parts = getMantissaParts(input);
  if (!parts) return false;
  return parts.fractionPart.length > maxDecimalPlaces;
}

export function isValidNumericLiteralInputProgress(s: string): boolean {
  if (s === '') return true;
  if (s === '+' || s === '-') return true;
  // eslint-disable-next-line max-len
  const numericLiteralProgressPattern = /^[+-]?(?:(?:\d+(?:\.\d*)?|\.\d*)(?:[eE][+-]?\d*)?|(?:\d+(?:\.\d*)?|\.\d*)?[eE][+-]?)$/;
  return numericLiteralProgressPattern.test(s);
}

function isValidNumericInputProgress(value: string, options: NumericKeyDownOptions): boolean {
  if (!options.allowDecimal && !options.allowExponent && !options.allowSign) {
    return value === '' || /^\d+$/.test(value);
  }

  if (!isValidNumericLiteralInputProgress(value)) {
    return false;
  }

  if (!options.allowExponent && /[eE]/.test(value)) {
    return false;
  }

  if (!options.allowSign && /[+-]/.test(value)) {
    return false;
  }

  if (exceedsMaxDecimalPlaces(value, options.maxDecimalPlaces)) {
    return false;
  }

  return true;
}

export function resolveNumericKey(
  rawValue: string,
  nextValue: string,
  key: string,
  options: NumericKeyDownOptions,
): PositiveIntegerKeyResolution {
  const isDigit = /^[0-9]$/.test(key);

  if (!isDigit) {
    if (isValidNumericInputProgress(nextValue, options)) {
      return { kind: 'noop' };
    }
    return { kind: 'block' };
  }

  if (options.replaceLeadingZero && rawValue === '0' && key === '0' && nextValue === '00') {
    return { kind: 'block' };
  }

  if (options.replaceLeadingZero && rawValue === '0' && key !== '0' && nextValue === `${rawValue}${key}`) {
    return { kind: 'replace', nextValue: key };
  }

  if (isValidNumericInputProgress(nextValue, options)) {
    return { kind: 'noop' };
  }

  return { kind: 'block' };
}

export function createNumericKeyDown(options: NumericKeyDownOptions) {
  return (e: KeyboardEvent<HTMLInputElement>): void => {
    if (isBasicBlockKey(e)) return;
    if (e.nativeEvent instanceof KeyboardEvent && e.nativeEvent.isComposing) return;

    const { key } = e;
    const isBsOrDel = key === 'Backspace' || key === 'Delete';
    if (!isBsOrDel && SKIP_KEYS.has(key)) return;

    const el = e.currentTarget;
    const rawValue = el.value ?? '';
    const start = el.selectionStart ?? rawValue.length;
    const end = el.selectionEnd ?? rawValue.length;

    if (isBsOrDel) {
      return;
    }

    if (key.length !== 1) return;

    const nextValue = sliceAfterTypedKey(rawValue, start, end, key);
    const resolution = resolveNumericKey(rawValue, nextValue, key, options);

    if (resolution.kind === 'noop') return;

    e.preventDefault();
    if (resolution.kind === 'replace') {
      replaceInputValue(el, resolution.nextValue);
    }
  };
}

function resolvePastedNumericValue(
  rawValue: string,
  start: number,
  end: number,
  pastedText: string,
  options: NumericKeyDownOptions,
): string {
  return Array.from(pastedText).reduce(
    (state, char) => {
      const candidateValue = sliceAfterTypedKey(state.nextValue, state.selectionStart, state.selectionEnd, char);
      const resolution = resolveNumericKey(state.nextValue, candidateValue, char, options);

      if (resolution.kind === 'block') {
        return state;
      }

      if (resolution.kind === 'replace') {
        const replacedValue = resolution.nextValue;
        return {
          nextValue: replacedValue,
          selectionStart: replacedValue.length,
          selectionEnd: replacedValue.length,
        };
      }

      return {
        nextValue: candidateValue,
        selectionStart: state.selectionStart + 1,
        selectionEnd: state.selectionStart + 1,
      };
    },
    {
      nextValue: rawValue,
      selectionStart: start,
      selectionEnd: end,
    },
  ).nextValue;
}

export function filterNumericChars(input: string, options: NumericKeyDownOptions): string {
  return Array.from(input).reduce((nextValue, char) => {
    const candidateValue = `${nextValue}${char}`;
    const resolution = resolveNumericKey(nextValue, candidateValue, char, options);

    if (resolution.kind === 'block') {
      return nextValue;
    }

    if (resolution.kind === 'replace') {
      return resolution.nextValue;
    }

    return candidateValue;
  }, '');
}

export function createNumericPaste(options: NumericKeyDownOptions) {
  return (e: ClipboardEvent<HTMLInputElement>): void => {
    const pastedText = e.clipboardData.getData('text');
    if (pastedText === '') return;

    const el = e.currentTarget;
    const rawValue = el.value ?? '';
    const start = el.selectionStart ?? rawValue.length;
    const end = el.selectionEnd ?? rawValue.length;
    const defaultNextValue = `${rawValue.slice(0, start)}${pastedText}${rawValue.slice(end)}`;
    const nextValue = resolvePastedNumericValue(rawValue, start, end, pastedText, options);

    if (nextValue === defaultNextValue) {
      return;
    }

    e.preventDefault();

    if (nextValue !== rawValue) {
      replaceInputValue(el, nextValue);
    }
  };
}
