export function redactAuthSecurityExceptionProperties<
  T extends Record<string, unknown>,
>(properties: T) {
  if (properties.reason === "exception" && typeof properties.message === "string") {
    return {
      ...properties,
      message: "redacted_exception",
    };
  }
  return properties;
}
