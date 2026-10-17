import "server-only";
import { getAdminAccountByIdUncached } from "@/lib/admin-accounts";
import { partnerRepository } from "@/lib/repositories";
import { projectShowcaseRepository } from "@/lib/project-showcase";
import { createMcpReadService } from "./read-service";

/** Internal only. The HTTP transport verifies tokens before passing a trusted principal. */
export const mcpReadService = createMcpReadService({
  getAdminAccount: getAdminAccountByIdUncached,
  partners: partnerRepository,
  showcase: projectShowcaseRepository,
});
