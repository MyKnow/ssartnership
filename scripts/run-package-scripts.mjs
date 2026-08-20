#!/usr/bin/env node

import {
  requireSuccessfulResult,
  runPackageScript,
} from "./lib/package-manager.mjs";

const scripts = process.argv.slice(2);
if (scripts.length === 0) {
  process.stderr.write("실행할 package script 이름을 하나 이상 지정하세요.\n");
  process.exit(1);
}

for (const script of scripts) {
  const result = runPackageScript(script);
  requireSuccessfulResult(result, `npm run ${script}`);
}
