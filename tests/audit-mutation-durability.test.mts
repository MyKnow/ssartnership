import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const auditContextModulePromise = import(
  new URL("../src/lib/audit-rpc-context.ts", import.meta.url).href,
);
const mediaCleanupModulePromise = import(
  new URL("../src/lib/partner-change-requests/media-cleanup.ts", import.meta.url).href,
);

const schemaSql = readFileSync(
  new URL("../supabase/schema.sql", import.meta.url),
  "utf8",
);
const migrationSql = readFileSync(
  new URL(
    "../supabase/migrations/20260715023311_add_atomic_audit_mutations.sql",
    import.meta.url,
  ),
  "utf8",
);
const reviewCommandSource = readFileSync(
  new URL("../src/lib/partner-change-requests/commands/review.ts", import.meta.url),
  "utf8",
);
const immediateUpdateSource = readFileSync(
  new URL("../src/lib/partner-change-requests/immediate.ts", import.meta.url),
  "utf8",
);
const reviewActionSource = readFileSync(
  new URL(
    "../src/app/admin/(protected)/_actions/partner-actions/review.ts",
    import.meta.url,
  ),
  "utf8",
);
const immediateActionSource = readFileSync(
  new URL(
    "../src/app/partner/services/[partnerId]/request/_actions/immediate.ts",
    import.meta.url,
  ),
  "utf8",
);

test("원자 감사 RPC 인자는 명시적인 주체·요청 문맥과 정제된 속성만 전달한다", async () => {
  const { buildAtomicAuditRpcContext } = await auditContextModulePromise;
  const credentialKey = ["pass", "word"].join("");

  assert.deepEqual(
    buildAtomicAuditRpcContext(
      {
        principal: { actorType: "partner", actorId: "partner-account-1" },
        request: {
          requestId: "request-1",
          path: "/partner/services/partner-1/request?token=do-not-log",
          userAgent: "test-agent",
          ipAddress: "127.0.0.1",
        },
      },
      {
        actorLoginId: "partner-owner",
        [credentialKey]: "must-not-persist",
      },
    ),
    {
      p_actor_type: "partner",
      p_actor_id: "partner-account-1",
      p_request_id: "request-1",
      p_path: "/partner/services/partner-1/request",
      p_user_agent: "test-agent",
      p_ip_address: "127.0.0.1",
      p_properties: {
        actorLoginId: "partner-owner",
        [credentialKey]: "[redacted]",
      },
    },
  );
});

test("파트너 변경 승인·거절은 별도 사후 감사 insert가 아닌 단일 RPC로 처리한다", () => {
  assert.match(
    reviewCommandSource,
    /\.rpc\(\s*["']resolve_partner_change_request_with_audit["']/,
  );
  assert.doesNotMatch(reviewActionSource, /await\s+logAdminAction\(/);
});

test("파트너 변경 승인 뒤에는 새 미디어가 아니라 교체된 기존 미디어만 정리한다", async () => {
  const { collectRemovedPartnerMediaUrls } = await mediaCleanupModulePromise;

  assert.deepEqual(
    collectRemovedPartnerMediaUrls(
      ["https://storage.example/old-thumbnail.webp", "https://storage.example/shared.webp"],
      ["https://storage.example/new-thumbnail.webp", "https://storage.example/shared.webp"],
    ),
    ["https://storage.example/old-thumbnail.webp"],
  );
});

test("파트너 즉시 수정은 소속 검증과 감사 insert를 같은 RPC에서 처리한다", () => {
  assert.match(
    immediateUpdateSource,
    /\.rpc\(\s*["']update_partner_immediate_fields_with_audit["']/,
  );
  assert.doesNotMatch(immediateActionSource, /await\s+logAdminAudit\(/);
});

test("감사 로그는 actor type과 요청 상관관계를 색인하고, RPC는 원자 잠금과 service role 권한을 강제한다", () => {
  assert.match(
    migrationSql,
    /add\s+column\s+if\s+not\s+exists\s+actor_type\s+text/i,
  );
  assert.match(schemaSql, /actor_type\s+text/i);

  for (const sql of [migrationSql, schemaSql]) {
    assert.match(
      sql,
      /admin_audit_logs_actor_type_actor_id_created_at_idx[\s\S]*?\(actor_type,\s*actor_id,\s*created_at\s+desc\)/i,
    );
    assert.match(
      sql,
      /admin_audit_logs_request_id_created_at_idx[\s\S]*?\(request_id,\s*created_at\s+desc\)[\s\S]*?where\s+request_id\s+is\s+not\s+null/i,
    );
    assert.match(
      sql,
      /create\s+or\s+replace\s+function\s+public\.resolve_partner_change_request_with_audit\(/i,
    );
    assert.match(
      sql,
      /create\s+or\s+replace\s+function\s+public\.update_partner_immediate_fields_with_audit\(/i,
    );
    assert.match(sql, /for\s+update/i);
    assert.match(sql, /partner_account_companies/i);
    assert.match(sql, /insert\s+into\s+public\.admin_audit_logs/i);

    for (const functionName of [
      "resolve_partner_change_request_with_audit",
      "update_partner_immediate_fields_with_audit",
    ]) {
      for (const role of ["public", "anon", "authenticated"]) {
        assert.match(
          sql,
          new RegExp(
            `revoke\\s+all\\s+on\\s+function\\s+public\\.${functionName}\\([^;]+from\\s+${role}\\s*;`,
            "i",
          ),
        );
      }
      assert.match(
        sql,
        new RegExp(
          `grant\\s+execute\\s+on\\s+function\\s+public\\.${functionName}\\([^;]+to\\s+service_role\\s*;`,
          "i",
        ),
      );
    }
  }
});
