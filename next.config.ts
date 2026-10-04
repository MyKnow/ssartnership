import type { NextConfig } from "next";
import type { RemotePattern } from "next/dist/shared/lib/image-config";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AtomicDevelopmentManifestsPlugin, shouldUseAtomicManifests } from "./scripts/webpack-atomic-manifests.mjs";
import { fixtureBuildProfile, assertNoFixtureDotenv, configureFixtureCompiler, FIXTURE_HEADER, FIXTURE_BUILD_MARKER } from "./scripts/webpack-fixture-boundary.mjs";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const securityHeaders = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self';",
  },
];

function buildSupabaseRemotePattern(): RemotePattern | null {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  if (!rawUrl) {
    return null;
  }

  try {
    const parsed = new URL(rawUrl);
    return {
      protocol: parsed.protocol.replace(":", "") as "http" | "https",
      hostname: parsed.hostname,
      pathname: "/storage/v1/object/public/**",
    };
  } catch {
    return null;
  }
}

const supabaseRemotePattern = buildSupabaseRemotePattern();
// SELF_HOST_BUILD=1 is set only for the deployable image build (the CI gate
// and the root Dockerfile). Local `next dev`/`next start` and the E2E fixture
// build keep Next's default server output.
const selfHostBuild = process.env.SELF_HOST_BUILD === "1";

// Uploads are stored under per-upload Storage paths (uploadId), so optimized
// variants can live for a month on the persistent `.next/cache` volume.
// Replacing a file under `public/` at the same path, or an external image the
// /api/image proxy relays changing at the same URL, needs a new name or a
// manual purge of `.next/cache/images` (see the self-hosting runbook).
const IMAGE_MINIMUM_CACHE_TTL_SECONDS = 31 * 24 * 60 * 60;
// The largest stored source is 2100px wide (promotion slides), so the 3840px
// default only re-encodes the same pixels. Small widths cover the 96-448px
// card, thumbnail and avatar slots at 1x-3x density.
const IMAGE_DEVICE_SIZES = [640, 750, 828, 1080, 1200, 1920, 2048];
const IMAGE_SIZES = [64, 96, 128, 256, 384];
const fixtureBuild = fixtureBuildProfile(process.env);
if (fixtureBuild) {
  assertNoFixtureDotenv(projectRoot);
  securityHeaders.push({ key: FIXTURE_HEADER, value: FIXTURE_BUILD_MARKER });
}

if (process.env.NODE_ENV === "production") {
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  });
}

const nextConfig: NextConfig = {
  // The deployable image runs Next's portable standalone server.
  output: selfHostBuild ? "standalone" : undefined,
  // In the deployed image the edge Caddy already encodes responses with
  // zstd/gzip, so the single app process skips a second gzip pass. Direct
  // loopback consumers (receiver health, cron, telemetry) need no compression.
  compress: !selfHostBuild,
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // The mobile search island occupies the framework indicator's default
  // bottom-left position. Keep local QA aligned with the shipped navigation.
  devIndicators: false,
  // Public Readiness runs the project-pinned semantic TypeScript check before
  // build. Next 16's embedded worker has crashed independently, so keep the
  // verified standalone check as the single required type gate.
  typescript: {
    ignoreBuildErrors: true,
  },
  outputFileTracingIncludes: {
    "/*": ["node_modules/@discourse/heic/**/*"],
  },
  reactCompiler: true,
  experimental: {
    // Bound the additional test build inside the unchanged 5 GiB Mac gate.
    ...(fixtureBuild ? { cpus: 2 } : {}),
    // Icon packages are not listed in optimizePackageImports: Next already
    // optimizes the heroicons, lucide-react and react-icons entry points this
    // app imports by default.
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  turbopack: {
    root: projectRoot,
  },
  webpack(config, { dev }) {
    configureFixtureCompiler(config, { dev, root: projectRoot, enabled: fixtureBuild });
    if (shouldUseAtomicManifests(dev)) {
      config.plugins.push(new AtomicDevelopmentManifestsPlugin(
        resolve(projectRoot, process.env.NEXT_DIST_DIR ?? ".next", "dev"),
      ));
    }
    // @discourse/heic's Emscripten loader fetches this file itself. Treating it
    // as a native WebAssembly module makes Webpack try to resolve its internal
    // Emscripten import names (for example, "a") as npm packages.
    config.module.rules.push({
      test: /@discourse[\\/]heic[\\/]codec[\\/]dec[\\/]heic_dec\.wasm$/,
      type: "asset/resource",
    });
    return config;
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: IMAGE_MINIMUM_CACHE_TTL_SECONDS,
    deviceSizes: IMAGE_DEVICE_SIZES,
    imageSizes: IMAGE_SIZES,
    remotePatterns: supabaseRemotePattern ? [supabaseRemotePattern] : undefined,
    localPatterns: [
      {
        pathname: "/api/image",
      },
      {
        pathname: "/mock/partners/**",
      },
      {
        pathname: "/install-guides/**",
      },
      {
        pathname: "/ads/project-showcase-banner.png",
      },
      {
        pathname: "/ads/project-showcase.png",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
