import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  base: './', //add base path
  define: {
    global: 'window',
    'process.env': process.env,
    'process.platform': JSON.stringify(process.platform),
    'process.version': JSON.stringify(process.version),
  },
});
