import { defineConfig } from 'vitest/config';

// Every page is an entry. The service worker keeps a fixed name because the
// manifest points at it; it has no document, so no modulepreload polyfill.
export default defineConfig({
  test: { include: ['test.js', 'notes/**/*.test.ts'] },
  build: {
    modulePreload: { polyfill: false },
    // lightningcss rejects valid ::picker(select):popover-open; the CSS is small anyway.
    cssMinify: false,
    // The editor chunk (Tiptap + ProseMirror) is ~570 kB; it loads only when a note opens.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: {
        palette: 'palette.html',
        options: 'options.html',
        sidepanel: 'sidepanel.html',
        background: 'background.js',
      },
      output: {
        entryFileNames: (chunk) => (chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js'),
      },
    },
  },
});
