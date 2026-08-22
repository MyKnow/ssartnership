import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import { BUG_REPORT_EMAIL } from "@/lib/site";
import type {
  NotificationTemplateBodyFormat,
} from "@/lib/notification-templates/catalog";
import { renderNotificationTemplate } from "@/lib/notification-templates/template";

export type RenderedEmailBody = {
  text: string;
  html: string;
};

export const EMAIL_HEADER_TEXT = "싸트너십";
const EMAIL_FOOTER_PREFIX =
  "자동으로 발송된 메일입니다. 문의 사항이 있다면";
const EMAIL_FOOTER_ACTION_TEXT = "답장해 주세요.";
export const EMAIL_FOOTER_TEXT =
  `${EMAIL_FOOTER_PREFIX} ${EMAIL_FOOTER_ACTION_TEXT}`;

type TransactionalEmailPanelTone = "info" | "success" | "warning";

export type TransactionalEmailPanel = Readonly<{
  tone: TransactionalEmailPanelTone;
  title?: string;
  body?: readonly string[];
  items?: readonly string[];
}>;

export type TransactionalEmailInput = Readonly<{
  preheader: string;
  kicker: string;
  title: string | readonly string[];
  titleSingleLine?: boolean;
  lead: readonly string[];
  code?: Readonly<{
    label: string;
    value: string;
    compact?: boolean;
  }>;
  panels?: readonly TransactionalEmailPanel[];
  action?: Readonly<{
    label: string;
    url: string;
  }>;
}>;

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

const EMAIL_FONT_STACK =
  "'Pretendard', 'Apple SD Gothic Neo', 'Noto Sans KR', Arial, sans-serif";

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

function renderEmailFooterHtml() {
  return `${escapeHtml(EMAIL_FOOTER_PREFIX)} <a href="mailto:${escapeHtml(BUG_REPORT_EMAIL)}" style="color: #405067; text-decoration: underline;">${escapeHtml(EMAIL_FOOTER_ACTION_TEXT)}</a>`;
}

function wrapEmailHtml(value: string, preheader?: string) {
  return `<style>
@media only screen and (max-width: 420px) {
  .ssartnership-email-outer { padding: 16px 10px !important; }
  .ssartnership-email-brand { padding: 18px 20px !important; }
  .ssartnership-email-content { padding: 30px 20px 26px !important; }
  .ssartnership-email-title { font-size: 23px !important; }
  .ssartnership-email-title-single { font-size: 18px !important; letter-spacing: -0.9px !important; }
  .ssartnership-email-code { font-size: 28px !important; letter-spacing: 5px !important; }
  .ssartnership-email-code-compact { font-size: 19px !important; letter-spacing: 1px !important; }
  .ssartnership-email-footer { padding: 19px 20px 22px !important; }
}
</style>${preheader ? `<div style="display: none; max-height: 0; overflow: hidden; opacity: 0; color: transparent; mso-hide: all;">${escapeHtml(preheader)}</div>` : ""}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin: 0; padding: 0; border-collapse: collapse; color: #152033; background: #f4f7fb; font-family: ${EMAIL_FONT_STACK};"><tbody><tr><td class="ssartnership-email-outer" align="center" style="padding: 34px 22px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 600px; margin: 0 auto; border: 1px solid #d8e0ea; border-collapse: separate; border-spacing: 0; border-radius: 14px; background: #ffffff;"><tbody><tr><td class="ssartnership-email-brand" style="padding: 22px 34px; border-bottom: 1px solid #e5ebf2;"><div aria-label="${escapeHtml(EMAIL_HEADER_TEXT)}" style="color: #152033; font-size: 20px; font-weight: 800; line-height: 1.15; letter-spacing: -0.9px;"><span style="color: #1ea6d7;">싸</span>트너십</div></td></tr><tr><td class="ssartnership-email-content" style="padding: 40px 34px 34px;">${value}</td></tr><tr><td class="ssartnership-email-footer" style="padding: 22px 34px 26px; border-top: 1px solid #e5ebf2; color: #64748b; background: #f9fbff; font-size: 10px; line-height: 1.65;">${renderEmailFooterHtml()}</td></tr></tbody></table></td></tr></tbody></table>`;
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

function getTransactionalPanelStyle(tone: TransactionalEmailPanelTone) {
  if (tone === "success") {
    return {
      border: "#badfd7",
      color: "#0b665f",
      background: "#e7f4f1",
    };
  }
  if (tone === "warning") {
    return {
      border: "#f1d18f",
      color: "#7c3b0c",
      background: "#fff6df",
    };
  }
  return {
    border: "transparent",
    color: "#405067",
    background: "#edf2f7",
  };
}

function renderTransactionalPanelHtml(panel: TransactionalEmailPanel) {
  const palette = getTransactionalPanelStyle(panel.tone);
  const title = panel.title
    ? `<strong style="display: block; margin: 0 0 4px; color: ${palette.color}; font-size: 13px; line-height: 1.5;">${escapeHtml(panel.title)}</strong>`
    : "";
  const body = panel.body?.length
    ? `<div>${panel.body.map((line) => escapeHtml(line)).join("<br />")}</div>`
    : "";
  const items = panel.items?.length
    ? `<ul style="margin: 8px 0 0; padding-left: 19px;">${panel.items.map((item) => `<li style="margin: 3px 0 0;">${escapeHtml(item)}</li>`).join("")}</ul>`
    : "";

  return `<div style="margin-top: 24px; padding: 16px 18px; border: 1px solid ${palette.border}; border-radius: 10px; color: ${palette.color}; background: ${palette.background}; font-size: 12px; line-height: 1.65;">${title}${body}${items}</div>`;
}

function renderTransactionalPanelText(panel: TransactionalEmailPanel) {
  return [
    panel.title,
    ...(panel.body ?? []),
    ...(panel.items ?? []).map((item) => `- ${item}`),
  ]
    .filter(Boolean)
    .join("\n");
}

function getSafeTransactionalActionUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("이메일 동작 URL이 올바르지 않습니다.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("이메일 동작 URL 프로토콜이 올바르지 않습니다.");
  }
  return escapeHtml(value);
}

export function renderTransactionalEmail(
  input: TransactionalEmailInput,
): RenderedEmailBody {
  const titleSegments = typeof input.title === "string"
    ? [input.title]
    : input.title;
  const titleHtml = titleSegments
    .map(
      (segment) =>
        `<span style="display: inline-block; white-space: nowrap;">${escapeHtml(segment)}</span>`,
    )
    .join(" ");
  const titleClass = input.titleSingleLine
    ? "ssartnership-email-title ssartnership-email-title-single"
    : "ssartnership-email-title";
  const leadHtml = input.lead.map((line) => escapeHtml(line)).join("<br />");
  const codeHtml = input.code
    ? `<div style="margin-top: 28px; padding: 24px 18px 21px; border: 1px solid #cad6e8; border-radius: 12px; background: #eef3fb; text-align: center;"><span class="ssartnership-email-code-label" style="display: block; margin: 0 0 8px; color: #53657e; font-size: 11px; font-weight: 700; line-height: 1.4; user-select: none; -webkit-user-select: none;">${escapeHtml(input.code.label)}</span><span class="ssartnership-email-code${input.code.compact ? " ssartnership-email-code-compact" : ""}" style="display: block; margin: 0; color: #172d53; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace; font-size: ${input.code.compact ? "22px" : "34px"}; font-weight: 800; line-height: 1.25; letter-spacing: ${input.code.compact ? "2px" : "8px"}; white-space: nowrap; user-select: all; -webkit-user-select: all; -webkit-touch-callout: default;">${escapeHtml(input.code.value)}</span></div>`
    : "";
  const panelsHtml = (input.panels ?? [])
    .map(renderTransactionalPanelHtml)
    .join("");
  const actionHtml = input.action
    ? `<div style="margin-top: 28px; text-align: right;"><a class="ssartnership-email-action" href="${getSafeTransactionalActionUrl(input.action.url)}" style="display: inline-block; padding: 14px 22px; border-radius: 9px; color: #f7fbff; background: #213b68; font-size: 14px; font-weight: 760; line-height: 1.35; text-decoration: none;">${escapeHtml(input.action.label)}</a></div>`
    : "";
  const contentHtml = `<p style="margin: 0 0 12px; color: #213b68; font-size: 11px; font-weight: 800; line-height: 1.4; letter-spacing: 0.9px;">${escapeHtml(input.kicker)}</p><h2 class="${titleClass}" style="margin: 0; color: #152033; font-size: 27px; font-weight: 800; line-height: 1.3; letter-spacing: -1px;${input.titleSingleLine ? " white-space: nowrap;" : ""}">${titleHtml}</h2><p style="margin: 15px 0 0; color: #405067; font-size: 14px; line-height: 1.75; letter-spacing: -0.15px;">${leadHtml}</p>${codeHtml}${panelsHtml}${actionHtml}`;
  const textParts = [
    input.kicker,
    titleSegments.join(" "),
    input.lead.join("\n"),
    input.code
      ? `${input.code.label}\n${input.code.value}`
      : "",
    ...(input.panels ?? []).map(renderTransactionalPanelText),
    input.action ? `${input.action.label}\n${input.action.url}` : "",
  ].filter(Boolean);

  return {
    text: composeEmailText(textParts.join("\n\n")),
    html: wrapEmailHtml(contentHtml, input.preheader),
  };
}

export function renderEmailBody(
  body: string,
  format: NotificationTemplateBodyFormat,
): RenderedEmailBody {
  if (format === "plain") {
    return {
      text: composeEmailText(body),
      html: wrapEmailHtml(
        `<div style="white-space: pre-wrap;">${escapeHtml(body)}</div>`,
      ),
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
