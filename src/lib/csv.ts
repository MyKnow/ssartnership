type CsvCellOptions = {
  quoteStrings?: "always" | "auto";
};

export function normalizeCsvText(value: string) {
  const normalized = value.replace(/\u0000/g, "").replace(/[\r\n]+/g, " ");
  return /^[\s\t]*[=+\-@]/.test(normalized) ? `'${normalized}` : normalized;
}

function escapeCsvQuotes(value: string) {
  return value.replace(/"/g, '""');
}

export function toCsvCell(value: unknown, options: CsvCellOptions = {}) {
  const quoteStrings = options.quoteStrings ?? "auto";

  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  const text =
    typeof value === "string" ? normalizeCsvText(value) : normalizeCsvText(JSON.stringify(value));
  const shouldQuote = quoteStrings === "always" || /[",\n\r]/.test(text);

  return shouldQuote ? `"${escapeCsvQuotes(text)}"` : text;
}
