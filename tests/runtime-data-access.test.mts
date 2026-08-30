import assert from "node:assert/strict";
import test from "node:test";
import {
  RuntimeDataAccessUnavailableError,
  selectRuntimeDataAccess,
  type RuntimeDataAccessEnvironment,
} from "../src/lib/runtime-data-access.ts";

const SUPABASE_URL = "https://project.example.invalid";
const ENVIRONMENT_KEYS = [
  "NEXT_PUBLIC_DATA_SOURCE",
  "NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

type ConsumerModules = {
  repositories: typeof import("../src/lib/repositories/index.ts");
  notificationPreferences: typeof import("../src/lib/notification-preferences.ts");
  policies: typeof import("../src/lib/policy-documents.ts");
  partnerPortal: typeof import("../src/lib/partner-portal.ts");
  walletPass: typeof import("../src/lib/repositories/wallet-pass.ts");
};

let importSequence = 0;

async function importFresh<T>(relativePath: string): Promise<T> {
  importSequence += 1;
  const url = new URL(relativePath, import.meta.url);
  url.searchParams.set("runtime-data-access-case", String(importSequence));
  return import(url.href) as Promise<T>;
}

async function withRuntimeEnvironment<T>(
  environment: RuntimeDataAccessEnvironment,
  callback: () => Promise<T>,
) {
  const previousEnvironment = Object.fromEntries(
    ENVIRONMENT_KEYS.map((key) => [key, process.env[key]]),
  ) as Record<(typeof ENVIRONMENT_KEYS)[number], string | undefined>;

  for (const key of ENVIRONMENT_KEYS) {
    const value = environment[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await callback();
  } finally {
    for (const key of ENVIRONMENT_KEYS) {
      const value = previousEnvironment[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

async function loadConsumerModules(): Promise<ConsumerModules> {
  return {
    repositories: await importFresh("../src/lib/repositories/index.ts"),
    notificationPreferences: await importFresh(
      "../src/lib/notification-preferences.ts",
    ),
    policies: await importFresh("../src/lib/policy-documents.ts"),
    partnerPortal: await importFresh("../src/lib/partner-portal.ts"),
    walletPass: await importFresh("../src/lib/repositories/wallet-pass.ts"),
  };
}

function getConsumerSources(
  modules: ConsumerModules,
  environment: RuntimeDataAccessEnvironment,
) {
  return {
    repositories: modules.repositories.repositoryDataAccess.source,
    notificationPreferences:
      modules.notificationPreferences.notificationPreferenceDataAccess.source,
    policies: modules.policies.policyDocumentDataAccess.source,
    partnerPortal: modules.partnerPortal.partnerPortalDataAccess.source,
    walletPass:
      modules.walletPass.getWalletPassRepositoryDataAccess(environment).source,
  };
}

test("selects mock only when the configured source explicitly requests mock", () => {
  assert.deepEqual(
    selectRuntimeDataAccess({
      capability: "admin",
      environment: { NEXT_PUBLIC_DATA_SOURCE: "mock" },
    }),
    { capability: "admin", source: "mock", reason: null },
  );

  for (const configuredSource of ["", "fixture", "MOCK"]) {
    assert.deepEqual(
      selectRuntimeDataAccess({
        capability: "admin",
        environment: {
          NEXT_PUBLIC_DATA_SOURCE: configuredSource,
          SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
        },
      }),
      {
        capability: "admin",
        source: "unavailable",
        reason: "invalid_data_source",
      },
    );
  }
});

test("keeps public and admin Supabase capabilities explicit", () => {
  const anonEnvironment = {
    NEXT_PUBLIC_DATA_SOURCE: "supabase",
    SUPABASE_URL,
    SUPABASE_ANON_KEY: "anon-key",
  };
  const serviceRoleEnvironment = {
    NEXT_PUBLIC_DATA_SOURCE: "supabase",
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  };

  assert.equal(
    selectRuntimeDataAccess({
      capability: "public",
      environment: anonEnvironment,
    }).source,
    "supabase",
  );
  assert.equal(
    selectRuntimeDataAccess({
      capability: "public",
      environment: serviceRoleEnvironment,
    }).source,
    "supabase",
  );
  assert.deepEqual(
    selectRuntimeDataAccess({
      capability: "admin",
      environment: anonEnvironment,
    }),
    {
      capability: "admin",
      source: "unavailable",
      reason: "missing_credentials",
    },
  );
  assert.equal(
    selectRuntimeDataAccess({
      capability: "admin",
      environment: serviceRoleEnvironment,
    }).source,
    "supabase",
  );
  assert.equal(
    selectRuntimeDataAccess({
      capability: "admin",
      environment: {
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      },
    }).source,
    "supabase",
  );
});

test("honors only an explicit partner portal source override", () => {
  const baseEnvironment = {
    NEXT_PUBLIC_DATA_SOURCE: "supabase",
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  };

  assert.equal(
    selectRuntimeDataAccess({
      capability: "admin",
      environment: {
        ...baseEnvironment,
        NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE: "mock",
      },
      sourcePreference: "partner-portal",
    }).source,
    "mock",
  );
  assert.deepEqual(
    selectRuntimeDataAccess({
      capability: "admin",
      environment: {
        ...baseEnvironment,
        NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE: "preview",
      },
      sourcePreference: "partner-portal",
    }),
    {
      capability: "admin",
      source: "unavailable",
      reason: "invalid_data_source",
    },
  );
});

test("all admin-backed consumers share the same source matrix", async () => {
  const cases: Array<{
    name: string;
    environment: RuntimeDataAccessEnvironment;
    expectedSource: "mock" | "supabase" | "unavailable";
  }> = [
    {
      name: "explicit mock",
      environment: { NEXT_PUBLIC_DATA_SOURCE: "mock" },
      expectedSource: "mock",
    },
    {
      name: "complete service-role configuration",
      environment: {
        NEXT_PUBLIC_DATA_SOURCE: "supabase",
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      },
      expectedSource: "supabase",
    },
    {
      name: "anon-only configuration",
      environment: {
        NEXT_PUBLIC_DATA_SOURCE: "supabase",
        SUPABASE_URL,
        SUPABASE_ANON_KEY: "anon-key",
      },
      expectedSource: "unavailable",
    },
    {
      name: "unconfigured runtime",
      environment: {},
      expectedSource: "unavailable",
    },
  ];

  for (const currentCase of cases) {
    await withRuntimeEnvironment(currentCase.environment, async () => {
      const modules = await loadConsumerModules();
      const sources = getConsumerSources(modules, currentCase.environment);
      assert.deepEqual(
        sources,
        {
          repositories: currentCase.expectedSource,
          notificationPreferences: currentCase.expectedSource,
          policies: currentCase.expectedSource,
          partnerPortal: currentCase.expectedSource,
          walletPass: currentCase.expectedSource,
        },
        currentCase.name,
      );
    });
  }
});

test("unavailable consumers fail with safe domain-neutral errors", async () => {
  const unavailableEnvironment = {
    NEXT_PUBLIC_DATA_SOURCE: "supabase",
    SUPABASE_URL,
    SUPABASE_ANON_KEY: "anon-key",
  };

  await withRuntimeEnvironment(unavailableEnvironment, async () => {
    const modules = await loadConsumerModules();

    await assert.rejects(
      modules.repositories.partnerRepository.getCategories(),
      (error: unknown) => {
        assert.ok(error instanceof RuntimeDataAccessUnavailableError);
        assert.equal(error.code, "runtime_data_access_unavailable");
        assert.equal(error.message, "데이터 저장소를 사용할 수 없습니다.");
        return true;
      },
    );
    await assert.rejects(
      modules.notificationPreferences.getMemberNotificationPreferences(
        "member-id",
      ),
      /알림 설정 저장소를 사용할 수 없습니다/,
    );
    await assert.rejects(
      modules.policies.getPolicyDocumentByKind("service"),
      /정책 문서 저장소를 사용할 수 없습니다/,
    );

    const unavailablePartnerPortalRepository =
      modules.partnerPortal.createUnavailablePartnerPortalRepository();
    await assert.rejects(
      unavailablePartnerPortalRepository.listDemoSetups(),
      /파트너 포털 저장소를 사용할 수 없습니다/,
    );

    const walletRepository = modules.walletPass.createWalletPassRepository(
      unavailableEnvironment,
    );
    await assert.rejects(
      walletRepository.getMemberWalletPass({
        memberId: "member-id",
        platform: "apple",
      }),
      /Apple Wallet 저장소를 사용할 수 없습니다/,
    );
  });
});
