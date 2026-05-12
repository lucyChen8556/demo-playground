import { useState } from 'react';
import type { ClipboardEvent, ChangeEvent, KeyboardEvent } from 'react';

import {
  applyNumericLiteralKeyDown,
  applyNumericLiteralPaste,
  sanitizeNumericInput,
  trimNumericOnBlur,
} from '../InputUtils';

type BlurFlags = {
  leadingZeros: boolean;
  leadingDecimalPoint: boolean;
  trailingFractionZeros: boolean;
};

type PlaygroundOptions = {
  decimal: string;
  exponent: boolean;
  sign: boolean;
  replaceLeadingZero: boolean;
  min: string;
  blur: BlurFlags;
};

type EventReport = {
  label: string;
  detail: string;
};

const SAMPLE_VALUES = ['0', '00', '0012.3400', '.5', '-.75', '1e3', '1e-3', '12..3', '--1', 'abc12.3kg'];

const defaultOptions: PlaygroundOptions = {
  decimal: '2',
  exponent: false,
  sign: false,
  replaceLeadingZero: false,
  min: '0',
  blur: {
    leadingZeros: true,
    leadingDecimalPoint: true,
    trailingFractionZeros: false,
  },
};

function toDecimalOption(decimal: string): number | undefined {
  if (decimal.trim() === '') {
    return undefined;
  }

  const parsed = Number(decimal);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function toMinOption(min: string): number | undefined {
  if (min.trim() === '') {
    return undefined;
  }

  const parsed = Number(min);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function buildOptions(options: PlaygroundOptions, previousValue?: string) {
  return {
    min: toMinOption(options.min),
    decimal: toDecimalOption(options.decimal),
    exponent: options.exponent,
    sign: options.sign,
    replaceLeadingZero: options.replaceLeadingZero,
    previousValue,
  };
}

function buildPreview(rawValue: string, options: PlaygroundOptions) {
  const sanitized = sanitizeNumericInput(rawValue, buildOptions(options));
  const blurred = trimNumericOnBlur(sanitized, options.blur);

  return { sanitized, blurred };
}

export default function App() {
  const [controls, setControls] = useState<PlaygroundOptions>(defaultOptions);
  const [inputValue, setInputValue] = useState('');
  const [rawValue, setRawValue] = useState('');
  const [sanitizeResult, setSanitizeResult] = useState('');
  const [blurResult, setBlurResult] = useState('');
  const [keydownReport, setKeydownReport] = useState<EventReport>({
    label: 'waiting',
    detail: 'Press a key to inspect the decision.',
  });
  const [pasteReport, setPasteReport] = useState<EventReport>({
    label: 'waiting',
    detail: 'Paste text to inspect the result.',
  });

  const livePreview = buildPreview(rawValue, controls);

  const setFlag = (key: keyof PlaygroundOptions, value: boolean | string) => {
    setControls((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const setBlurFlag = (key: keyof BlurFlags, value: boolean) => {
    setControls((current) => ({
      ...current,
      blur: {
        ...current.blur,
        [key]: value,
      },
    }));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    applyNumericLiteralKeyDown(event, buildOptions(controls));

    setKeydownReport({
      label: event.defaultPrevented ? 'blocked' : 'allowed',
      detail: `key "${event.key}" on "${event.currentTarget.value}"`,
    });
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const beforeValue = event.currentTarget.value;
    const pastedText = event.clipboardData.getData('text');

    applyNumericLiteralPaste(event, buildOptions(controls));

    requestAnimationFrame(() => {
      const afterValue = event.currentTarget.value;
      const label = event.defaultPrevented ? (afterValue === beforeValue ? 'blocked' : 'rewritten') : 'allowed';
      setPasteReport({
        label,
        detail: `"${pastedText}" -> "${afterValue}"`,
      });
    });
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextRawValue = event.target.value;
    const sanitized = sanitizeNumericInput(nextRawValue, buildOptions(controls, inputValue));

    setInputValue(sanitized);
    setRawValue(nextRawValue);
    setSanitizeResult(sanitized);
  };

  const handleBlur = () => {
    const trimmed = trimNumericOnBlur(sanitizeResult || inputValue, controls.blur);
    setBlurResult(trimmed);
    setInputValue(trimmed);
    setRawValue(trimmed);
    setSanitizeResult(trimmed);
  };

  const injectSample = (sample: string) => {
    const sanitized = sanitizeNumericInput(sample, buildOptions(controls));
    const trimmed = trimNumericOnBlur(sanitized, controls.blur);

    setInputValue(sanitized);
    setRawValue(sample);
    setSanitizeResult(sanitized);
    setBlurResult(trimmed);
  };

  return (
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">numeric-input-playground</p>
        <h1>Numeric Input Playground</h1>
        <p className="hero-copy">
          Toggle parser rules on the left, type in the middle, and watch keydown, paste, sanitize, and blur outcomes on
          the right.
        </p>
      </section>

      <section className="workspace-grid">
        <aside className="panel controls-panel">
          <div className="panel-header">
            <h2>Controls</h2>
            <p>Keep this tight and focused on numeric edge cases.</p>
          </div>

          <label className="field">
            <span>Max decimal places</span>
            <input
              value={controls.decimal}
              onChange={(event) => setFlag('decimal', event.target.value)}
              placeholder="empty = unlimited"
            />
          </label>

          <label className="field">
            <span>Min</span>
            <input value={controls.min} onChange={(event) => setFlag('min', event.target.value)} placeholder="0" />
          </label>

          <label className="toggle">
            <input
              type="checkbox"
              checked={controls.exponent}
              onChange={(event) => setFlag('exponent', event.target.checked)}
            />
            <span>allow exponent</span>
          </label>

          <label className="toggle">
            <input type="checkbox" checked={controls.sign} onChange={(event) => setFlag('sign', event.target.checked)} />
            <span>allow sign</span>
          </label>

          <label className="toggle">
            <input
              type="checkbox"
              checked={controls.replaceLeadingZero}
              onChange={(event) => setFlag('replaceLeadingZero', event.target.checked)}
            />
            <span>replace leading zero</span>
          </label>

          <div className="fieldset">
            <p>Blur trim flags</p>
            <label className="toggle">
              <input
                type="checkbox"
                checked={controls.blur.leadingZeros}
                onChange={(event) => setBlurFlag('leadingZeros', event.target.checked)}
              />
              <span>trim leading zeros</span>
            </label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={controls.blur.leadingDecimalPoint}
                onChange={(event) => setBlurFlag('leadingDecimalPoint', event.target.checked)}
              />
              <span>normalize leading decimal point</span>
            </label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={controls.blur.trailingFractionZeros}
                onChange={(event) => setBlurFlag('trailingFractionZeros', event.target.checked)}
              />
              <span>trim trailing fraction zeros</span>
            </label>
          </div>
        </aside>

        <section className="panel input-panel">
          <div className="panel-header">
            <h2>Input sample</h2>
            <p>Real typing path with your shared numeric utils.</p>
          </div>

          <div className="input-card">
            <label className="field">
              <span>Try input</span>
              <input
                type="text"
                inputMode="decimal"
                value={inputValue}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Type something like 0012.3400 or 1e-3"
              />
            </label>

            <div className="sample-group">
              {SAMPLE_VALUES.map((sample) => (
                <button key={sample} type="button" className="sample-chip" onClick={() => injectSample(sample)}>
                  {sample}
                </button>
              ))}
            </div>
          </div>
        </section>

        <aside className="panel output-panel">
          <div className="panel-header">
            <h2>Live output</h2>
            <p>Inspect the exact state transitions you care about.</p>
          </div>

          <div className="metric">
            <span className="metric-label">raw value</span>
            <code>{rawValue || '""'}</code>
          </div>

          <div className="metric">
            <span className="metric-label">keydown</span>
            <strong className={`status status-${keydownReport.label}`}>{keydownReport.label}</strong>
            <code>{keydownReport.detail}</code>
          </div>

          <div className="metric">
            <span className="metric-label">paste</span>
            <strong className={`status status-${pasteReport.label}`}>{pasteReport.label}</strong>
            <code>{pasteReport.detail}</code>
          </div>

          <div className="metric">
            <span className="metric-label">sanitize after change</span>
            <code>{sanitizeResult || '""'}</code>
          </div>

          <div className="metric">
            <span className="metric-label">blur result</span>
            <code>{blurResult || '""'}</code>
          </div>

          <div className="metric">
            <span className="metric-label">preview from current raw</span>
            <code>{JSON.stringify(livePreview, null, 2)}</code>
          </div>
        </aside>
      </section>
    </main>
  );
}
