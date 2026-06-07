type CachedJsonResult<T> = {
  ok: boolean;
  payload: T;
  status: number;
};

type CacheEntry<T> = {
  expiresAt: number;
  payload: T;
};

const payloadCache = new Map<string, CacheEntry<unknown>>();
const inFlightRequests = new Map<string, Promise<CachedJsonResult<unknown>>>();

export function getCachedJson<T>(url: string) {
  const entry = payloadCache.get(url);

  if (!entry || entry.expiresAt <= Date.now()) {
    return null;
  }

  return entry.payload as T;
}

export async function fetchCachedJson<T>(url: string, ttlMs: number) {
  const cachedPayload = getCachedJson<T>(url);

  if (cachedPayload) {
    return {
      ok: true,
      payload: cachedPayload,
      status: 200,
    } satisfies CachedJsonResult<T>;
  }

  const inFlight = inFlightRequests.get(url) as Promise<CachedJsonResult<T>> | undefined;

  if (inFlight) {
    return inFlight;
  }

  const request = fetch(url)
    .then(async (response) => {
      const payload = (await response.json()) as T;
      const result = {
        ok: response.ok,
        payload,
        status: response.status,
      } satisfies CachedJsonResult<T>;

      if (response.ok) {
        payloadCache.set(url, {
          expiresAt: Date.now() + ttlMs,
          payload,
        });
      }

      return result;
    })
    .finally(() => {
      inFlightRequests.delete(url);
    });

  inFlightRequests.set(url, request);

  return request;
}
