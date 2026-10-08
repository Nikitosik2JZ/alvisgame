import legacy from '@vitejs/plugin-legacy';
export default {
  base: './',
  plugins: [legacy({ targets: ['Chrome >= 49', 'Firefox >= 52', 'Safari >= 9', 'iOS >= 9'], modernPolyfills: true })],
  build: { sourcemap: false },
};
