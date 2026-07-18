import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import type {
  NotificationTemplateBodyFormat,
} from "@/lib/notification-templates/catalog";
import { renderNotificationTemplate } from "@/lib/notification-templates/template";

export type RenderedEmailBody = {
  text: string;
  html: string;
};

export const EMAIL_HEADER_TEXT = "싸트너십";
export const EMAIL_FOOTER_TEXT =
  "이 메일은 싸트너십에서 발송되었습니다.\n문의가 필요하면 관리자에게 회신해 주세요.";

const EMAIL_ALLOWED_TAGS = [
  "a",
  "abbr",
  "b",
  "blockquote",
  "br",
  "code",
  "del",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "hr",
  "i",
  "li",
  "ol",
  "p",
  "pre",
  "s",
  "span",
  "strong",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
] as const;

const EMAIL_ALLOWED_ATTRIBUTES = {
  a: ["href", "title"],
  abbr: ["title"],
};

const EMAIL_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [...EMAIL_ALLOWED_TAGS],
  allowedAttributes: EMAIL_ALLOWED_ATTRIBUTES,
  allowedSchemes: ["http", "https", "mailto"],
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
};

const EMAIL_WRAPPER_STYLE =
  "font-family: 'Pretendard', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif; color: #0f172a; line-height: 1.7; white-space: pre-wrap;";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeMarkdownVariable(value: string) {
  return escapeHtml(value).replace(/([\\`*_[\]{}()+.!|>#-])/g, "\\$1");
}

function escapeEmailVariables(
  variables: Record<string, string | number | null | undefined>,
  format: NotificationTemplateBodyFormat,
) {
  return Object.fromEntries(
    Object.entries(variables).map(([name, value]) => [
      name,
      value === null || value === undefined
        ? value
        : format === "html"
          ? escapeHtml(String(value))
          : format === "markdown"
            ? escapeMarkdownVariable(String(value))
            : value,
    ]),
  ) as Record<string, string | number | null | undefined>;
}

function sanitizeEmailHtml(value: string) {
  return sanitizeHtml(value, EMAIL_SANITIZE_OPTIONS);
}

function wrapEmailHtml(value: string) {
  return `<div style="${EMAIL_WRAPPER_STYLE}"><div style="border-bottom: 1px solid #e2e8f0; padding: 0 0 16px; font-size: 20px; font-weight: 700;">${escapeHtml(EMAIL_HEADER_TEXT)}</div><div style="padding: 24px 0;">${value}</div><div style="border-top: 1px solid #e2e8f0; padding: 16px 0 0; color: #64748b; font-size: 12px;">${escapeHtml(EMAIL_FOOTER_TEXT).replace(/\n/g, "<br>")}</div></div>`;
}

function composeEmailText(value: string) {
  return [EMAIL_HEADER_TEXT, value, EMAIL_FOOTER_TEXT].join("\n\n");
}

function decodeHtmlEntities(value: string) {
  const namedEntities: Record<string, string> = {
    "&amp;": "&",
    "&apos;": "'",
    "&gt;": ">",
    "&lt;": "<",
    "&nbsp;": " ",
    "&quot;": '"',
    "&#39;": "'",
  };

  return value.replace(
    /&(?:amp|apos|gt|lt|nbsp|quot|#39);|&#x([0-9a-f]+);|&#([0-9]+);/gi,
    (entity, hexadecimal: string | undefined, decimal: string | undefined) => {
      if (entity in namedEntities) {
        return namedEntities[entity];
      }
      const codePoint = Number.parseInt(hexadecimal ?? decimal ?? "", hexadecimal ? 16 : 10);
      return Number.isSafeInteger(codePoint) && codePoint > 0
        ? String.fromCodePoint(codePoint)
        : entity;
    },
  );
}

function htmlToPlainText(value: string) {
  const withLinks = value.replace(
    /<a\b[^>]*\bhref=(['"])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi,
    "$3 ($2)",
  );
  const withLineBreaks = withLinks
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "- ")
    .replace(/<\/(?:blockquote|div|h[1-4]|li|ol|p|pre|table|tbody|tfoot|tr|ul)>/gi, "\n")
    .replace(/<[^>]+>/g, "");

  return decodeHtmlEntities(withLineBreaks)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function renderMarkdownHtml(value: string) {
  const markdownHtml = marked.parse(value, {
    async: false,
    breaks: true,
    gfm: true,
  });
  return sanitizeEmailHtml(markdownHtml);
}

export function renderEmailBody(
  body: string,
  format: NotificationTemplateBodyFormat,
): RenderedEmailBody {
  if (format === "plain") {
    return {
      text: composeEmailText(body),
      html: wrapEmailHtml(escapeHtml(body)),
    };
  }

  const sanitizedHtml = format === "markdown"
    ? renderMarkdownHtml(body)
    : sanitizeEmailHtml(body);

  return {
    text: composeEmailText(htmlToPlainText(sanitizedHtml)),
    html: wrapEmailHtml(sanitizedHtml),
  };
}

export function renderEmailTemplateBody(
  template: string,
  format: NotificationTemplateBodyFormat,
  variables: Record<string, string | number | null | undefined>,
) {
  const renderedTemplate = renderNotificationTemplate(
    template,
    escapeEmailVariables(variables, format),
  );
  return renderEmailBody(renderedTemplate, format);
}
