import assert from "node:assert/strict";
import test from "node:test";

const clientFailureReportModulePromise = import(
  new URL(
    "../src/lib/ssafy-verify/client-failure-report.ts",
    import.meta.url,
  ).href,
);

test("SSAFY Verify client failure reports retain only validated operator diagnostics", async () => {
  const {
    createSsafyVerifyClientFailureReport,
    parseSsafyVerifyClientFailureReport,
  } = await clientFailureReportModulePromise;

  const report = createSsafyVerifyClientFailureReport({
    purpose: "member-login",
    failure: {
      ok: false,
      errorCode: "SCOPE_NOT_ALLOWED",
      requestId: "req_5wVyW3iRc7JLFWi8",
      phase: "authorize",
    },
  });

  assert.deepEqual(report, {
    purpose: "member-login",
    errorCode: "SCOPE_NOT_ALLOWED",
    requestId: "req_5wVyW3iRc7JLFWi8",
    phase: "authorize",
  });
  assert.deepEqual(parseSsafyVerifyClientFailureReport(report), report);
  assert.equal(
    parseSsafyVerifyClientFailureReport({
      ...report,
      codeVerifier: "must-not-be-logged",
    }),
    null,
  );
  assert.equal(
    parseSsafyVerifyClientFailureReport({
      ...report,
      requestId: "req_<script>",
    }),
    null,
  );
  assert.equal(
    parseSsafyVerifyClientFailureReport({
      ...report,
      purpose: "unknown-flow",
    }),
    null,
  );
});
