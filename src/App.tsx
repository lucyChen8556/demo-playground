import { useMemo, useState } from 'react';
import type { ClipboardEvent, ChangeEvent, KeyboardEvent } from 'react';

import {
  digitInputKeyDown,
  integerInputKeyDown,
  numericLiteralInputKeyDown,
  sanitizeNumericInput,
  sanitizeDigitsOnly,
  sanitizePositiveInt,
  trimNumericOnBlur,
} from './utils/InputUtils';

type BlurFlags = {
  leadingZeros: boolean;
  leadingDecimalPoint: boolean;
  trailingDecimalPoint: boolean;
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
  candidateNextValue?: string;
  reason?: string;
};

type ScenarioKind = 'int' | 'decimal' | 'digital' | 'text';

type Scenario = {
  id: ScenarioKind;
  label: string;
  description: string;
  inputMode: 'numeric' | 'decimal' | 'text';
  placeholder: string;
  unit?: string;
  samples: string[];
  options: PlaygroundOptions;
  bindings: {
    keydown: string;
    paste: string;
    change: string;
    blur: string;
  };
};

const defaultEventReport = (detail: string): EventReport => ({
  label: 'waiting',
  detail,
  candidateNextValue: '',
  reason: '',
});

const SCENARIOS: Scenario[] = [
  {
    id: 'int',
    label: 'Int',
    description: 'Positive integer style input. Uses current integer handler and integer sanitize flow.',
    inputMode: 'numeric',
    placeholder: '0, 12, 300',
    unit: 'pcs',
    samples: ['0', '00', '007', '12', 'abc12', '-15'],
    options: {
      decimal: '0',
      exponent: false,
      sign: false,
      replaceLeadingZero: true,
      min: '0',
      blur: {
        leadingZeros: true,
        leadingDecimalPoint: false,
        trailingDecimalPoint: false,
        trailingFractionZeros: false,
      },
    },
    bindings: {
      keydown: 'integerInputKeyDown(event)',
      paste: 'sanitizePositiveInt(candidateRawValue, min)',
      change: 'sanitizePositiveInt(nextRawValue, min, previousValue)',
      blur: 'trimNumericOnBlur(value, blurFlags)',
    },
  },
  {
    id: 'decimal',
    label: 'decimal',
    description: 'Decimal input wired like your sample: numeric literal keydown, sanitize on change, trim on blur.',
    inputMode: 'decimal',
    placeholder: '12.34',
    unit: 'kg',
    samples: ['0', '00', '0012.3400', '.5', '12.3456', 'abc12.3kg'],
    options: {
      decimal: '2',
      exponent: false,
      sign: false,
      replaceLeadingZero: false,
      min: '0',
      blur: {
        leadingZeros: true,
        leadingDecimalPoint: true,
        trailingDecimalPoint: true,
        trailingFractionZeros: false,
      },
    },
    bindings: {
      keydown: 'numericLiteralInputKeyDown(event, { exponent, sign, replaceLeadingZero })',
      paste: 'sanitizeNumericInput(candidateRawValue, { min, decimal, exponent, sign, replaceLeadingZero })',
      change: 'sanitizeNumericInput(nextRawValue, { min, decimal, exponent, sign, replaceLeadingZero, previousValue })',
      blur: 'trimNumericOnBlur(value, blurFlags)',
    },
  },
  {
    id: 'digital',
    label: 'digital',
    description: 'Digits-only input. Keeps leading zeros like 00 and does not trim them on blur.',
    inputMode: 'numeric',
    placeholder: '123456',
    samples: ['00123', 'abc12', '12.34', '-56', '9e3', 'room42'],
    options: {
      decimal: '0',
      exponent: false,
      sign: false,
      replaceLeadingZero: false,
      min: '0',
      blur: {
        leadingZeros: false,
        leadingDecimalPoint: false,
        trailingDecimalPoint: false,
        trailingFractionZeros: false,
      },
    },
    bindings: {
      keydown: 'digitInputKeyDown(event)',
      paste: 'sanitizeDigitsOnly(candidateRawValue)',
      change: 'sanitizeDigitsOnly(nextRawValue)',
      blur: 'trimNumericOnBlur(value, blurFlags)',
    },
  },
  {
    id: 'text',
    label: 'text',
    description: 'No numeric logic applied. Useful as a control group against the other scenarios.',
    inputMode: 'text',
    placeholder: 'Anything goes',
    samples: ['0123', '0.123', 'abc-12.3kg', '1e-3', '--', 'room 42'],
    options: {
      decimal: '',
      exponent: false,
      sign: false,
      replaceLeadingZero: false,
      min: '',
      blur: {
        leadingZeros: false,
        leadingDecimalPoint: false,
        trailingDecimalPoint: false,
        trailingFractionZeros: false,
      },
    },
    bindings: {
      keydown: 'native text input',
      paste: 'native paste',
      change: 'raw value passthrough',
      blur: 'raw value passthrough',
    },
  },
];

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

function buildNumericOptions(options: PlaygroundOptions, previousValue?: string) {
  return {
    min: toMinOption(options.min),
    decimal: toDecimalOption(options.decimal),
    exponent: options.exponent,
    sign: options.sign,
    replaceLeadingZero: options.replaceLeadingZero,
    previousValue,
  };
}

function sanitizeByScenario(kind: ScenarioKind, value: string, options: PlaygroundOptions, previousValue?: string): string {
  if (kind === 'text') {
    return value;
  }

  if (kind === 'digital') {
    return sanitizeDigitsOnly(value);
  }

  if (kind === 'int') {
    return sanitizePositiveInt(value, toMinOption(options.min), previousValue);
  }

  return sanitizeNumericInput(value, buildNumericOptions(options, previousValue));
}

function pastePreviewByScenario(kind: ScenarioKind, pastedText: string, options: PlaygroundOptions): string {
  if (kind === 'text') {
    return pastedText;
  }

  if (kind === 'digital') {
    return sanitizeDigitsOnly(pastedText);
  }

  if (kind === 'int') {
    return sanitizePositiveInt(pastedText, toMinOption(options.min));
  }

  return sanitizeNumericInput(pastedText, buildNumericOptions(options));
}

function runBlur(value: string, options: PlaygroundOptions): string {
  return trimNumericOnBlur(value, options.blur);
}

function buildKeyDownOptions(options: PlaygroundOptions) {
  return {
    exponent: options.exponent,
    sign: options.sign,
    replaceLeadingZero: options.replaceLeadingZero,
  };
}

function buildCandidateNextValue(rawValue: string, start: number, end: number, key: string): string {
  return `${rawValue.slice(0, start)}${key}${rawValue.slice(end)}`;
}

function scenarioById(id: ScenarioKind): Scenario {
  return SCENARIOS.find((scenario) => scenario.id === id) ?? SCENARIOS[0];
}

export default function App() {
  const [scenarioId, setScenarioId] = useState<ScenarioKind>('decimal');
  const [controls, setControls] = useState<PlaygroundOptions>(scenarioById('decimal').options);
  const [inputValue, setInputValue] = useState('');
  const [rawValue, setRawValue] = useState('');
  const [sanitizeResult, setSanitizeResult] = useState('');
  const [blurResult, setBlurResult] = useState('');
  const [keydownReport, setKeydownReport] = useState<EventReport>(defaultEventReport('Press a key to inspect the decision.'));
  const [pasteReport, setPasteReport] = useState<EventReport>(defaultEventReport('Paste text to inspect the result.'));

  const activeScenario = useMemo(() => scenarioById(scenarioId), [scenarioId]);
  const livePreview = useMemo(
    () => ({
      sanitized: sanitizeByScenario(scenarioId, rawValue, controls),
      blurred: runBlur(sanitizeByScenario(scenarioId, rawValue, controls), controls),
    }),
    [controls, rawValue, scenarioId],
  );

  const resetReports = () => {
    setKeydownReport(defaultEventReport('Press a key to inspect the decision.'));
    setPasteReport(defaultEventReport('Paste text to inspect the result.'));
  };

  const applyScenario = (nextScenarioId: ScenarioKind) => {
    const nextScenario = scenarioById(nextScenarioId);

    setScenarioId(nextScenarioId);
    setControls(nextScenario.options);
    setInputValue('');
    setRawValue('');
    setSanitizeResult('');
    setBlurResult('');
    resetReports();
  };

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
    const currentValue = event.currentTarget.value ?? '';
    const start = event.currentTarget.selectionStart ?? currentValue.length;
    const end = event.currentTarget.selectionEnd ?? currentValue.length;
    const candidateNextValue = event.key.length === 1
      ? buildCandidateNextValue(currentValue, start, end, event.key)
      : currentValue;

    if (scenarioId === 'text') {
      setKeydownReport({
        label: 'allowed',
        detail: `key "${event.key}" on "${event.currentTarget.value}"`,
        candidateNextValue,
        reason: 'text scenario does not apply numeric key filtering',
      });
      return;
    }

    if (scenarioId === 'digital') {
      digitInputKeyDown(event);
    } else if (scenarioId === 'int') {
      integerInputKeyDown(event);
    } else {
      numericLiteralInputKeyDown(event, buildKeyDownOptions(controls));
    }

    setKeydownReport({
      label: event.defaultPrevented ? 'blocked' : 'allowed',
      detail: `key "${event.key}" on "${event.currentTarget.value}"`,
      candidateNextValue,
      reason: event.defaultPrevented ? 'candidate next value is rejected by current keydown progress rule' : 'candidate next value passed current keydown progress rule',
    });
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pastedText = event.clipboardData.getData('text');
    const currentValue = event.currentTarget.value ?? '';
    const start = event.currentTarget.selectionStart ?? currentValue.length;
    const end = event.currentTarget.selectionEnd ?? currentValue.length;
    const candidateRawValue = `${currentValue.slice(0, start)}${pastedText}${currentValue.slice(end)}`;
    const sanitizedVal = scenarioId === 'text'
      ? candidateRawValue
      : sanitizeByScenario(scenarioId, candidateRawValue, controls, candidateRawValue);

    if (sanitizedVal === '') {
      event.preventDefault();
    }

    setPasteReport({
      label: sanitizedVal === '' ? 'blocked' : 'allowed',
      detail: `"${pastedText}" -> "${sanitizedVal}"`,
      candidateNextValue: candidateRawValue,
      reason: sanitizedVal === '' ? 'sanitize result is empty, so paste is prevented' : 'sanitize result is non-empty, so paste is allowed',
    });
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextRawValue = event.target.value;
    const sanitized = sanitizeByScenario(scenarioId, String(nextRawValue ?? ''), controls, nextRawValue || '');

    setInputValue(sanitized);
    setRawValue(nextRawValue);
    setSanitizeResult(sanitized);
  };

  const handleBlur = () => {
    if (scenarioId === 'text') {
      setBlurResult(inputValue);
      return;
    }

    const trimmed = runBlur(String(inputValue || ''), controls);
    setBlurResult(trimmed);
    setInputValue(trimmed);
    setSanitizeResult(trimmed);
  };

  const injectSample = (sample: string) => {
    const sanitized = sanitizeByScenario(scenarioId, sample, controls);
    const trimmed = runBlur(sanitized, controls);

    setInputValue(sanitized);
    setRawValue(sample);
    setSanitizeResult(sanitized);
    setBlurResult(trimmed);
    resetReports();
  };

  return (
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">numeric-input-playground</p>
        <h1>Numeric Input Playground</h1>
        <p className="hero-copy">
          Switch between realistic input types, then inspect how keydown, paste, sanitize, and blur behave for each one.
        </p>
      </section>

      <section className="panel scenario-panel">
        <div className="panel-header">
          <h2>Scenario</h2>
          <p>Different type means a different input setup, not just a different sample value.</p>
        </div>

        <div className="scenario-list">
          {SCENARIOS.map((scenario) => (
            <button
              key={scenario.id}
              type="button"
              className={`scenario-card${scenario.id === scenarioId ? ' scenario-card-active' : ''}`}
              onClick={() => applyScenario(scenario.id)}
            >
              <strong>{scenario.label}</strong>
              <span>{scenario.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="workspace-grid">
        <aside className="panel controls-panel">
          <div className="panel-header">
            <h2>Controls</h2>
            <p>Tune the active scenario without touching the shared numeric logic.</p>
          </div>

          <div className="fieldset fieldset-first">
            <p>Active input config</p>

            <label className="field">
              <span>Input mode</span>
              <input value={activeScenario.inputMode} disabled />
            </label>

            <label className="field">
              <span>Max decimal places</span>
              <input
                value={controls.decimal}
                onChange={(event) => setFlag('decimal', event.target.value)}
                placeholder="empty = unlimited"
                disabled={scenarioId === 'int' || scenarioId === 'digital' || scenarioId === 'text'}
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
                disabled={scenarioId === 'int' || scenarioId === 'digital' || scenarioId === 'text'}
              />
              <span>allow exponent</span>
            </label>

            <label className="toggle">
              <input
                type="checkbox"
                checked={controls.sign}
                onChange={(event) => setFlag('sign', event.target.checked)}
                disabled={scenarioId === 'int' || scenarioId === 'digital' || scenarioId === 'text'}
              />
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
          </div>

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
                checked={controls.blur.trailingDecimalPoint}
                onChange={(event) => setBlurFlag('trailingDecimalPoint', event.target.checked)}
              />
              <span>trim trailing decimal point</span>
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
            <h2>{activeScenario.label}</h2>
            <p>{activeScenario.description}</p>
          </div>

          <div className="input-card">
            <div className="input-meta">
              <span className="meta-chip">type="text"</span>
              <span className="meta-chip">inputMode="{activeScenario.inputMode}"</span>
              {activeScenario.unit ? <span className="meta-chip">unit="{activeScenario.unit}"</span> : null}
            </div>

            <label className="field">
              <span>Try input</span>
              <div className="input-with-unit">
                <input
                  type="text"
                  inputMode={activeScenario.inputMode}
                  value={inputValue}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder={activeScenario.placeholder}
                />
                {activeScenario.unit ? <span className="input-unit">{activeScenario.unit}</span> : null}
              </div>
            </label>

            <div className="sample-group">
              {activeScenario.samples.map((sample) => (
                <button key={sample} type="button" className="sample-chip" onClick={() => injectSample(sample)}>
                  {sample}
                </button>
              ))}
            </div>
          </div>
        </section>

        <aside className="panel output-panel">
          <div className="panel-header">
            <h2>QA Checklist</h2>
            <p>Use this panel to confirm what the next candidate value was, whether it was blocked, and what each stage returned.</p>
          </div>

          <div className="metric">
            <span className="metric-label">check 1. active scenario</span>
            <code>{activeScenario.id}</code>
          </div>

          <div className="metric">
            <span className="metric-label">check 2. raw value</span>
            <code>{rawValue || '""'}</code>
          </div>

          <div className="metric">
            <span className="metric-label">check 3. input rendered value</span>
            <code>{inputValue || '""'}</code>
          </div>

          <div className="metric">
            <span className="metric-label">check 4. keydown result</span>
            <strong className={`status status-${keydownReport.label}`}>{keydownReport.label}</strong>
            <code>{keydownReport.detail}</code>
            <code>candidate next value: {keydownReport.candidateNextValue || '""'}</code>
            <code>reason: {keydownReport.reason || '""'}</code>
          </div>

          <div className="metric">
            <span className="metric-label">check 5. paste result</span>
            <strong className={`status status-${pasteReport.label}`}>{pasteReport.label}</strong>
            <code>{pasteReport.detail}</code>
            <code>candidate next value: {pasteReport.candidateNextValue || '""'}</code>
            <code>reason: {pasteReport.reason || '""'}</code>
          </div>

          <div className="metric">
            <span className="metric-label">check 6. sanitize after change</span>
            <code>{sanitizeResult || '""'}</code>
          </div>

          <div className="metric">
            <span className="metric-label">check 7. blur result</span>
            <code>{blurResult || '""'}</code>
          </div>

          <div className="metric">
            <span className="metric-label">check 8. preview from current raw</span>
            <code>{JSON.stringify(livePreview, null, 2)}</code>
          </div>
        </aside>
      </section>
    </main>
  );
}
