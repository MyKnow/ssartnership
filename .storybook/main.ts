import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/nextjs-vite";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const nextImageMockPath = path.resolve(dirname, "next-image.mock.tsx");
const nextScriptMockPath = path.resolve(dirname, "next-script.mock.tsx");
const nextThemesMockPath = path.resolve(dirname, "next-themes.mock.tsx");

const config: StorybookConfig = {
  stories: [
    "../src/**/*.stories.@(ts|tsx)",
    "./**/*.stories.@(ts|tsx)",
  ],
  addons: [
    "@storybook/addon-docs",
    "@storybook/addon-a11y",
    "@storybook/addon-vitest",
  ],
  framework: {
    name: "@storybook/nextjs-vite",
    options: {
      nextConfigPath: path.resolve(process.cwd(), "next.config.ts"),
    },
  },
  staticDirs: ["../public"],
  features: {
    experimentalRSC: true,
  },
  viteFinal: async (viteConfig) => {
    const existingAlias = viteConfig.resolve?.alias;
    const nextImageAlias = {
      find: /^next\/image$/,
      replacement: nextImageMockPath,
    };
    const nextScriptAlias = {
      find: /^next\/script$/,
      replacement: nextScriptMockPath,
    };
    const nextThemesAlias = {
      find: /^next-themes$/,
      replacement: nextThemesMockPath,
    };

    return {
      ...viteConfig,
      resolve: {
        ...viteConfig.resolve,
        alias: Array.isArray(existingAlias)
          ? [nextImageAlias, nextScriptAlias, nextThemesAlias, ...existingAlias]
          : {
              ...existingAlias,
              "next/image": nextImageMockPath,
              "next/script": nextScriptMockPath,
              "next-themes": nextThemesMockPath,
            },
      },
      optimizeDeps: {
        ...viteConfig.optimizeDeps,
        include: [
          ...(viteConfig.optimizeDeps?.include?.filter(
            (item) =>
              item !== "next/image" && item !== "next/script" && item !== "next-themes",
          ) ?? []),
          "qrcode",
        ],
        exclude: [
          ...(viteConfig.optimizeDeps?.exclude ?? []),
          "next/image",
          "next/script",
          "next-themes",
        ],
      },
    };
  },
};

export default config;
