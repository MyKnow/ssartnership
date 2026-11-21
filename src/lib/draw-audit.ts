import { createHash } from "node:crypto";

/**
 * Shared audit contract for the two prize draws (event reward tickets and the
 * project showcase). Both record the same summary so an operator can later
 * check what the draw saw:
 *
 * - `algorithm`: which sampling procedure ran.
 * - `seedSource`: `admin` (seed typed by an admin, reproducible), `generated`
 *   (random seed stored with the draw, reproducible), or `csprng` (per-pick
 *   CSPRNG, intentionally not reproducible).
 * - `candidateSnapshotSha256`: SHA-256 over the ordered eligible entries
 *   (`id:weight` per line). Ids are opaque member/project ids, never names, and
 *   the order is part of the input because the samplers walk the list in order.
 */
export const DRAW_AUDIT_CONTRACT_VERSION = 1;

export type DrawSeedSource = "admin" | "generated" | "csprng";

export type DrawCandidateSnapshotEntry = {
  id: string;
  weight: number;
};

export type DrawAuditSummary = {
  contractVersion: number;
  algorithm: string;
  seedSource: DrawSeedSource;
  candidateCount: number;
  ticketCount: number;
  candidateSnapshotSha256: string;
};

export function buildDrawCandidateSnapshotSha256(
  entries: readonly DrawCandidateSnapshotEntry[],
) {
  const hash = createHash("sha256");
  for (const entry of entries) {
    hash.update(`${entry.id}:${entry.weight}\n`);
  }
  return hash.digest("hex");
}

export function buildDrawAuditSummary(input: {
  algorithm: string;
  seedSource: DrawSeedSource;
  entries: readonly DrawCandidateSnapshotEntry[];
  candidateCount?: number;
}): DrawAuditSummary {
  return {
    contractVersion: DRAW_AUDIT_CONTRACT_VERSION,
    algorithm: input.algorithm,
    seedSource: input.seedSource,
    candidateCount: input.candidateCount ?? input.entries.length,
    ticketCount: input.entries.reduce((total, entry) => total + entry.weight, 0),
    candidateSnapshotSha256: buildDrawCandidateSnapshotSha256(input.entries),
  };
}

/** Admin audit log properties; identical keys for every draw system. */
export function toDrawAuditLogProperties(summary: DrawAuditSummary) {
  return {
    draw_audit_version: summary.contractVersion,
    draw_algorithm: summary.algorithm,
    seed_source: summary.seedSource,
    candidate_count: summary.candidateCount,
    ticket_count: summary.ticketCount,
    candidate_snapshot_sha256: summary.candidateSnapshotSha256,
  };
}
