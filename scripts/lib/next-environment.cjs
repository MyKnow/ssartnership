// The launcher already resolved exactly one profile. Keep Next's automatic
// NODE_ENV-based dotenv loading from merging .env.production into a Preview
// build, including forced reloads and forked build/dev workers. Environment
// changes require restarting the launcher. Returning no files also prevents
// Next's standalone copier from packaging a local secret file.
// This adapter is covered against the installed @next/env API by process tests.
// Node --require preloads CommonJS before Next and its forked workers import it.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nextEnvironment = require("@next/env");
const descriptors = Object.getOwnPropertyDescriptors(nextEnvironment);
delete descriptors.loadEnvConfig;
const isolatedEnvironment = Object.create(Object.getPrototypeOf(nextEnvironment), descriptors);
Object.defineProperty(isolatedEnvironment, "loadEnvConfig", {
  enumerable: true,
  value: () => {
    // Initialize Next's initialEnv snapshot without providing any dotenv files.
    nextEnvironment.processEnv([]);
    return { combinedEnv: process.env, parsedEnv: undefined, loadedEnvFiles: [] };
  },
});
require.cache[require.resolve("@next/env")].exports = isolatedEnvironment;
