import { dirname, join, delimiter } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const projectNodeModules = join(projectRoot, "node_modules");

process.env.NODE_PATH = [
  projectNodeModules,
  process.env.NODE_PATH,
].filter(Boolean).join(delimiter);

const config = {
  plugins: {
    "@tailwindcss/postcss": {
      base: projectRoot,
    },
  },
};

export default config;
