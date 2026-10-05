export type RssFeedItem = {
  title: string;
  link: string;
  description: string;
  /**
   * When the item was published. An unknown date is left out of the feed
   * instead of being replaced with the request time, which would make every
   * fetch look like new posts to feed readers.
   */
  pubDate?: Date | string | null;
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
  /** Defaults to the newest item pubDate; omitted when no item has a date. */
  lastBuildDate?: Date | string | null;
};

export function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function parseRssDate(value: Date | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function resolveLastBuildDate(
  items: readonly RssFeedItem[],
  lastBuildDate: RssFeedOptions["lastBuildDate"],
) {
  if (lastBuildDate !== undefined) {
    return parseRssDate(lastBuildDate);
  }
  let newest: Date | null = null;
  for (const item of items) {
    const date = parseRssDate(item.pubDate);
    if (date && (!newest || date.getTime() > newest.getTime())) {
      newest = date;
    }
  }
  return newest;
}

export function buildRssFeedXml({
  title,
  link,
  description,
  items,
  language = "ko-KR",
  selfLink,
  lastBuildDate,
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
      const pubDate = parseRssDate(item.pubDate);
      const pubDateTag = pubDate
        ? `\n      <pubDate>${pubDate.toUTCString()}</pubDate>`
        : "";
      return `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.link)}</link>
      <guid isPermaLink="true">${guid}</guid>
      <description>${escapeXml(item.description)}</description>${pubDateTag}${categoryTag}
    </item>`;
    })
    .join("\n");
  const builtAt = resolveLastBuildDate(items, lastBuildDate);
  const lastBuildDateTag = builtAt
    ? `\n    <lastBuildDate>${builtAt.toUTCString()}</lastBuildDate>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"${atomNamespace}>
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${escapeXml(link)}</link>
    <description>${escapeXml(description)}</description>
    <language>${escapeXml(language)}</language>${lastBuildDateTag}${selfLinkTag}
${renderedItems ? `${renderedItems}\n` : ""}  </channel>
</rss>
`;
}
