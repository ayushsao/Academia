import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv, type Plugin } from 'vite';

// Anything prefixed VITE_ can end up in the public bundle. Values that look like
// secrets must never be shipped; these few are designed to be public.
const PUBLIC_ENV_KEYS = new Set(['VITE_EMAILJS_PUBLIC_KEY', 'VITE_GOOGLE_CLIENT_ID']);
const SECRET_NAME = /KEY|SECRET|TOKEN|PASSWORD|PRIVATE/i;

function forbidSecretsInBundle(env: Record<string, string>): Plugin {
  const secrets = Object.entries(env)
    .filter(([k, v]) => k.startsWith('VITE_') && SECRET_NAME.test(k) && !PUBLIC_ENV_KEYS.has(k) && v && v.length >= 8);
  return {
    name: 'forbid-secrets-in-bundle',
    apply: 'build',
    generateBundle(_opts, bundle) {
      for (const file of Object.values(bundle)) {
        const code = file.type === 'chunk' ? file.code : typeof file.source === 'string' ? file.source : '';
        const leaked = secrets.filter(([, v]) => code.includes(v)).map(([k]) => k);
        if (leaked.length) this.error(`Refusing to build: ${leaked.join(', ')} would be shipped to browsers in ${file.fileName}. Keep secrets server-side (without the VITE_ prefix).`);
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [react(), tailwindcss(), forbidSecretsInBundle(env)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true
        }
      }
    },
  };
});
