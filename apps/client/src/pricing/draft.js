import { create } from 'zustand';
export const useDraftBill = create((set) => ({
  merchantId: null,
  clientBillId: undefined,
  lines: [],
  open: (merchantId) =>
    set((state) =>
      state.merchantId === merchantId
        ? state
        : { merchantId, lines: [], clientBillId: crypto.randomUUID() },
    ),
  update: (transform) => set((state) => ({ lines: transform(state.lines) })),
  newBill: () => set({ lines: [], clientBillId: crypto.randomUUID() }),
  clear: () => set({ merchantId: null, lines: [], clientBillId: undefined }),
}));
