import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/nextjs-vite";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const nextImageMockPath = path.resolve(dirname, "next-image.mock.tsx");

const config: StorybookConfig = {
  stories: [
    "../src/**/*.stories.@(ts|tsx)",
    "./**/*.stories.@(ts|tsx)",
  ],
  addons: [
    "@storybook/addon-docs",
    "@storybook/addon-a11y",
    "@storybook/addon-vitest",
    "@chromatic-com/storybook",
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

    return {
      ...viteConfig,
      resolve: {
        ...viteConfig.resolve,
        alias: Array.isArray(existingAlias)
          ? [nextImageAlias, ...existingAlias]
          : {
              ...existingAlias,
              "next/image": nextImageMockPath,
            },
      },
      optimizeDeps: {
        ...viteConfig.optimizeDeps,
        include: viteConfig.optimizeDeps?.include?.filter((item) => item !== "next/image"),
        exclude: [...(viteConfig.optimizeDeps?.exclude ?? []), "next/image"],
      },
    };
  },
};

export default config;
