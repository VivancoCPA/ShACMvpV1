import { expect, vi } from 'vitest'
import * as matchers from '@testing-library/jest-dom/matchers'
import 'fake-indexeddb/auto'
expect.extend(matchers)

// jsdom doesn't implement matchMedia; uiStore reads it at module-load time to
// resolve the 'system' theme, which throws for any test that imports AppShell.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

// jsdom doesn't implement ResizeObserver; recharts' ResponsiveContainer reads
// it to size charts, which throws for any test that renders a recharts component.
if (typeof window !== 'undefined' && !window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// jsdom doesn't implement the Clipboard API; UserList's "Copiar" button
// reads it, and tests need a real object with a `writeText` method present
// before they can `vi.spyOn(navigator.clipboard, 'writeText')`.
if (typeof navigator !== 'undefined' && !navigator.clipboard) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn() },
    configurable: true,
  })
}

// Node's global URL.createObjectURL (present in the Vitest/Node runtime,
// unlike a real jsdom-only environment) rejects jsdom's Blob/File instances
// with "must be an instance of Blob" — cross-realm `instanceof` fails even
// though the object is a real Blob. Both the photo preview flow
// (mobile/escritorio) and buildEvidenciasFromBlobs (offline sync) call it
// directly on File/Blob objects, so it's overridden unconditionally with a
// jsdom-safe stub rather than only filling a gap.
if (typeof URL !== 'undefined') {
  URL.createObjectURL = vi.fn(() => 'blob:mock-url')
  URL.revokeObjectURL = vi.fn()
}
