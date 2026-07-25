import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/// <reference types="vitest" />

export default defineConfig({
  plugins: [
  react({
  // Use automatic runtime to support the /* @jsxImportSource react */ comments
  // or to handle JSX without manual React imports.
  jsxRuntime: "automatic",
  }),
  tailwindcss(),
  ],
  server: {
    port: 3000,
    open: false,
    host: true,
    allowedHosts: ["app.docker"],
    // Proxy /api and /uploads to the Go backend running inside Docker.
    // With same-origin proxy, cookies (refreshToken HttpOnly) work without
    // SameSite=None and without HTTPS — the browser sees everything on :3000.
    proxy: {
      "/api": {
        target: process.env.BACKEND_PROXY_TARGET || "http://127.0.0.1:8082",
        changeOrigin: true,
        proxyTimeout: 0,
        timeout: 0,
        configure: (proxy) => {
          // Disable socket-level timeouts for SSE (long-lived streaming connections).
          proxy.on("proxyRes", (_proxyRes, req, res) => {
            if (req.url?.includes("/events")) {
              res.socket?.setTimeout(0);
            }
          });
        },
      },
      "/uploads": {
        target: process.env.BACKEND_PROXY_TARGET || "http://127.0.0.1:8082",
        changeOrigin: true,
      },
      "/public": {
        target: process.env.BACKEND_PROXY_TARGET || "http://127.0.0.1:8082",
        changeOrigin: true,
      },
    },
    // Polling necessário para HMR funcionar com Docker volumes no Windows.
    // awaitWriteFinish + stabilityThreshold evitam crash EIO quando o volume
    // WSL2 fica momentaneamente inacessível (errno -5).
    watch: {
      usePolling: true,
      // Polling em bind mount do Docker no Windows custa CPU por arquivo a cada
      // ciclo. 300ms saturava ~1 core; 1000ms reduz drasticamente o CPU com HMR
      // ainda responsivo (~1s para detectar a mudança).
      interval: 1000,
      binaryInterval: 2000,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100,
      },
      ignored: [
        "**/node_modules/**",
        "**/.git/**",
        "**/build/**",
        "**/dist/**",
      ],
    },
  },
  build: {
    outDir: "build",
    sourcemap: true,
    rollupOptions: {
      // No manualChunks: the previous hand-rolled strategy isolated React into
      // its own chunk while React Router / Radix (which call React.createContext
      // at module top-level) landed in `vendor`, creating a circular chunk init
      // where React was `undefined` in vendor → blank screen in the embedded
      // prod build. Rollup's automatic chunking is cycle-free. A cycle-free
      // manual strategy can be reintroduced later for cache tuning.
      output: {},
    },
  },
  envPrefix: "VITE_",
  esbuild: {
    loader: "tsx",
    include: /src\/.*\.[jt]sx?$/,
    exclude: [],
  },
  define: {
    global: "globalThis",
    "process.env.npm_package_version": JSON.stringify(
      process.env.npm_package_version
    ),
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        ".js": "jsx",
      },
    },
    include: [
      "mic-recorder-to-mp3",
    ],
    exclude: [],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
  },
});
