import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { host: '0.0.0.0' },
  build: {
    target: ['edge90', 'chrome90', 'firefox90', 'safari15']
  }
})
