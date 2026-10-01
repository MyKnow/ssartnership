import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

const SHOWCASE_PROJECT_BUCKET = "showcase-projects";
const PAGE_SIZE = 100;

/** Remove only image objects inside the deleted project's dedicated directory. */
export async function removeShowcaseProjectImages(projectId: string) {
  if (!isUuid(projectId)) throw new Error("invalid_project_id");
  const client = getSupabaseAdminClient();
  const directory = `project-showcase/${projectId}`;
  let offset = 0;
  const paths: string[] = [];

  while (true) {
    const { data, error } = await client.storage
      .from(SHOWCASE_PROJECT_BUCKET)
      .list(directory, { limit: PAGE_SIZE, offset });
    if (error) throw new Error("project_image_list_failed");
    const entries = data ?? [];
    for (const entry of entries) {
      if (/^[0-9a-f-]{36}\.webp$/iu.test(entry.name)) {
        paths.push(`${directory}/${entry.name}`);
      }
    }
    if (entries.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  for (let start = 0; start < paths.length; start += PAGE_SIZE) {
    const { error } = await client.storage
      .from(SHOWCASE_PROJECT_BUCKET)
      .remove(paths.slice(start, start + PAGE_SIZE));
    if (error) throw new Error("project_image_remove_failed");
  }
}
