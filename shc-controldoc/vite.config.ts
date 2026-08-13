import { defineConfig } from "vitest/config";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    // Scope propio '/m/' — distinto del scope raíz '/' que usa el Service Worker de MSW
    // (mocks/browser.ts). Ver openspec/changes/m7-f1-pwa-formulario-mobile/design.md D3:
    // un documento solo puede tener un SW controlador a la vez, elegido por el scope más
    // específico — confirmado empíricamente (2026-08-04) que el SW de la PWA (scope '/m/')
    // gana el control sobre cualquier navegación dura a '/m/*', incluso con MSW activo, y
    // como ningún SW puede delegar un fetch a otro, ninguna runtime-caching route en
    // `src/sw.ts` puede revertir eso. Mitigación implementada (ver `injectRegister: null`
    // abajo y el registro condicional en `main.tsx`): el SW de la PWA nunca se registra
    // mientras `VITE_ENABLE_MSW=true`, dejando a MSW como único controlador posible.
    //
    // Estrategia `injectManifest` (en vez de `generateSW`, usado en Fase 1) con fuente
    // propia `src/sw.ts`: necesaria desde m7-f2-offline-sync (design.md D7) para poder
    // registrar el listener `sync` (Background Sync API) del SW — `generateSW` no permite
    // añadir listeners de eventos personalizados al Service Worker autogenerado.
    VitePWA({
      registerType: "autoUpdate",
      // `null` en vez de `"auto"`: el registro se dispara a mano desde `main.tsx`,
      // condicionado a `VITE_ENABLE_MSW !== 'true'` (ver comentario arriba).
      injectRegister: null,
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      scope: "/m/",
      includeAssets: ["favicon.svg"],
      manifest: {
        id: "/m/incidentes/nuevo",
        name: "SHAC — Reporte Rápido de Incidencias",
        short_name: "SHAC Reporte",
        description: "Reporte rápido de incidentes SyST desde campo — SHAC",
        start_url: "/m/incidentes/nuevo",
        scope: "/m/",
        display: "standalone",
        background_color: "#faf9f5",
        theme_color: "#cc785c",
        icons: [
          {
            src: "/favicon.svg",
            sizes: "192x192",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "/favicon.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
      },
      injectManifest: {
        // Solo assets del shell mobile — nunca `/api/**` (interceptado por MSW) ni el resto
        // de la app de escritorio, que no debe quedar controlada por este SW. `src/sw.ts` no
        // define ningún runtime-caching de `/api/**` (heredado de Fase 1, D4).
        globPatterns: ["**/*.{js,css,html,svg,png}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
      },
      devOptions: {
        enabled: true,
        type: "module",
      },
    }),
  ],
  css: {
    postcss: {
      plugins: [tailwindcss(), autoprefixer()],
    },
  },
  optimizeDeps: {
    include: ["lucide-react"],
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
  },
});
