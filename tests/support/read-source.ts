import { readFileSync } from "node:fs";
export const readSource = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
