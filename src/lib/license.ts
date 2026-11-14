export interface LicenseStatus {
  state: 'licensed' | 'trial' | 'expired' | 'clock' | 'dev';
  machineId: string;
  daysLeft?: number | null;
  licensee?: string;
  edition?: string;
  expires?: number | null;
  reason?: string;
  trialDays?: number;
}

interface Bridge {
  license: {
    status: () => Promise<LicenseStatus>;
    activate: (key: string) => Promise<{ ok: boolean; error?: string; status?: LicenseStatus }>;
    deactivate: () => Promise<LicenseStatus>;
  };
  copyText: (t: string) => Promise<void>;
  version: () => Promise<string>;
}

export const bridge = (window as unknown as { idcraft?: Bridge }).idcraft ?? null;

export async function getLicense(): Promise<LicenseStatus> {
  if (!bridge) return { state: 'dev', machineId: 'BROWSER-PREVIEW' };
  return bridge.license.status();
}

export async function copyText(t: string) {
  if (bridge) return bridge.copyText(t);
  await navigator.clipboard?.writeText(t);
}
