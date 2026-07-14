export function redactAuthSecurityExceptionProperties<
  T extends Record<string, unknown>,
>(properties: T) {
  if (Object.hasOwn(properties, "message")) {
    return {
      ...properties,
      message: "redacted_exception",
    };
  }
  return properties;
}
