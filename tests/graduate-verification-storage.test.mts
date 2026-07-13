import assert from "node:assert/strict";
import test from "node:test";
import { isGraduateStoredObjectMissingError } from "@/lib/graduate-verification-storage";

test("private object cleanup treats an already deleted object as idempotent success", () => {
  assert.equal(
    isGraduateStoredObjectMissingError({ statusCode: "404", message: "Object not found" }),
    true,
  );
  assert.equal(
    isGraduateStoredObjectMissingError({ status: 404, message: "not found" }),
    true,
  );
  assert.equal(
    isGraduateStoredObjectMissingError({ statusCode: "500", message: "storage failure" }),
    false,
  );
  assert.equal(isGraduateStoredObjectMissingError(null), false);
});
