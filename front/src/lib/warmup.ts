import { API_URL, handle } from '@/lib/api';

export type BlockReason =
  | 'paused'
  | 'not_connected'
  | 'outside_window'
  | 'daily_limit'
  | 'hourly_limit'
  | 'cooldown'
  | null;

export type Availability = {
  instanceName: string;
  canSend: boolean;
  reason: BlockReason;
  tier: number;
  tierLabel: string;
  ageDays: number | null;
  reputationScore: number;
  dailyLimit: number;
  sentToday: number;
  remainingToday: number;
  hourlyLimit: number;
  sentThisHour: number;
  remainingThisHour: number;
  nextAllowedAt: string | null;
  withinWindow: boolean;
  paused: boolean;
};

export type WarmupTier = {
  tier: number;
  label: string;
  minDays: number;
  dailyLimit: number;
  hourlyLimit: number;
  minDelaySeconds: number;
  maxDelaySeconds: number;
};

export type WarmupConfig = {
  id: string;
  tiers: WarmupTier[];
  timezone: string;
  windowStartHour: number;
  windowEndHour: number;
  pauseThreshold: string;
  minReputationMultiplier: string;
};

export type UpdateWarmupConfigInput = {
  tiers?: WarmupTier[];
  timezone?: string;
  windowStartHour?: number;
  windowEndHour?: number;
  pauseThreshold?: number;
  minReputationMultiplier?: number;
};

/** Disponibilidad de todos los dispositivos (cruza estado real con límites). */
export async function fetchAvailability(): Promise<Availability[]> {
  const res = await fetch(`${API_URL}/warmup/availability`);
  return handle<Availability[]>(res);
}

export async function fetchWarmupConfig(): Promise<WarmupConfig> {
  const res = await fetch(`${API_URL}/warmup/config`);
  return handle<WarmupConfig>(res);
}

export async function saveWarmupConfig(
  input: UpdateWarmupConfigInput,
): Promise<WarmupConfig> {
  const res = await fetch(`${API_URL}/warmup/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return handle<WarmupConfig>(res);
}

export type SyncResult = {
  total: number;
  webhooksRegistrados: number;
  reputacionesSembradas: number;
};

/** Adopta las instancias existentes en Evolution (reputación + webhook). */
export async function syncDevices(): Promise<SyncResult> {
  const res = await fetch(`${API_URL}/warmup/sync`, { method: 'POST' });
  return handle<SyncResult>(res);
}

export async function pauseDevice(name: string): Promise<void> {
  const res = await fetch(
    `${API_URL}/warmup/devices/${encodeURIComponent(name)}/pause`,
    { method: 'POST' },
  );
  await handle<void>(res);
}

export async function resumeDevice(name: string): Promise<void> {
  const res = await fetch(
    `${API_URL}/warmup/devices/${encodeURIComponent(name)}/resume`,
    { method: 'POST' },
  );
  await handle<void>(res);
}
