// The design being edited, with undo/redo. Autosaved to this browser so work
// is never lost without an account; saving to the cloud asks for login.
import { create } from 'zustand';
import { emptyStory, sampleDesign } from '../model/factory';
import type { Design, FurnitureKind, OpeningKind, RoomType } from '../model/types';

const KEY = 'gdt.design.v1';

export type Tool =
  | { kind: 'select' }
  | { kind: 'rect' }
  | { kind: 'wall'; exterior: boolean }
  | { kind: 'opening'; opening: OpeningKind }
  | { kind: 'room'; room: RoomType }
  | { kind: 'furniture'; furniture: FurnitureKind };

export type Selection =
  | { kind: 'wall'; id: string }
  | { kind: 'opening'; id: string }
  | { kind: 'room'; id: string }
  | { kind: 'furniture'; id: string }
  | null;

export type ViewMode = '2d' | '3d';

interface DesignState {
  design: Design;
  storyIndex: number;
  tool: Tool;
  selection: Selection;
  view: ViewMode;
  past: Design[];
  future: Design[];
  /** Apply a change as one undo step. */
  change: (fn: (d: Design) => void) => void;
  /** Replace without an undo step (e.g. while dragging). */
  replace: (fn: (d: Design) => void) => void;
  /** Mark the start of a drag so the whole drag is one undo step. */
  checkpoint: () => void;
  undo: () => void;
  redo: () => void;
  load: (d: Design) => void;
  setTool: (t: Tool) => void;
  select: (s: Selection) => void;
  setView: (v: ViewMode) => void;
  setStory: (i: number) => void;
  addStory: (copyBelow: boolean) => void;
  removeStory: (i: number) => void;
}

const loadSaved = (): Design => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Design;
  } catch {
    /* ignore */
  }
  return sampleDesign();
};

let saveTimer: ReturnType<typeof setTimeout> | undefined;
const autosave = (d: Design) => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(d));
    } catch {
      /* ignore */
    }
  }, 300);
};

const MAX_HISTORY = 100;

export const useDesign = create<DesignState>((set, get) => ({
  design: loadSaved(),
  storyIndex: 0,
  tool: { kind: 'select' },
  selection: null,
  view: '2d',
  past: [],
  future: [],
  change: (fn) => {
    const prev = get().design;
    const next = structuredClone(prev);
    fn(next);
    next.updatedAt = new Date().toISOString();
    autosave(next);
    set({ design: next, past: [...get().past, prev].slice(-MAX_HISTORY), future: [] });
  },
  replace: (fn) => {
    const next = structuredClone(get().design);
    fn(next);
    next.updatedAt = new Date().toISOString();
    autosave(next);
    set({ design: next });
  },
  checkpoint: () => set({ past: [...get().past, get().design].slice(-MAX_HISTORY), future: [] }),
  undo: () => {
    const { past, design, future } = get();
    const prev = past[past.length - 1];
    if (!prev) return;
    autosave(prev);
    set({ design: prev, past: past.slice(0, -1), future: [design, ...future], selection: null, storyIndex: Math.min(get().storyIndex, prev.stories.length - 1) });
  },
  redo: () => {
    const { past, design, future } = get();
    const next = future[0];
    if (!next) return;
    autosave(next);
    set({ design: next, past: [...past, design], future: future.slice(1), selection: null });
  },
  load: (d) => {
    autosave(d);
    set({ design: structuredClone(d), past: [], future: [], selection: null, storyIndex: 0 });
  },
  setTool: (tool) => set({ tool, selection: null }),
  select: (selection) => set({ selection }),
  setView: (view) => set({ view }),
  setStory: (storyIndex) => set({ storyIndex, selection: null }),
  addStory: (copyBelow) => {
    get().change((d) => {
      const below = d.stories[d.stories.length - 1];
      const s = emptyStory();
      if (copyBelow && below) {
        // Copy the exterior walls so the new floor sits on the one below.
        s.walls = below.walls
          .filter((w) => w.exterior)
          .map((w) => ({ ...w, id: `${w.id}_${s.id}` }));
      }
      d.stories.push(s);
    });
    set({ storyIndex: get().design.stories.length - 1, selection: null });
  },
  removeStory: (i) => {
    if (get().design.stories.length <= 1) return;
    get().change((d) => {
      d.stories.splice(i, 1);
    });
    set({ storyIndex: Math.max(0, Math.min(get().storyIndex, get().design.stories.length - 1)), selection: null });
  },
}));

export const currentStory = (s: Pick<DesignState, 'design' | 'storyIndex'>) =>
  s.design.stories[s.storyIndex] ?? s.design.stories[0]!;
