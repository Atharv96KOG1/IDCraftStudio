import { useState } from 'react';
import { bridge, copyText, type LicenseStatus } from '../lib/license';
import { Modal, toast } from './ui';

function KeyForm({ machineId, onDone }: { machineId: string; onDone: (s: LicenseStatus) => void }) {
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const activate = async () => {
    if (!bridge) return;
    setBusy(true);
    setError(null);
    const r = await bridge.license.activate(key);
    setBusy(false);
    if (r.ok && r.status) {
      toast(`Activated for ${r.status.licensee}. Thank you!`);
      onDone(r.status);
    } else setError(r.error ?? 'Activation failed.');
  };
  return (
    <div className="lic-form">
      <label className="field">
        <span>Your Machine ID — send this to your seller to get a key</span>
        <div className="row">
          <input readOnly value={machineId} className="mono lic-mid" onFocus={(e) => e.target.select()} />
          <button
            className="btn"
            onClick={async () => {
              await copyText(machineId);
              toast('Machine ID copied.');
            }}
          >
            Copy
          </button>
        </div>
      </label>
      <label className="field">
        <span>Licence key</span>
        <textarea rows={4} className="mono" placeholder="IDCS-XXXXX-XXXXX-…" value={key} onChange={(e) => setKey(e.target.value)} />
      </label>
      {error && <p className="error">{error}</p>}
      <button className="btn primary lic-btn" disabled={!key.trim() || busy} onClick={activate}>
        {busy ? 'Checking…' : 'Activate'}
      </button>
    </div>
  );
}

/** Full-screen lock shown when the trial has ended or the licence is invalid. */
export function ActivationScreen({ status, onDone }: { status: LicenseStatus; onDone: (s: LicenseStatus) => void }) {
  return (
    <div className="lic-screen">
      <div className="lic-card">
        <div className="brand big">
          <img className="logo-img" src="./icon.png" alt="" />
          <span>IDCraft Studio</span>
        </div>
        <h2>{status.state === 'clock' ? 'Check your date and time' : 'Activate IDCraft Studio'}</h2>
        {status.reason && <p className="hint">{status.reason}</p>}
        {status.state !== 'clock' && <KeyForm machineId={status.machineId} onDone={onDone} />}
        <p className="hint">Your designs and records are safe and will be there after activation.</p>
      </div>
    </div>
  );
}

/** Licence details + change key, opened from the settings menu or trial banner. */
export function LicenseDialog({ status, onClose, onChange }: { status: LicenseStatus; onClose: () => void; onChange: (s: LicenseStatus) => void }) {
  return (
    <Modal title="Licence" onClose={onClose} width={520}>
      {status.state === 'licensed' ? (
        <div className="lic-info">
          <p>
            ✅ Licensed to <b>{status.licensee}</b>
          </p>
          <p className="hint">
            {status.edition} edition · {status.expires ? `valid until ${new Date(status.expires).toLocaleDateString()}` : 'lifetime licence'}
          </p>
          <p className="hint mono">Machine ID: {status.machineId}</p>
          <button
            className="btn"
            onClick={async () => {
              if (!bridge || !confirm('Remove the licence key from this PC? You can enter it again later.')) return;
              onChange(await bridge.license.deactivate());
            }}
          >
            Remove licence from this PC
          </button>
        </div>
      ) : (
        <>
          {status.state === 'trial' && (
            <p>
              Free trial: <b>{status.daysLeft} day{status.daysLeft === 1 ? '' : 's'}</b> left.
            </p>
          )}
          {status.state === 'dev' ? (
            <p className="hint">Licensing works in the installed desktop app.</p>
          ) : (
            <KeyForm
              machineId={status.machineId}
              onDone={(s) => {
                onChange(s);
                onClose();
              }}
            />
          )}
        </>
      )}
    </Modal>
  );
}

const FEATURES = [
  ['🎨', 'Card designer', 'Modern templates, shapes, icons and 220+ English & Marathi fonts'],
  ['📊', 'Excel import', 'Columns detected automatically, photos matched by file name'],
  ['✨', 'Photo AI', 'Face crop, straighten, colour fix and background change'],
  ['▦', 'QR & barcode', 'Every person’s details inside a crisp, scannable QR'],
  ['🖨', 'Print & export', 'A4 / A3 sheets, PDF, JPG, HTML and images up to 2400 dpi'],
];

/** Animated first-run setup: welcome → start trial or enter a key → ready. */
export function WelcomeWizard({ status, onDone }: { status: LicenseStatus; onDone: (s: LicenseStatus) => void }) {
  const [step, setStep] = useState(status.state === 'licensed' ? 2 : 0);
  const [current, setCurrent] = useState(status);
  return (
    <div className="wiz">
      <div className="wiz-bg">
        {Array.from({ length: 14 }, (_, i) => (
          <span key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 7) * 0.9}s`, animationDuration: `${9 + (i % 5) * 2}s` }} />
        ))}
      </div>
      <div className="wiz-card" key={step}>
        <div className="wiz-steps">
          {['Welcome', 'Licence', 'Ready'].map((l, i) => (
            <span key={l} className={i <= step ? 'on' : ''}>
              <b>{i + 1}</b> {l}
            </span>
          ))}
        </div>
        {step === 0 && (
          <>
            <img className="wiz-logo" src="./icon.png" alt="" />
            <h1>Welcome to IDCraft Studio</h1>
            <p className="wiz-sub">Design, fill and print professional ID cards in minutes.</p>
            <div className="wiz-features">
              {FEATURES.map(([icon, title, text], i) => (
                <div key={title} className="wiz-feature" style={{ animationDelay: `${0.25 + i * 0.12}s` }}>
                  <span>{icon}</span>
                  <div>
                    <b>{title}</b>
                    <small>{text}</small>
                  </div>
                </div>
              ))}
            </div>
            <button className="btn primary wiz-next" onClick={() => setStep(1)}>
              Get started →
            </button>
          </>
        )}
        {step === 1 && (
          <>
            <h1>Activate or try free</h1>
            <p className="wiz-sub">
              {status.state === 'trial'
                ? `You can use every feature free for ${status.daysLeft} more day${status.daysLeft === 1 ? '' : 's'}. After that a licence key is needed.`
                : 'Enter your licence key to continue.'}
            </p>
            {status.state === 'trial' && (
              <button className="btn primary wiz-next" onClick={() => setStep(2)}>
                Start {status.daysLeft}-day free trial
              </button>
            )}
            <div className="wiz-or">or enter your licence key</div>
            <KeyForm
              machineId={status.machineId}
              onDone={(s) => {
                setCurrent(s);
                setStep(2);
              }}
            />
          </>
        )}
        {step === 2 && (
          <>
            <div className="wiz-check">✓</div>
            <h1>You’re all set!</h1>
            <p className="wiz-sub">
              {current.state === 'licensed'
                ? `Licensed to ${current.licensee}. Thank you!`
                : `Free trial active – ${current.daysLeft} day${current.daysLeft === 1 ? '' : 's'} left.`}
            </p>
            <p className="hint">Start by importing your Excel sheet on the Records page, then pick a design.</p>
            <button className="btn primary wiz-next" onClick={() => onDone(current)}>
              Open IDCraft Studio
            </button>
          </>
        )}
      </div>
    </div>
  );
}
