import process from "node:process";

const baseUrl = process.env.RSS_REFRESH_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3000";
const secret = process.env.CRON_SECRET;

if (!secret) {
  console.error("CRON_SECRET is required.");
  process.exit(1);
}

const url = new URL("/api/cron/rss", baseUrl).toString();

const response = await fetch(url, {
  headers: {
    authorization: `Bearer ${secret}`,
  },
});

if (!response.ok) {
  const body = await response.text();
  console.error(body);
  process.exit(response.status);
}

const payload = await response.json();
console.log(JSON.stringify(payload, null, 2));
