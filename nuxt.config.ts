import tailwindcss from "@tailwindcss/vite";
import viteCompression from 'vite-plugin-compression';
import { visualizer } from 'rollup-plugin-visualizer';
import zlib from 'zlib';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const r = (...segments: string[]) => resolve(fileURLToPath(new URL('.', import.meta.url)), ...segments);
const terserNameCachePath = r('./.cache/terser-namecache.json');
const terserNameCache = fs.existsSync(terserNameCachePath)
  ? JSON.parse(fs.readFileSync(terserNameCachePath, 'utf-8'))
  : {};

const persistTerserNameCachePlugin = {
  name: 'persist-terser-namecache',
  closeBundle() {
    fs.mkdirSync(dirname(terserNameCachePath), { recursive: true });
    fs.writeFileSync(terserNameCachePath, JSON.stringify(terserNameCache), 'utf-8');
  },
};

// Extract package name from a node_modules id. Keeps scoped names intact.
function getPkgName(id: string) {
  const m = id.match(/node_modules\/((?:@[^/]+\/)?[^/]+)\/./);
  if (m && m[1]) return m[1].replace('/', '-');
  // fallback: try another pattern
  const m2 = id.match(/node_modules\/(.+?)\//);
  return m2 ? m2[1].replace(/[\/]/g, '-').replace(/^@/, '') : null;
}

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2024-11-01",
  devtools: { enabled: true },
  ssr: false,
  css: ["~/assets/css/main.css"],
  hooks: {
    // In client bundle, stub heavy server-only battle hooks to keep bundle lean
    'vite:extendConfig': (config, { isClient }) => {
      if (!isClient) return;
      config.resolve = config.resolve || {};
      const alias = (config.resolve.alias ??= {});
      if (Array.isArray(alias)) {
        alias.push({ find: '~/server/utils/game/battleAction', replacement: r('./shared/stubs/battleAction.client.ts') });
        alias.push({ find: '~/server/data/allEquipmentTriggerData', replacement: r('./shared/stubs/allEquipmentTriggerData.client.ts') });
      } else {
        const aliasObj = alias as Record<string, string>;
        aliasObj['~/server/utils/game/battleAction'] = r('./shared/stubs/battleAction.client.ts');
        aliasObj['~/server/data/allEquipmentTriggerData'] = r('./shared/stubs/allEquipmentTriggerData.client.ts');
      }
      // Ensure visualizer runs only for client build so we get client bundle breakdown
      config.plugins = config.plugins || [];
      // if (process.env.ANALYZE) {
        config.plugins.push(
          visualizer({
            filename: 'dist/bundle-stats-client.html',
            template: 'treemap',
            gzipSize: true,
            brotliSize: true,
            open: false,
          })
        );
      // }
    },
  },
  vite: {
    plugins: [
      tailwindcss(),
      // Only generate gzip pre-compressed assets for now. Brotli can be
      // enabled later if the server supports it.
      // Install: `npm i -D vite-plugin-compression`
      viteCompression({
        algorithm: 'gzip',
        ext: '.gz',
        threshold: 1024, // only compress files larger than 1KB
        // Use content-based hashes in filenames so unchanged modules keep the same filename
        // entryFileNames: 'assets/js/[name]-[hash].js',
        // chunkFileNames: 'assets/js/[name]-[hash].js',
        // assetFileNames: 'assets/[name]-[hash][extname]',
        // Separate generated asset helper modules (that statically import icons)
        // into their own chunk so they can be loaded on-demand.
        // if (id.includes('/utils/assetsResource') || id.includes('/utils/avatar') || id.includes('/utils/iconLoader') || id.includes('/assets/')) {
      }),
      // Also emit Brotli (`.br`) alongside gzip when building for production.
      // Many browsers prefer Brotli and CDNs will serve the best available.
      viteCompression({
        algorithm: 'brotliCompress',
        ext: '.br',
        threshold: 1024,
        compressionOptions: { params: { [zlib.constants?.BROTLI_PARAM_QUALITY ?? 11]: 11 } as any },
        deleteOriginFile: false,
      }),
      persistTerserNameCachePlugin,
    ],
    resolve: {
      alias: {
        // Mobile shim: swap Element Plus Notification -> Message to avoid blocking UI on small screens
        'element-plus/es/components/notification': r('./utils/element-plus-notification-shim.ts'),
        'element-plus/es/components/notification/index': r('./utils/element-plus-notification-shim.ts'),
        'element-plus/lib/components/notification': r('./utils/element-plus-notification-shim.ts'),
        'element-plus/lib/components/notification/index': r('./utils/element-plus-notification-shim.ts'),
      },
    },
    build: {
      // disable sourcemap for production builds to avoid exposing sources
      sourcemap: false,
      // use terser for better control over mangling/minify
      minify: 'terser',
      terserOptions: {
        nameCache: terserNameCache,
        compress: {
          drop_console: true,
          passes: 2,
        },
        mangle: true,
        format: { comments: false },
      },
      cssMinify: "lightningcss",
      assetsInlineLimit: 512,
      rollupOptions: {
        output: {
          // Stable chunk names: keep manual chunk names in filenames and use content hash for cache-busting
          // Keep files at top-level under _nuxt so server paths stay aligned
          entryFileNames: '[name]-[hash].js',
          chunkFileNames: '[name]-[hash].js',
          // Static assets still go under assets/{ext}
          assetFileNames: 'assets/[ext]/[name]-[hash][extname]',
          manualChunks(id) {
            // Separate generated asset helper modules (that statically import icons)
                // avoid logging during build (non-deterministic and noisy)
            // }
            // Large game data bundles: split shared/data into a dedicated chunk
            // so the browser can fetch it separately and we can lazy-load if needed.
            if (id.includes('node_modules')) {
              const pkg = getPkgName(id) || 'vendor';

              const part1VendorList = [
                "vuedraggable",
                "cropperjs",
              ];
              for (const part1Pkg of part1VendorList) {
                if (pkg.includes(part1Pkg)) {
                  return 'vendor-part';
                }
              }

              // Keep a few hand-picked aggregated names for very large/important libs
              if (pkg.includes('element-plus')) return 'vendor-elementplus';
              if (pkg.includes('fingerprintjs')) return 'vendor-fingerprintjs';
              if (pkg.includes('pako')) return 'vendor-pako';
              if (pkg.includes('lodash-es')) return 'vendor-lodash';
              if (pkg.includes('sortable')) return 'vendor-sortable';
              if (pkg.includes('iconify')) return 'vendor-iconify';
              if (pkg.includes('nuxt')) return 'vendor-nuxt';
              if (pkg.includes('nuxt')) return 'vendor-nuxt';
              if (pkg.includes('dayjs')) return 'vendor-dayjs';
              if (pkg.includes('echarts') || pkg.includes('vue-echarts')) return 'vendor-charts';
              if (pkg.includes('xlsx')) return 'vendor-xlsx';
              if (pkg.includes('@vue')) return 'vendor-vue';
              if (pkg.includes('pdfjs-dist')) return 'vendor-pdf';
              if (pkg.includes('elkjs')) return 'vendor-graph';
              if (pkg.includes('gsap')) return 'vendor-gsap';
              if (pkg.includes('@tailwindcss') || pkg.includes('tailwindcss')) return 'vendor-tailwind';
              // utilities: keep small libs grouped by their package name rather than lumping all into one chunk
              return `vendor-misc`;
            }


            let importResourceJsonMap: Record<string, string> = {
              'assets/resource/allGameResource.json': 'game-json-resources',
              'assets/resource/allGameActions.json': 'game-json-actions',
              'assets/resource/enhanceInfo.json': 'game-json-enhance',
            }
            for (const resId of Object.keys(importResourceJsonMap)) {
              if (id.includes(`${resId}`)) {
                return importResourceJsonMap[resId as keyof typeof importResourceJsonMap];
              }
            }

            // Default: let Rollup decide (do not forcibly coalesce all .vue files into one chunk)
            const importResourceMap: Record<string, string> = {
              'shared/data/allGameActions.ts': 'game-action',
              'shared/data/allGameResources.ts': 'game-resources',
              'shared/data/allGameBattleSkill.ts': 'game-battle-skill',
              'shared/data/allBattleState.ts': 'game-battle-state',
            }
            for (const resId of Object.keys(importResourceMap)) {
              if (id.includes(`${resId}`)) {
                return importResourceMap[resId as keyof typeof importResourceMap];
              }
            }

            if (id.includes('/assets/resource')) {
              return 'game-jresource';
            }


            // if (id.includes('/components') && id.includes('.vue')) {
            //   return 'components';
            // }

            // if (!id.includes('.png') && !id.includes('node_modules')) {
            //   console.log(id);
            // }
            // if (id.includes('/shared/data') || id.includes('/shared/data/')) {
            //   return 'game-data';
            // }
            // You can further split large feature areas here by path patterns
            // e.g. if (id.includes('/components/game/')) return 'feature-game'
            return undefined;
          }
        }
      }
      // sourcemap: false
    },
  },
  plugins: [
    {
      src: "@/plugins/baidu.js",
      mode: 'client'
    },
    {
      src: "@/plugins/gt.js",
      mode: 'client'
    }
  ],
  modules: ["@element-plus/nuxt", "nuxt-scheduler", "nuxt-auth-utils", "@nuxt/icon", "@nuxtjs/device", 'dayjs-nuxt', '@vueuse/nuxt'],
  dayjs: {
    locales: ['zh-cn'],
    plugins: ['weekOfYear', 'isoWeek', 'timezone'],
    defaultLocale: 'zh-cn',
  },
  // @ts-ignore
  elementPlus: {
    defaultLocale: "zh-cn",
    /** Options */ 
  },
  app: {
    head: {
      title: '🐱🐟猫猫放置',
      // update Nuxt defaults
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=0',
      link: [
        { rel: 'icon', href: '/favicon.ico' } // 你的 favicon 路径
      ]
    },
  },
  vue: {
    config: {
      // @ts-ignore
      warnHandler: (msg, instance, trace) =>
        ![
          "built-in or reserved HTML elements as component id: component",
          '"class" is a reserved attribute and cannot be used as component prop',
          "Cannot find element: #__nuxt",
        ].some((warning) => msg.includes(warning)) &&
        console.warn("[Vue warn]: ".concat(msg).concat(trace)),
    },
  },
  nitro: {
    esbuild: {
      options: {
        target: "esnext",
      },
    },
    // Serve built client assets from /_nuxt to avoid 404 in node-server preset
    publicAssets: [
      {
        dir: r('./.nuxt/dist/client'),
        baseURL: '/_nuxt/',
        maxAge: 60 * 60 * 24 * 365,
      },
      // Provide a mirror path for static files when CSS rebases URLs relative to /_nuxt/
      // so requests to /_nuxt/static/... resolve correctly in production.
      {
        dir: r('./public/static'),
        baseURL: '/_nuxt/static/',
        maxAge: 60 * 60 * 24 * 365,
      },
    ],
    experimental: {
      websocket: true,
    },
  },
  runtimeConfig: {
    MYSQL_PATH: process.env.MYSQL_PATH,
    MYSQL_PATH_REPLICA: process.env.MYSQL_PATH_REPLICA,
    REDIS_URL: process.env.REDIS_URL,
    session: {
      // @ts-ignore
      password: process.env.NUXT_SESSION_PASSWORD,
      // 明确 cookie 属性，避免 SameSite/secure 在不同部署环境下产生差异
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      }
    }
  },
});
// 写一段用于算命的提示词