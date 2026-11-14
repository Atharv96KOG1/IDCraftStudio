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
          <span className="logo">ID</span>
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
