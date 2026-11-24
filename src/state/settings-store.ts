// Admin settings. For now they live in this browser's storage; the admin can
// export/import them as JSON. A shared server copy comes with accounts.
import { create } from 'zustand';
import { DEFAULT_SETTINGS, type Settings } from '../estimator/settings';

const KEY = 'gdt.settings.v1';

/** Fill keys added in newer versions from the defaults (deep merge, arrays replaced). */
const mergeDefaults = (base: unknown, saved: unknown): unknown => {
  if (Array.isArray(base)) return Array.isArray(saved) ? saved : base;
  if (base && typeof base === 'object') {
    const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      for (const [k, v] of Object.entries(saved as Record<string, unknown>)) {
        out[k] = k in out ? mergeDefaults(out[k], v) : v;
      }
    }
    return out;
  }
  return saved === undefined || saved === null || typeof saved !== typeof base ? base : saved;
};

export const parseSettings = (json: string): Settings =>
  mergeDefaults(DEFAULT_SETTINGS, JSON.parse(json)) as Settings;

const load = (): Settings => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return parseSettings(raw);
  } catch {
    /* storage blocked or bad JSON: use defaults */
  }
  return structuredClone(DEFAULT_SETTINGS);
};

interface SettingsState {
  settings: Settings;
  setSettings: (s: Settings) => void;
  update: (fn: (draft: Settings) => void) => void;
  reset: () => void;
}

const save = (s: Settings) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
};

export const useSettings = create<SettingsState>((set, get) => ({
  settings: load(),
  setSettings: (settings) => {
    save(settings);
    set({ settings });
  },
  update: (fn) => {
    const next = structuredClone(get().settings);
    fn(next);
    save(next);
    set({ settings: next });
  },
  reset: () => {
    const s = structuredClone(DEFAULT_SETTINGS);
    save(s);
    set({ settings: s });
  },
}));
