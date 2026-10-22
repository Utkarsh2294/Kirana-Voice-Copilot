import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(cleanup);

if (typeof window !== 'undefined') {
  window.PointerEvent ??= MouseEvent;
  // JSDOM has no canvas renderer; axe's optional font probe must see that explicitly.
  HTMLCanvasElement.prototype.getContext = () => null;
  window.matchMedia ??= (query) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  });
  window.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
