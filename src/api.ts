import type {
  BankMeanReversionOverview,
  IndustryBenchmark,
  MonteCarloResult,
  StrategyBacktestQuery,
  StrategyBacktestResponse,
  ValuationResult,
} from "./types";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const startedAt = performance.now();
  console.info(`[Bank Valuation] request → ${path}`, options?.body);
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      headers: { "Content-Type": "application/json", ...options?.headers },
      ...options,
    });
  } catch (err) {
    console.error(`[Bank Valuation] network failed ← ${path}`, err);
    throw new Error("无法连接后端服务。请确认后端已在 8000 端口启动，然后重试。");
  }
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    console.error(`[Bank Valuation] request failed ← ${path}`, { status: response.status, detail: error?.detail });
    throw new Error(error?.detail || `请求失败（${response.status}）`);
  }
  const data = await response.json() as T;
  console.info(`[Bank Valuation] response ← ${path} (${Math.round(performance.now() - startedAt)}ms)`, data);
  return data;
}

export function getValuation(stock_code: string, valuation_date?: string, refresh_cache = false) {
  return request<ValuationResult>("/api/bank/valuation", {
    method: "POST", body: JSON.stringify({ stock_code, valuation_date: valuation_date || null, refresh_cache }),
  });
}

export function getMonteCarlo(stock_code: string, valuation_date?: string, refresh_cache = false) {
  return request<MonteCarloResult>("/api/bank/monte-carlo", {
    method: "POST", body: JSON.stringify({ stock_code, valuation_date: valuation_date || null, refresh_cache }),
  });
}

export function getIndustryBenchmark(stock_code: string, valuation_date?: string, refresh_cache = false) {
  return request<IndustryBenchmark>("/api/bank/industry-benchmark", {
    method: "POST", body: JSON.stringify({ stock_code, valuation_date: valuation_date || null, refresh_cache }),
  });
}

export function getMeanReversionOverview(
  valuation_date?: string,
  refresh_cache = false,
  include_risky = true,
) {
  return request<BankMeanReversionOverview>("/api/bank/mean-reversion-overview", {
    method: "POST",
    body: JSON.stringify({
      valuation_date: valuation_date || null,
      refresh_cache,
      include_risky,
    }),
  });
}

export function getStrategyBacktest(params: StrategyBacktestQuery) {
  return request<StrategyBacktestResponse>("/api/bank/strategy-backtest", {
    method: "POST",
    body: JSON.stringify(params),
  });
}
