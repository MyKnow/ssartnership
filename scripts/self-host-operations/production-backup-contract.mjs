const UUID = "[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}";
const HASH = "[a-f0-9]{64}";
const fail = () => { throw new Error("PRODUCTION_BACKUP_CONTRACT_INVALID"); };
export function backupApplicationIdentity(container, image) {
  const sourceSha = image?.Config?.Labels?.["org.opencontainers.image.revision"];
  if (container?.State?.Running !== true || !/^sha256:[a-f0-9]{64}$/u.test(image?.Id ?? "")
    || container.Image !== image.Id || typeof sourceSha !== "string" || !/^[a-f0-9]{40}$/u.test(sourceSha)) fail();
  return { sourceSha, image: image.Id };
}
export function parseBackupCommand(value) {
  if (value === "list") return { command: "list" };
  if (typeof value !== "string" || /[\r\n\0]/u.test(value)) fail();
  const get = value.match(new RegExp(`^get (${UUID})$`, "u"));
  if (get) return { command: "get", id: get[1] };
  const ack = value.match(new RegExp(`^ack (${UUID}) (${HASH})$`, "u"));
  if (ack) return { command: "ack", id: ack[1], sha256: ack[2] };
  return fail();
}
export function validateBackupReceipt(value) {
  if (!value || Object.keys(value).sort().join() !== "bytes,continuousPitr,createdAt,databaseSystemId,id,recipient,sha256,version"
    || value.version !== 1 || !new RegExp(`^${UUID}$`, "u").test(value.id ?? "")
    || !new RegExp(`^${HASH}$`, "u").test(value.sha256 ?? "")
    || !/^age1[023456789acdefghjklmnpqrstuvwxyz]{58}$/u.test(value.recipient ?? "")
    || !Number.isSafeInteger(value.bytes) || value.bytes < 1024 || value.bytes > 20 * 1024 ** 3
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value.createdAt ?? "")
    || !Number.isFinite(Date.parse(value.createdAt)) || new Date(value.createdAt).toISOString() !== value.createdAt
    || !/^[1-9][0-9]{0,19}$/u.test(value.databaseSystemId ?? "") || value.continuousPitr !== false) fail();
  return value;
}
export function selectBackupRetention(receipts, keep) {
  if (!Number.isSafeInteger(keep) || keep < 1 || keep > 365) fail();
  const sorted = receipts.map(validateBackupReceipt).toSorted((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  if (new Set(sorted.map(x => x.id)).size !== sorted.length) fail();
  return sorted.slice(0, Math.max(0, sorted.length - keep)).map(x => x.id);
}
