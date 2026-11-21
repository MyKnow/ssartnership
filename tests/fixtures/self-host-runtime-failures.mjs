const VITAL_NAMES = ["LCP", "INP", "CLS"];

function sampleKey(sample) {
  if (!sample || typeof sample !== "object" || Array.isArray(sample)) return null;
  if (Object.keys(sample).length !== 3 || !VITAL_NAMES.includes(sample.name) || sample.route !== "auth") return null;
  if (typeof sample.value !== "number" || !Number.isFinite(sample.value) || sample.value < 0 || sample.value > (sample.name === "CLS" ? 100 : 300_000)) return null;
  return JSON.stringify([sample.name, sample.route, sample.value]);
}

/** Only an isolated document with exactly one received sample per metric is proof. */
export function hasCompleteRuntimeVitalReceipt({ collectorDeltas, samples, fetchObservations, responseStatuses }) {
  return samples.length === 3 && fetchObservations.length === 3
    && responseStatuses.every((status) => status === 204)
    && VITAL_NAMES.every((name) => {
      const matchingSamples = samples.filter((sample) => sample?.name === name);
      if (collectorDeltas[name] !== 1 || matchingSamples.length !== 1) return false;
      const key = sampleKey(matchingSamples[0]);
      return key !== null && fetchObservations.filter((observation) =>
        observation.keepalive === true && observation.credentials === "omit" && sampleKey(observation.sample) === key,
      ).length === 1;
    });
}

/** Unknown transport evidence fails closed; an aborted event alone proves nothing. */
export function isExpectedRuntimeRequestFailure(item, evidence) {
  if (!item.aborted) return false;
  let url;
  try { url = new URL(item.url); } catch { return false; }
  if (url.origin !== evidence.origin) return false;
  const vitalEndpoint = `${evidence.origin}/api/web-vitals`;
  if (!url.pathname.startsWith("/api/web-vitals")) {
    return item.prefetch === true && item.method === "GET" && item.type === "fetch";
  }
  if (item.url !== vitalEndpoint || item.method !== "POST" || item.type !== "fetch" || !item.leaving) return false;
  const key = sampleKey(item.sample);
  return key !== null && hasCompleteRuntimeVitalReceipt(evidence)
    && evidence.samples.some((sample) => sampleKey(sample) === key);
}

/** Serialized into the synthetic browser before navigation. Does not change the wire request. */
export function observeNativeVitalFetch({ marker }) {
  const nativeFetch = window.fetch;
  window.fetch = function (...args) {
    try {
      const [input, init] = args;
      if (input === "/api/web-vitals" && init?.method === "POST" && typeof init.body === "string") {
        const sample = JSON.parse(init.body);
        // Keep even the fixture's console observation within the anonymous contract.
        if (sample && Object.keys(sample).length === 3 && ["LCP", "INP", "CLS"].includes(sample.name)
          && sample.route === "auth" && typeof sample.value === "number" && Number.isFinite(sample.value)) {
          window.console.debug(marker + JSON.stringify({
            sample, keepalive: init.keepalive === true, credentials: init.credentials === "omit" ? "omit" : "other",
          }));
        }
      }
    } catch { /* Observation must not change native fetch behavior. */ }
    return Reflect.apply(nativeFetch, this, args);
  };
}
