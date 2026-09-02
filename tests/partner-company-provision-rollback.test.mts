import assert from "node:assert/strict";
import test from "node:test";

import { ensurePartnerCompanyRow } from "../src/app/admin/(protected)/_actions/partner-support/company-provision.ts";

type QueryError = { code?: string; message: string } | null;
type Operation = "select" | "insert" | "update" | "delete";

test("기존 계정 연결 실패 시 갱신한 계정 값을 원복한다", async () => {
  const events: string[] = [];
  const existingAccount = {
    id: "account-1",
    login_id: "owner@example.com",
    display_name: "기존 담당자",
    email: "old@example.com",
    password_hash: "hash",
    password_salt: "salt",
    must_change_password: false,
    is_active: false,
    email_verified_at: null,
    initial_setup_completed_at: null,
  };
  let account = { ...existingAccount };

  function from(table: string) {
    let operation: Operation = "select";
    let values: Record<string, unknown> | null = null;

    const execute = (single: boolean) => {
      let data: unknown = null;
      let error: QueryError = null;

      if (table === "partner_companies" && operation === "insert") {
        events.push("company:create");
        data = {
          id: "company-1",
          name: values?.name,
          slug: values?.slug,
          description: values?.description,
          is_active: true,
          managed_campus_slugs: [],
        };
      } else if (table === "partner_accounts" && operation === "select") {
        data = { ...account };
      } else if (table === "partner_accounts" && operation === "update") {
        const nextValues = values ?? {};
        const isRestore = nextValues.display_name === existingAccount.display_name;
        events.push(isRestore ? "account:restore" : "account:update");
        account = { ...account, ...nextValues };
        data = { ...account };
      } else if (table === "partner_account_companies" && operation === "insert") {
        events.push("link:create");
        error = { code: "23505", message: "duplicate link" };
      } else if (table === "partner_companies" && operation === "delete") {
        events.push("company:delete");
      }

      return Promise.resolve({ data: single ? data : null, error });
    };

    const builder = {
      select() {
        return builder;
      },
      insert(input: Record<string, unknown>) {
        operation = "insert";
        values = input;
        return builder;
      },
      update(input: Record<string, unknown>) {
        operation = "update";
        values = input;
        return builder;
      },
      delete() {
        operation = "delete";
        return builder;
      },
      eq() {
        return builder;
      },
      single() {
        return execute(true);
      },
      maybeSingle() {
        return execute(true);
      },
      then<TResult1 = unknown, TResult2 = never>(
        onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
      ) {
        return execute(false).then(onfulfilled, onrejected);
      },
    };

    return builder;
  }

  await assert.rejects(
    ensurePartnerCompanyRow(
      { from } as never,
      {
        companyId: null,
        name: "새 회사",
        description: null,
        contactName: "새 담당자",
        contactEmail: "owner@example.com",
        contactPhone: null,
      },
      true,
    ),
    /duplicate link/,
  );

  assert.deepEqual(account, existingAccount);
  assert.deepEqual(events, [
    "company:create",
    "account:update",
    "link:create",
    "account:restore",
    "company:delete",
  ]);
});
