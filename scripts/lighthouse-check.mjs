#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import process from 'node:process';

const HOST = process.env.LIGHTHOUSE_HOST || '127.0.0.1';
const PORT = process.env.LIGHTHOUSE_PORT || '3333';
const BASE_URL = process.env.LIGHTHOUSE_URL || `http://${HOST}:${PORT}/`;
const MIN_SCORE = Number(process.env.LIGHTHOUSE_MIN_SCORE || '0.85');
const FORM_FACTOR = (process.env.LIGHTHOUSE_FORM_FACTOR || 'desktop').trim().toLowerCase();
const STATIC_PUBLIC_PATHS = [
  '/',
  '/suggest',
  '/legal/service',
  '/legal/privacy',
  '/auth/login',
  '/auth/signup',
  '/auth/reset',
];
const INTERNAL_PATH_PREFIXES = ['/admin/', '/api/', '/verify/'];
const INTERNAL_PATHS = new Set([
  '/notifications',
  '/certification',
  '/auth/consent',
  '/auth/change-password',
]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fileExists(path) {
  try {
    await access(path, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function detectChromePath() {
  if (process.env.CHROME_PATH) {
    return process.env.CHROME_PATH;
  }

  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/opt/google/chrome/chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];

  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      return candidate;
    }
  }

  return null;
}

function pipeChildOutput(child) {
  if (child.stdout) {
    child.stdout.on('data', (chunk) => {
      process.stdout.write(chunk);
    });
  }
  if (child.stderr) {
    child.stderr.on('data', (chunk) => {
      process.stderr.write(chunk);
    });
  }
}

function spawnCommand(command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
  pipeChildOutput(child);
  return child;
}

async function waitForResponse(url, timeoutMs = 120000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.ok) {
        return response;
      }
    } catch {
      // retry
    }

    await sleep(1000);
  }

  throw new Error(`URL이 준비되지 않았습니다: ${url}`);
}

async function waitForServer(child, url, timeoutMs = 120000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (child.exitCode !== null) {
      throw new Error(`서버가 조기 종료되었습니다. exitCode=${child.exitCode}`);
    }

    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.status < 500) {
        return;
      }
    } catch {
      // retry
    }

    await sleep(1000);
  }

  throw new Error(`서버가 준비되지 않았습니다: ${url}`);
}

function isAuditablePathname(pathname) {
  if (!pathname.startsWith('/')) {
    return false;
  }

  if (INTERNAL_PATHS.has(pathname)) {
    return false;
  }

  return !INTERNAL_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function resolveTargetUrl(pathname, baseUrl, sourceLabel) {
  try {
    return new globalThis.URL(pathname, baseUrl).toString();
  } catch (error) {
    const detail =
      error instanceof Error ? ` (${error.message})` : ` (${String(error)})`;
    throw new Error(
      `${sourceLabel}: invalid URL for pathname "${pathname}" against base "${baseUrl}"${detail}`,
    );
  }
}

function extractPathnamesFromSitemap(xml, baseUrl) {
  const pathnames = [];
  const locPattern = /<loc>([^<]+)<\/loc>/g;

  for (const match of xml.matchAll(locPattern)) {
    const loc = match[1]?.trim();
    if (!loc) {
      continue;
    }

    try {
      const pathname = new globalThis.URL(loc, baseUrl).pathname;
      if (isAuditablePathname(pathname)) {
        pathnames.push(pathname);
      }
    } catch {
      // ignore malformed sitemap entry
    }
  }

  return pathnames;
}

async function collectAuditTargets(baseUrl) {
  const targets = new Map();

  for (const pathname of STATIC_PUBLIC_PATHS) {
    if (isAuditablePathname(pathname)) {
      targets.set(
        pathname,
        resolveTargetUrl(pathname, baseUrl, `static target ${pathname}`),
      );
    }
  }

  const sitemapUrl = new globalThis.URL('/sitemap.xml', baseUrl).toString();
  const sitemapResponse = await waitForResponse(sitemapUrl);
  const sitemapXml = await sitemapResponse.text();
  const sitemapPathnames = extractPathnamesFromSitemap(sitemapXml, baseUrl);

  for (const pathname of sitemapPathnames) {
    try {
      targets.set(
        pathname,
        resolveTargetUrl(pathname, baseUrl, `sitemap target ${pathname}`),
      );
    } catch (error) {
      console.warn(error instanceof Error ? error.message : String(error));
    }
  }

  const verifyToken = process.env.LIGHTHOUSE_VERIFY_TOKEN?.trim();
  if (verifyToken) {
    const pathname = `/verify/${encodeURIComponent(verifyToken)}`;
    targets.set(
      pathname,
      resolveTargetUrl(pathname, baseUrl, `verify target ${pathname}`),
    );
  }

  return [...targets.entries()].map(([pathname, url]) => ({ pathname, url }));
}

function runLighthouse(url, chromePath) {
  return new Promise((resolve, reject) => {
    const lighthouseArgs = [
      '--no-install',
      'lighthouse',
      url,
      '--quiet',
      '--output=json',
      '--output-path=stdout',
      '--only-categories=performance',
      FORM_FACTOR === 'mobile' ? '--form-factor=mobile' : '--preset=desktop',
      '--chrome-flags=--headless=new --disable-gpu --disable-dev-shm-usage --no-sandbox',
    ];

    const child = spawn('npx', lighthouseArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        CHROME_PATH: chromePath,
      },
    });

    let stdout = '';
    let stderr = '';

    if (child.stdout) {
      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString('utf8');
      });
    }
    if (child.stderr) {
      child.stderr.on('data', (chunk) => {
        const text = chunk.toString('utf8');
        stderr += text;
        process.stderr.write(text);
      });
    }

    child.once('error', reject);
    child.once('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Lighthouse failed with exit code ${code}`));
        return;
      }

      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(
          new Error(
            `Lighthouse 결과를 파싱할 수 없습니다: ${
              error instanceof Error ? error.message : String(error)
            }`,
          ),
        );
      }
    });
  });
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null) {
    return;
  }

  child.kill('SIGTERM');
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (child.exitCode !== null) {
      return;
    }
    await sleep(250);
  }

  if (child.exitCode === null) {
    child.kill('SIGKILL');
  }
}

function formatScore(score) {
  return `${Math.round(score * 1000) / 10}%`;
}

function getAuditMetrics(report) {
  return {
    lcp: report?.audits?.['largest-contentful-paint']?.displayValue ?? 'n/a',
    tbt: report?.audits?.['total-blocking-time']?.displayValue ?? 'n/a',
    cls: report?.audits?.['cumulative-layout-shift']?.displayValue ?? 'n/a',
  };
}

async function main() {
  const chromePath = await detectChromePath();
  if (!chromePath) {
    throw new Error(
      'Google Chrome 또는 Chromium 실행 파일을 찾을 수 없습니다. CHROME_PATH를 설정하세요.',
    );
  }

  const server = spawnCommand('npm', [
    'run',
    'start',
    '--',
    '--hostname',
    HOST,
    '--port',
    PORT,
  ]);

  try {
    await waitForServer(server, BASE_URL);

    const targets = await collectAuditTargets(BASE_URL);
    if (!targets.length) {
      throw new Error('Lighthouse를 검사할 공개 페이지를 찾지 못했습니다.');
    }

    console.log(`Lighthouse will check ${targets.length} public pages`);
    for (const target of targets) {
      console.log(`- ${target.pathname}`);
    }

    let worstScore = Number.POSITIVE_INFINITY;
    let worstTarget = null;

    for (const target of targets) {
      console.log(`Running Lighthouse: ${target.pathname}`);
      const report = await runLighthouse(target.url, chromePath);
      const performanceScore = report?.categories?.performance?.score;

      if (typeof performanceScore !== 'number') {
        throw new Error(`${target.pathname}: Lighthouse performance 점수를 읽을 수 없습니다.`);
      }

      const scorePercent = formatScore(performanceScore);
      if (performanceScore < worstScore) {
        worstScore = performanceScore;
        worstTarget = target.pathname;
      }

      if (performanceScore < MIN_SCORE) {
        const { lcp, tbt, cls } = getAuditMetrics(report);
        throw new Error(
          [
            `Lighthouse performance 점수가 기준보다 낮습니다: ${target.pathname}`,
            `score=${scorePercent} threshold=${Math.round(MIN_SCORE * 100)}%`,
            `LCP=${lcp}`,
            `TBT=${tbt}`,
            `CLS=${cls}`,
          ].join('\n'),
        );
      }

      console.log(
        `Passed ${target.pathname}: ${scorePercent} (threshold ${Math.round(MIN_SCORE * 100)}%)`,
      );
    }

    console.log(
      `Lighthouse performance passed for ${targets.length} public pages. ` +
        `Worst page: ${worstTarget ?? 'n/a'} (${formatScore(worstScore)})`,
    );
  } finally {
    await stopProcess(server);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
