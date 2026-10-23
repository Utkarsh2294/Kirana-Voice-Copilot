import { create } from 'zustand';
export const useDraftBill = create((set) => ({
  merchantId: null,
  lines: [],
  open: (merchantId) =>
    set((state) => (state.merchantId === merchantId ? state : { merchantId, lines: [] })),
  update: (transform) => set((state) => ({ lines: transform(state.lines) })),
  clear: () => set({ merchantId: null, lines: [] }),
}));
