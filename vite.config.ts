// Vite config for TanStack Start. Plugins, in order:
//   TanStack devtools (dev only, first), Tailwind, tsconfig paths, TanStack Start, nitro (build
//   only, Cloudflare by default), React, VITE_* env defines, @ alias, React/Query dedupe,
//   lightningcss, and dev server on port 8080.
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import {
  defineConfig,
  loadEnv,
  type PluginOption,
  type UserConfig,
} from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig(async ({ command, mode }): Promise<UserConfig> => {
  // Server functions read process.env (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MAPBOX_ACCESS_TOKEN...).
  // Vite only exposes VITE_* to import.meta.env, so load .env into process.env for local dev/build.
  // Real environment variables always win; values this config injected are refreshed on every
  // reload, so editing .env takes effect without killing the dev server.
  const injectedKeys: Set<string> =
    (globalThis as { __p3000InjectedEnv?: Set<string> }).__p3000InjectedEnv ?? new Set<string>();
  const fileEnv = loadEnv(mode, process.cwd(), "");
  for (const [key, value] of Object.entries(fileEnv)) {
    if (process.env[key] === undefined || injectedKeys.has(key)) {
      process.env[key] = value;
      injectedKeys.add(key);
    }
  }
  (globalThis as { __p3000InjectedEnv?: Set<string> }).__p3000InjectedEnv = injectedKeys;

  const plugins: PluginOption[] = [];

  if (mode === "development") {
    const { devtools } = await import("@tanstack/devtools-vite");
    plugins.push(
      devtools({
        logging: false,
        eventBusConfig: { enabled: false },
        enhancedLogs: { enabled: false },
        consolePiping: { enabled: false },
        removeDevtoolsOnBuild: false,
        injectSource: { enabled: true },
      }),
    );
  }

  plugins.push(tailwindcss());
  plugins.push(tsConfigPaths({ projects: ["./tsconfig.json"] }));
  plugins.push(
    tanstackStart({
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/server/**"],
          specifiers: ["server-only"],
        },
      },
      // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
      // nitro/vite builds from this
      server: { entry: "server" },
    }),
  );

  if (command === "build") {
    // Cloudflare Workers output by default. Override with NITRO_PRESET, e.g. NITRO_PRESET=node-server.
    plugins.push(nitro({ defaultPreset: "cloudflare-module" }));
  }

  plugins.push(viteReact());

  const envDefine: Record<string, string> = {};
  for (const [key, value] of Object.entries(
    loadEnv(mode, process.cwd(), "VITE_"),
  )) {
    envDefine[`import.meta.env.${key}`] = JSON.stringify(value);
  }

  return {
    define: envDefine,
    ...(command === "build" && mode === "development"
      ? {
          environments: {
            client: {
              define: { "process.env.NODE_ENV": JSON.stringify("development") },
            },
          },
          // Keep function names readable in `npm run build:dev` output.
          esbuild: { keepNames: true } as NonNullable<UserConfig["esbuild"]>,
        }
      : {}),
    css: { transformer: "lightningcss" },
    resolve: {
      alias: { "@": `${process.cwd()}/src` },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
      ],
      ignoreOutdatedRequests: true,
    },
    server: {
      host: "::",
      port: 8080,
      watch: {
        awaitWriteFinish: { stabilityThreshold: 1000, pollInterval: 100 },
      },
    },
    plugins,
  };
});
