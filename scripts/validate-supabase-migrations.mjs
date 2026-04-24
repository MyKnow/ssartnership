import { readdir } from "node:fs/promises";

const migrationDir = new URL("../supabase/migrations/", import.meta.url);
const migrationFilePattern = /^(?<version>\d+)_[a-z0-9][a-z0-9_]*\.sql$/;

const files = (await readdir(migrationDir))
  .filter((file) => file.endsWith(".sql"))
  .sort();

const invalidFiles = [];
const versions = new Map();

for (const file of files) {
  const match = migrationFilePattern.exec(file);
  if (!match?.groups?.version) {
    invalidFiles.push(file);
    continue;
  }

  const versionFiles = versions.get(match.groups.version) ?? [];
  versions.set(match.groups.version, [...versionFiles, file]);
}

const duplicateVersions = Array.from(versions.entries()).filter(
  ([, versionFiles]) => versionFiles.length > 1,
);

if (invalidFiles.length > 0 || duplicateVersions.length > 0) {
  if (invalidFiles.length > 0) {
    console.error("Invalid Supabase migration filenames:");
    for (const file of invalidFiles) {
      console.error(`- ${file}`);
    }
    console.error('Expected pattern: "<timestamp>_name.sql"');
  }

  if (duplicateVersions.length > 0) {
    console.error("Duplicate Supabase migration timestamps:");
    for (const [version, versionFiles] of duplicateVersions) {
      console.error(`- ${version}: ${versionFiles.join(", ")}`);
    }
  }

  process.exit(1);
}

console.log(`Validated ${files.length} Supabase migration files.`);
