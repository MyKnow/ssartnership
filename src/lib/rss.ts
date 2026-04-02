export type RssFeedItem = {
  title: string;
  link: string;
  description: string;
  pubDate: Date | string;
  category?: string;
  guid?: string;
};

export type RssFeedOptions = {
  title: string;
  link: string;
  description: string;
  items: RssFeedItem[];
  language?: string;
  selfLink?: string;
  lastBuildDate?: Date | string;
};

export function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatRssDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date().toUTCString();
  }
  return date.toUTCString();
}

export function buildRssFeedXml({
  title,
  link,
  description,
  items,
  language = "ko-KR",
  selfLink,
  lastBuildDate = new Date(),
}: RssFeedOptions) {
  const atomNamespace = selfLink
    ? '\n  xmlns:atom="http://www.w3.org/2005/Atom"'
    : "";
  const selfLinkTag = selfLink
    ? `\n    <atom:link href="${escapeXml(selfLink)}" rel="self" type="application/rss+xml" />`
    : "";
  const renderedItems = items
    .map((item) => {
      const categoryTag = item.category
        ? `\n      <category>${escapeXml(item.category)}</category>`
        : "";
      const guid = escapeXml(item.guid ?? item.link);
      return `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.link)}</link>
      <guid isPermaLink="true">${guid}</guid>
      <description>${escapeXml(item.description)}</description>
      <pubDate>${formatRssDate(item.pubDate)}</pubDate>${categoryTag}
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"${atomNamespace}>
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${escapeXml(link)}</link>
    <description>${escapeXml(description)}</description>
    <language>${escapeXml(language)}</language>
    <lastBuildDate>${formatRssDate(lastBuildDate)}</lastBuildDate>${selfLinkTag}
${renderedItems ? `${renderedItems}\n` : ""}  </channel>
</rss>
`;
}
