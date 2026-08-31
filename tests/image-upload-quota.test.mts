import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildImageUploadQuotaIdentifiers,
  hashImageUploadQuotaIdentifier,
  isHashedImageUploadQuotaIdentifier,
} from "../src/lib/image-upload/quota.ts";
import { resolveImageTransformPolicy } from "../src/lib/image-upload/policy.ts";
import { SupabaseImageUploadRepository } from "../src/lib/image-upload/repository.supabase.ts";

const migrationUrl = new URL(
  "../supabase/migrations/20260831093232_add_image_upload_reservation_quota.sql",
  import.meta.url,
);

test("업로드 quota 식별자는 actor와 IP 원문을 남기지 않는 SHA-256 값이다", async () => {
  const actor = "member:11111111-1111-4111-8111-111111111111";
  const ipAddress = "203.0.113.10";
  const identifiers = buildImageUploadQuotaIdentifiers({
    accountIdentifier: actor,
    ipAddress,
  });

  assert.equal(identifiers.length, 2);
  assert.ok(identifiers.every(isHashedImageUploadQuotaIdentifier));
  assert.ok(identifiers.every((identifier) => !identifier.includes(actor)));
  assert.ok(identifiers.every((identifier) => !identifier.includes(ipAddress)));
  assert.notEqual(
    hashImageUploadQuotaIdentifier("account", "same-value"),
    hashImageUploadQuotaIdentifier("ip", "same-value"),
  );

  const route = await readFile(
    new URL("../src/app/api/uploads/images/sign/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    route,
    /quotaIdentifiers: buildImageUploadQuotaIdentifiers\(rateLimitContext\)/,
  );
  assert.match(route, /error\.code === "image_upload_quota_exceeded"/);
  assert.match(route, /status: isQuotaExceeded \? 429 : 503/);
});

test("quota migration은 사용량 증가와 세션 생성을 한 트랜잭션에서 잠그고 제한한다", async () => {
  const [migration, schema] = await Promise.all([
    readFile(migrationUrl, "utf8"),
    readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8"),
  ]);
  const reservationFunction = migration.match(
    /create or replace function public\.reserve_image_upload_sessions[\s\S]*?\n\$\$;/i,
  )?.[0] ?? "";

  assert.match(migration, /quota_size_bytes\s*=\s*10485760/i);
  assert.match(migration, /alter column quota_size_bytes set not null/i);
  assert.match(migration, /create table if not exists public\.image_upload_quota_windows/i);
  assert.match(migration, /identifier_hash ~ '\^\[0-9a-f\]\{64\}\$'/i);
  assert.match(migration, /alter table public\.image_upload_quota_windows enable row level security/i);
  for (const role of ["public", "anon", "authenticated"]) {
    assert.match(
      migration,
      new RegExp(`revoke all on table public\\.image_upload_quota_windows from ${role}`, "i"),
    );
  }

  assert.match(reservationFunction, /language plpgsql[\s\S]*security definer/i);
  assert.match(reservationFunction, /set search_path = pg_catalog, public/i);
  assert.match(reservationFunction, /v_session_count not between 1 and 20/i);
  assert.match(reservationFunction, /order by advisory_key[\s\S]*pg_advisory_xact_lock/i);
  assert.match(reservationFunction, /extract\(epoch from v_now\) \/ 600/i);
  assert.match(reservationFunction, /request_count \+ 1 > 20/i);
  assert.match(reservationFunction, /object_count \+ v_session_count > 60/i);
  assert.match(reservationFunction, /reserved_size_bytes \+ v_total_quota_size_bytes > 209715200/i);
  assert.match(reservationFunction, /v_active_object_count \+ v_session_count > 40/i);
  assert.match(reservationFunction, /on conflict \(identifier_hash, window_started_at\) do update/i);
  assert.match(reservationFunction, /insert into public\.image_upload_sessions/i);
  assert.match(
    migration,
    /revoke all on function public\.reserve_image_upload_sessions\(text, text, text, text\[\], jsonb\) from public/i,
  );
  assert.match(
    migration,
    /revoke all on function public\.reserve_image_upload_sessions\(text, text, text, text\[\], jsonb\) from anon/i,
  );
  assert.match(
    migration,
    /revoke all on function public\.reserve_image_upload_sessions\(text, text, text, text\[\], jsonb\) from authenticated/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.reserve_image_upload_sessions\(text, text, text, text\[\], jsonb\) to service_role/i,
  );
  assert.ok(
    schema.indexOf("create or replace function public.reserve_image_upload_sessions")
      < schema.lastIndexOf("do $public_access_hardening$"),
  );
});

test("quota window 정리는 service-role 전용 bounded RPC로 수행한다", async () => {
  const [migration, repository] = await Promise.all([
    readFile(migrationUrl, "utf8"),
    readFile(
      new URL("../src/lib/image-upload/repository.supabase.ts", import.meta.url),
      "utf8",
    ),
  ]);
  const cleanupFunction = migration.match(
    /create or replace function public\.cleanup_image_upload_quota_windows[\s\S]*?\n\$\$;/i,
  )?.[0] ?? "";

  assert.match(cleanupFunction, /p_limit integer default 5000/i);
  assert.match(cleanupFunction, /p_limit not between 1 and 5000/i);
  assert.match(cleanupFunction, /limit p_limit[\s\S]*for update skip locked/i);
  assert.match(
    migration,
    /grant execute on function public\.cleanup_image_upload_quota_windows\(timestamp with time zone, integer\) to service_role/i,
  );
  assert.match(repository, /rpc\("cleanup_image_upload_quota_windows"/i);
  assert.doesNotMatch(
    repository,
    /from\("image_upload_quota_windows"\)[\s\S]{0,120}\.delete\(\)/i,
  );

  const rpcCalls: Array<{ name: string; parameters: Record<string, unknown> }> = [];
  const emptyQuery = {
    select() {
      return emptyQuery;
    },
    eq() {
      return emptyQuery;
    },
    in() {
      return emptyQuery;
    },
    lte() {
      return emptyQuery;
    },
    async limit() {
      return { data: [], error: null };
    },
  };
  const imageRepository = new SupabaseImageUploadRepository({
    from() {
      return emptyQuery;
    },
    async rpc(name: string, parameters: Record<string, unknown>) {
      rpcCalls.push({ name, parameters });
      return { data: 0, error: null };
    },
  } as never);
  const now = new Date("2026-08-31T09:00:00.000Z");

  assert.equal(await imageRepository.expireStale(now), 0);
  assert.deepEqual(rpcCalls, [{
    name: "cleanup_image_upload_quota_windows",
    parameters: {
      p_before: "2026-08-30T09:00:00.000Z",
      p_limit: 5000,
    },
  }]);
});

test("repository는 선언 크기가 아니라 정책 최대 크기를 quota로 원자 예약한다", async () => {
  const rpcCalls: Array<{ name: string; parameters: Record<string, unknown> }> = [];
  const fakeSupabase = {
    async rpc(name: string, parameters: Record<string, unknown>) {
      rpcCalls.push({ name, parameters });
      const sessions = parameters.p_sessions as unknown[];
      return { data: sessions.length, error: null };
    },
    storage: {
      from() {
        return {
          async createSignedUploadUrl(path: string) {
            return { data: { signedUrl: `https://storage.test/${path}` }, error: null };
          },
        };
      },
    },
  };
  const repository = new SupabaseImageUploadRepository(fakeSupabase as never);
  const quotaIdentifiers = buildImageUploadQuotaIdentifiers({
    accountIdentifier: "admin:11111111-1111-4111-8111-111111111111",
    ipAddress: "203.0.113.20",
  });

  const result = await repository.sign({
    actor: { kind: "admin", id: "11111111-1111-4111-8111-111111111111" },
    purpose: "promotion",
    quotaIdentifiers,
    uploads: [{
      clientId: "slide-1",
      role: "slide",
      fileName: "slide.png",
      contentType: "image/png",
      size: 1234,
    }],
    now: new Date(Date.now() + 60_000),
  });

  assert.equal(result.length, 1);
  assert.equal(rpcCalls.length, 1);
  assert.equal(rpcCalls[0]?.name, "reserve_image_upload_sessions");
  assert.deepEqual(rpcCalls[0]?.parameters.p_quota_identifiers, quotaIdentifiers);
  const [reservedSession] = rpcCalls[0]?.parameters.p_sessions as Array<Record<string, unknown>>;
  assert.equal(reservedSession?.source_size_bytes, 1234);
  assert.equal(
    reservedSession?.quota_size_bytes,
    resolveImageTransformPolicy("promotion", "slide").maxSourceBytes,
  );
});

test("서명 URL 실패는 이미 증가한 quota를 환불하지 않는다", async () => {
  const rpcNames: string[] = [];
  const failedUpdates: Array<Record<string, unknown>> = [];
  const fakeSupabase = {
    async rpc(name: string, parameters: Record<string, unknown>) {
      rpcNames.push(name);
      return { data: (parameters.p_sessions as unknown[]).length, error: null };
    },
    from(table: string) {
      assert.equal(table, "image_upload_sessions");
      const builder = {
        update(values: Record<string, unknown>) {
          failedUpdates.push(values);
          return builder;
        },
        eq() {
          return builder;
        },
        async in() {
          return { data: null, error: null };
        },
      };
      return builder;
    },
    storage: {
      from() {
        return {
          async createSignedUploadUrl() {
            return { data: null, error: new Error("signing unavailable") };
          },
        };
      },
    },
  };
  const repository = new SupabaseImageUploadRepository(fakeSupabase as never);

  await assert.rejects(
    repository.sign({
      actor: { kind: "member", id: "11111111-1111-4111-8111-111111111111" },
      purpose: "profile",
      quotaIdentifiers: [
        hashImageUploadQuotaIdentifier(
          "account",
          "member:11111111-1111-4111-8111-111111111111",
        ),
      ],
      uploads: [{
        clientId: "profile-1",
        role: "profile",
        fileName: "profile.png",
        contentType: "image/png",
        size: 1024,
      }],
      now: new Date(Date.now() + 60_000),
    }),
    /업로드 URL/,
  );

  assert.deepEqual(rpcNames, ["reserve_image_upload_sessions"]);
  assert.deepEqual(failedUpdates, [{ status: "failed", failure_code: "sign_failed" }]);
});
