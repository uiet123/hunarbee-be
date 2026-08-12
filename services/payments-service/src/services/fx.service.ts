import {
  BASE_INR_PRICES,
  USD_FALLBACK_PRICES,
  AppError,
  env,
  isPaymentCurrency,
  roundConvertedAmount,
  type PaymentCurrency,
  type PaymentDurationId,
} from "@hunarbee/shared";

const CACHE_TTL_MS = 30 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;

/** All non-INR rates from ExchangeRate-API (INR base). */
type RateMap = Record<string, number>;

interface CachedRates {
  rates: RateMap;
  fetchedAt: number;
  source: string;
  asOf: string;
}

let cache: CachedRates | null = null;
let inflight: Promise<CachedRates> | null = null;

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`FX HTTP ${response.status}`);
    }
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Keep every positive conversion rate the provider returns. */
function pickRates(raw: Record<string, number> | undefined): RateMap {
  const rates: RateMap = {};
  if (!raw) return rates;

  for (const [code, value] of Object.entries(raw)) {
    if (code === "INR") continue;
    if (typeof value === "number" && value > 0 && isPaymentCurrency(code)) {
      rates[code] = value;
    }
  }
  return rates;
}

async function fetchFromExchangeRateApi(): Promise<CachedRates> {
  const key = env.EXCHANGE_RATE_API_KEY;
  if (!key) {
    throw new AppError(
      "EXCHANGE_RATE_API_KEY is not configured on the server",
      500
    );
  }

  const data = (await fetchJson(
    `https://v6.exchangerate-api.com/v6/${key}/latest/INR`
  )) as {
    result?: string;
    "error-type"?: string;
    time_last_update_utc?: string;
    conversion_rates?: Record<string, number>;
  };

  if (data.result && data.result !== "success") {
    throw new Error(
      `exchangerate-api error: ${data["error-type"] ?? data.result}`
    );
  }

  const rates = pickRates(data.conversion_rates);
  if (Object.keys(rates).length === 0) {
    throw new Error("exchangerate-api returned empty rates");
  }

  return {
    rates,
    fetchedAt: Date.now(),
    source: "exchangerate-api",
    asOf: data.time_last_update_utc ?? new Date().toISOString(),
  };
}

async function loadRates(): Promise<CachedRates> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache;
  }

  if (inflight) return inflight;

  inflight = (async () => {
    try {
      cache = await fetchFromExchangeRateApi();
      return cache;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

function convertPlansFromInr(
  rateFromInr: number
): Record<PaymentDurationId, number> {
  const plans = {} as Record<PaymentDurationId, number>;
  for (const durationId of Object.keys(BASE_INR_PRICES) as PaymentDurationId[]) {
    plans[durationId] = roundConvertedAmount(
      BASE_INR_PRICES[durationId],
      rateFromInr
    );
  }
  return plans;
}

function buildUsdFallback(
  asOf?: string,
  rateFromInr?: number | null
): CurrencyPricing {
  const plans =
    typeof rateFromInr === "number" && rateFromInr > 0
      ? convertPlansFromInr(rateFromInr)
      : { ...USD_FALLBACK_PRICES };

  return {
    currency: "USD",
    source: "fallback",
    provider: "usd-fallback",
    asOf: asOf ?? new Date().toISOString(),
    baseInr: { ...BASE_INR_PRICES },
    plans,
    rateFromInr: rateFromInr ?? null,
  };
}

export interface CurrencyPricing {
  currency: PaymentCurrency;
  source: "live" | "fallback";
  provider: string;
  asOf: string;
  baseInr: Record<PaymentDurationId, number>;
  plans: Record<PaymentDurationId, number>;
  rateFromInr: number | null;
}

export async function getCurrencyPricing(
  currency: PaymentCurrency
): Promise<CurrencyPricing> {
  const baseInr = { ...BASE_INR_PRICES };
  const code = currency.toUpperCase();

  if (code === "INR") {
    return {
      currency: "INR",
      source: "live",
      provider: "base",
      asOf: new Date().toISOString(),
      baseInr,
      plans: { ...BASE_INR_PRICES },
      rateFromInr: 1,
    };
  }

  try {
    const cached = await loadRates();
    const rate = cached.rates[code];

    if (rate) {
      return {
        currency: code,
        source: "live",
        provider: cached.source,
        asOf: cached.asOf,
        baseInr,
        plans: convertPlansFromInr(rate),
        rateFromInr: rate,
      };
    }

    console.warn(`[fx] No rate for ${code}; falling back to USD`);
    return buildUsdFallback(cached.asOf, cached.rates.USD ?? null);
  } catch (error) {
    console.error(`[fx] ExchangeRate-API failed; USD fallback:`, error);
    return buildUsdFallback();
  }
}

export async function getLivePlanPrice(
  currency: PaymentCurrency,
  durationId: PaymentDurationId
): Promise<{ amountMajor: number; pricing: CurrencyPricing }> {
  const pricing = await getCurrencyPricing(currency);
  return {
    amountMajor: pricing.plans[durationId],
    pricing,
  };
}
