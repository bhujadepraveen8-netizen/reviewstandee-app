import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(
        process.env.VITE_SUPABASE_URL || 'https://qhrldsajznwslrzdbkcx.supabase.co'
      ),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(
        process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_6hCtpw5-UoNXfopf8TLLLg_8pUJbdWX'
      ),
      'import.meta.env.VITE_APP_URL': JSON.stringify(
        process.env.APP_URL || 'https://ais-dev-pjn3b6xprb4ixpuejbmm76-976431152729.asia-east1.run.app'
      ),
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
