import { create } from 'zustand';
import { addPaise, mulDivRound } from '@kirana/shared/money';
import { initialSampleLines, itemById } from './sample-data.js';

const copyInitial = () => initialSampleLines.map((line) => ({ ...line }));
export function sampleTotal(lines) {
  return addPaise(
    ...lines.map((line) => mulDivRound(line.qtyBase, line.pricePaise, itemById[line.id].size)),
  );
}
export const useSampleBill = create((set) => ({
  lines: copyInitial(),
  add: (id) => {
    if (!itemById[id]) return;
    set((state) => ({
      lines: state.lines.some((line) => line.id === id)
        ? state.lines.map((line) =>
            line.id === id
              ? { ...line, qtyBase: Math.min(1_000_000, line.qtyBase + itemById[id].size) }
              : line,
          )
        : [
            ...state.lines,
            { id, qtyBase: itemById[id].size, pricePaise: itemById[id].pricePaise, source: 'demo' },
          ],
    }));
  },
  remove: (id) => set((state) => ({ lines: state.lines.filter((line) => line.id !== id) })),
  restore: (line, index) =>
    set((state) => ({
      lines: state.lines.some((existing) => existing.id === line.id)
        ? state.lines
        : [...state.lines.slice(0, index), line, ...state.lines.slice(index)],
    })),
  edit: (id, changes) =>
    set((state) => ({
      lines: state.lines.map((line) => (line.id === id ? { ...line, ...changes } : line)),
    })),
  clear: () => set({ lines: [] }),
  reset: () => set({ lines: copyInitial() }),
}));
