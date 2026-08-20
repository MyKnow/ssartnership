import { registerHooks } from "node:module";

import { resolve } from "./alias-loader.mjs";

registerHooks({ resolve });
