const PUBLIC_BUILD_ENV_NAMES = [
  "NEXT_PUBLIC_DATA_SOURCE",
  "NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
];

const REAL_REQUIRED_ENV_NAMES = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ADMIN_SESSION_SECRET",
  "USER_SESSION_SECRET",
  "PARTNER_SESSION_SECRET",
  "CERTIFICATION_QR_SECRET",
  "MEMBER_IDENTIFIER_RESERVATION_HMAC_SECRET",
  "MEMBER_EMAIL_VERIFICATION_HMAC_SECRET",
  "GRADUATE_VERIFICATION_HMAC_SECRET",
  "MM_BASE_URL",
  "MM_SENDER_CREDENTIALS_ACTIVE_KEY_VERSION",
  "CRON_SECRET",
];

const SECRET_ENV_NAMES = new Set([
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ADMIN_SESSION_SECRET",
  "USER_SESSION_SECRET",
  "PARTNER_SESSION_SECRET",
  "CERTIFICATION_QR_SECRET",
  "MEMBER_IDENTIFIER_RESERVATION_HMAC_SECRET",
  "MEMBER_EMAIL_VERIFICATION_HMAC_SECRET",
  "GRADUATE_VERIFICATION_HMAC_SECRET",
  "CRON_SECRET",
]);

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const INTERNAL_HTTP_HOSTS = new Set(["gateway", ...LOOPBACK_HOSTS]);

function valueOf(environment, name) {
  return environment[name]?.trim() ?? "";
}

function diagnostic(code, subject) {
  return { code, subject };
}

function isPlaceholder(value) {
  const normalized = value.toLowerCase();
  return (
    normalized.includes("replace-with")
    || normalized.includes("change-me")
    || normalized.includes("example.invalid")
  );
}

function parseUrl(value) {
  if (
    value !== value.trim()
    || /[\u0000-\u001F\u007F\\]/u.test(value)
  ) {
    return null;
  }
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isSafeOriginUrl(url) {
  return url !== null
    && !url.username
    && !url.password
    && url.pathname === "/"
    && !url.search
    && !url.hash;
}

export function isAllowedPublicUrl(value) {
  const url = parseUrl(value);
  if (!isSafeOriginUrl(url)) return false;
  return url.protocol === "https:"
    || (url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname));
}

export function isAllowedInternalSupabaseUrl(value) {
  const url = parseUrl(value);
  if (!isSafeOriginUrl(url)) return false;
  return url.protocol === "https:"
    || (url.protocol === "http:" && INTERNAL_HTTP_HOSTS.has(url.hostname));
}

export function validateBuildPublicEnvironment(environment) {
  const diagnostics = [];
  const defaultSource = valueOf(environment, "NEXT_PUBLIC_DATA_SOURCE");
  const partnerSource = valueOf(
    environment,
    "NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE",
  );

  for (const [name, value] of [
    ["NEXT_PUBLIC_DATA_SOURCE", defaultSource],
    ["NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE", partnerSource],
  ]) {
    if (!value) {
      diagnostics.push(diagnostic("public_build_value_required", name));
    } else if (value !== "mock" && value !== "supabase") {
      diagnostics.push(diagnostic("public_build_value_invalid", name));
    }
  }

  if (defaultSource && partnerSource && defaultSource !== partnerSource) {
    diagnostics.push(
      diagnostic(
        "public_data_source_mismatch",
        "NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE",
      ),
    );
  }

  const publicSiteUrl = valueOf(environment, "NEXT_PUBLIC_SITE_URL");
  if (!publicSiteUrl) {
    diagnostics.push(diagnostic("public_build_value_required", "NEXT_PUBLIC_SITE_URL"));
  } else if (!isAllowedPublicUrl(publicSiteUrl)) {
    diagnostics.push(diagnostic("public_build_url_invalid", "NEXT_PUBLIC_SITE_URL"));
  }

  const publicSupabaseUrl = valueOf(environment, "NEXT_PUBLIC_SUPABASE_URL");
  if (defaultSource === "supabase") {
    if (!publicSupabaseUrl) {
      diagnostics.push(
        diagnostic("public_build_value_required", "NEXT_PUBLIC_SUPABASE_URL"),
      );
    } else if (!isAllowedPublicUrl(publicSupabaseUrl)) {
      diagnostics.push(
        diagnostic("public_build_url_invalid", "NEXT_PUBLIC_SUPABASE_URL"),
      );
    }
  } else if (publicSupabaseUrl && !isAllowedPublicUrl(publicSupabaseUrl)) {
    diagnostics.push(diagnostic("public_build_url_invalid", "NEXT_PUBLIC_SUPABASE_URL"));
  }

  return diagnostics;
}

export function createBuildEnvironmentManifest(environment) {
  const diagnostics = validateBuildPublicEnvironment(environment);
  if (diagnostics.length > 0) {
    const summary = diagnostics.map(({ code, subject }) => `${code}:${subject}`).join(", ");
    throw new Error(`invalid self-host public build environment: ${summary}`);
  }

  return {
    version: 1,
    publicEnvironment: Object.fromEntries(
      PUBLIC_BUILD_ENV_NAMES.map((name) => [name, valueOf(environment, name)]),
    ),
  };
}

export function validateBuildEnvironmentManifest(manifest) {
  if (!manifest || manifest.version !== 1 || !manifest.publicEnvironment) {
    return [diagnostic("build_manifest_invalid", "build-env.json")];
  }

  for (const name of PUBLIC_BUILD_ENV_NAMES) {
    if (typeof manifest.publicEnvironment[name] !== "string") {
      return [diagnostic("build_manifest_invalid", name)];
    }
  }

  return validateBuildPublicEnvironment(manifest.publicEnvironment);
}

function validateRequiredRealValues(environment, diagnostics) {
  for (const name of REAL_REQUIRED_ENV_NAMES) {
    const value = valueOf(environment, name);
    if (!value) {
      diagnostics.push(diagnostic("runtime_value_required", name));
      continue;
    }
    if (isPlaceholder(value)) {
      diagnostics.push(diagnostic("runtime_placeholder_forbidden", name));
    }
    if (SECRET_ENV_NAMES.has(name) && value.length < 32) {
      diagnostics.push(diagnostic("runtime_secret_too_short", name));
    }
  }

  const publicSupabaseUrl = valueOf(environment, "SUPABASE_URL");
  if (!isAllowedPublicUrl(publicSupabaseUrl)) {
    diagnostics.push(diagnostic("public_supabase_url_invalid", "SUPABASE_URL"));
  }

  if (publicSupabaseUrl !== valueOf(environment, "NEXT_PUBLIC_SUPABASE_URL")) {
    diagnostics.push(
      diagnostic("runtime_supabase_public_url_mismatch", "SUPABASE_URL"),
    );
  }

  const internalSupabaseUrl = valueOf(environment, "SUPABASE_INTERNAL_URL");
  if (
    internalSupabaseUrl
    && !isAllowedInternalSupabaseUrl(internalSupabaseUrl)
  ) {
    diagnostics.push(
      diagnostic("internal_supabase_url_invalid", "SUPABASE_INTERNAL_URL"),
    );
  }

  const mattermostUrl = valueOf(environment, "MM_BASE_URL");
  if (mattermostUrl && !isAllowedPublicUrl(mattermostUrl)) {
    diagnostics.push(diagnostic("runtime_url_invalid", "MM_BASE_URL"));
  }

  const activeKeyVersion = valueOf(
    environment,
    "MM_SENDER_CREDENTIALS_ACTIVE_KEY_VERSION",
  );
  if (!/^[1-9]\d?$/u.test(activeKeyVersion)) {
    diagnostics.push(
      diagnostic(
        "mattermost_sender_key_version_invalid",
        "MM_SENDER_CREDENTIALS_ACTIVE_KEY_VERSION",
      ),
    );
    return;
  }

  const keyVersion = Number(activeKeyVersion);
  if (!Number.isSafeInteger(keyVersion) || keyVersion > 99) {
    diagnostics.push(
      diagnostic(
        "mattermost_sender_key_version_invalid",
        "MM_SENDER_CREDENTIALS_ACTIVE_KEY_VERSION",
      ),
    );
    return;
  }

  const keyName = `MM_SENDER_CREDENTIALS_KEY_V${keyVersion}`;
  const key = valueOf(environment, keyName);
  if (!key) {
    diagnostics.push(diagnostic("runtime_value_required", keyName));
  } else if (isPlaceholder(key) || !isValidMattermostSenderKey(key)) {
    diagnostics.push(diagnostic("mattermost_sender_key_invalid", keyName));
  }
}

function isValidMattermostSenderKey(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  if (!/^[A-Za-z0-9+/]*={0,2}$/u.test(normalized)) {
    return false;
  }
  return Buffer.from(normalized, "base64").length === 32;
}

export function validateSelfHostRuntimeEnvironment(environment, manifest) {
  const diagnostics = [...validateBuildEnvironmentManifest(manifest)];
  const mode = valueOf(environment, "SELF_HOST_MODE");

  if (mode !== "real" && mode !== "local-mock") {
    diagnostics.push(diagnostic("self_host_mode_invalid", "SELF_HOST_MODE"));
    return diagnostics;
  }

  const buildEnvironment = manifest?.publicEnvironment;
  if (buildEnvironment) {
    for (const name of PUBLIC_BUILD_ENV_NAMES) {
      if (valueOf(environment, name) !== buildEnvironment[name]) {
        diagnostics.push(diagnostic("runtime_public_build_mismatch", name));
      }
    }
  }

  if (valueOf(environment, "MOCK_MEMBER_AUTH") === "1") {
    diagnostics.push(diagnostic("mock_member_auth_forbidden", "MOCK_MEMBER_AUTH"));
  }
  for (const name of ["SELF_HOST_E2E_BUILD", "E2E_MOCK_MUTATIONS", "E2E_ADMIN_AUTH"]) {
    if (valueOf(environment, name) === "1") diagnostics.push(diagnostic("e2e_fixture_flag_forbidden", name));
  }

  if (mode === "local-mock") {
    if (
      buildEnvironment?.NEXT_PUBLIC_DATA_SOURCE !== "mock"
      || buildEnvironment?.NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE !== "mock"
    ) {
      diagnostics.push(diagnostic("local_mock_build_required", "NEXT_PUBLIC_DATA_SOURCE"));
    }
    for (const name of ["SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
      if (valueOf(environment, name)) {
        diagnostics.push(diagnostic("local_mock_secret_forbidden", name));
      }
    }
    return diagnostics;
  }

  if (
    buildEnvironment?.NEXT_PUBLIC_DATA_SOURCE !== "supabase"
    || buildEnvironment?.NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE !== "supabase"
  ) {
    diagnostics.push(diagnostic("real_mode_supabase_build_required", "NEXT_PUBLIC_DATA_SOURCE"));
  }
  validateRequiredRealValues(environment, diagnostics);
  return diagnostics;
}
