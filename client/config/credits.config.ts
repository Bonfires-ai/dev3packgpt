// Credit packs on the home page's "Buy credits". Safe for the browser.
// A pack's price, in USDC, buys that much OpenRouter credit less the service fee.
export const CREDIT_PACKS_USD = [1, 4, 12] as const;
export const SERVICE_FEE_BPS = 500;

/** Dollars of OpenRouter credit a pack adds. */
export const packCreditUsd = (usd: number) => Math.floor(usd * (10_000 - SERVICE_FEE_BPS)) / 10_000;

/** Credits as the page shows them: a dollar is 100. */
export const toCredits = (usd: number) => Math.floor(usd * 100);
