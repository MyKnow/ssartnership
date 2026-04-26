import { describe, expect, test } from "vitest";
import {
  generateOpaqueToken,
  generateTempPassword,
  hashOpaqueToken,
  hashPassword,
  isValidPassword,
  verifyPassword,
} from "../../src/lib/password";

describe("password helpers", () => {
  test("hashPassword and verifyPassword round-trip", () => {
    const password = "S3cure!Pass";
    const { salt, hash } = hashPassword(password);

    expect(salt).toHaveLength(32);
    expect(hash).toHaveLength(128);
    expect(verifyPassword(password, salt, hash)).toBe(true);
    expect(verifyPassword("Wrong!Pass1", salt, hash)).toBe(false);
  });

  test("verifyPassword returns false when hash lengths differ", () => {
    const { salt, hash } = hashPassword("Valid!123");
    expect(verifyPassword("Valid!123", salt, hash.slice(0, -2))).toBe(false);
  });

  test("isValidPassword enforces length and character classes", () => {
    expect(isValidPassword("Short1!")).toBe(false);
    expect(isValidPassword("NoNumber!")).toBe(false);
    expect(isValidPassword("NoSymbol12")).toBe(false);
    expect(isValidPassword("12345678!")).toBe(false);
    expect(isValidPassword("Valid!123")).toBe(true);
    expect(isValidPassword(`A1!${"b".repeat(61)}`)).toBe(true);
    expect(isValidPassword(`A1!${"b".repeat(62)}`)).toBe(false);
  });

  test("generateTempPassword creates a valid password with requested length", () => {
    const password = generateTempPassword(20);
    expect(password).toHaveLength(20);
    expect(isValidPassword(password)).toBe(true);
  });

  test("opaque token helpers are deterministic and sized", () => {
    expect(hashOpaqueToken("token-123")).toBe(hashOpaqueToken("token-123"));
    expect(hashOpaqueToken("token-123")).not.toBe(hashOpaqueToken("token-456"));
    expect(generateOpaqueToken()).toHaveLength(64);
    expect(generateOpaqueToken(16)).toHaveLength(32);
  });
});
