import type {
  BankMeanReversionOverview,
  IndustryBenchmark,
  MonteCarloResult,
  StrategyBacktestQuery,
  StrategyBacktestResponse,
  ValuationResult,
} from "./types";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export interface LiveQuote {
  symbol: string;
  stock_code: string;
  stock_name: string;
  price: number;
  previous_close: number;
  open: number | null;
  high: number | null;
  low: number | null;
  change: number;
  change_pct: number;
  volume: number | null;
  amount: number | null;
  quote_date: string;
  quote_time: string;
  fetched_at: string;
  source: string;
}

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

const normalizeAshareCode = (stock_code: string) =>
  stock_code.match(/\d{6}/)?.[0] ?? stock_code;

const normalizeAshareSymbol = (stock_code: string) => {
  const digits = normalizeAshareCode(stock_code);
  const market = digits.startsWith("6") || digits.startsWith("9") ? "sh" : "sz";
  return `${market}${digits}`;
};

const parseNumber = (value: string | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const scriptQuote = (url: string, charset: string, readRaw: () => string | undefined) =>
  new Promise<string>((resolve, reject) => {
    const script = document.createElement("script");
    const timeout = window.setTimeout(() => {
      script.remove();
      reject(new Error("请求超时"));
    }, 8000);

    script.charset = charset;
    script.src = url;
    script.onload = () => {
      window.clearTimeout(timeout);
      const raw = readRaw();
      script.remove();
      raw ? resolve(raw) : reject(new Error("返回为空"));
    };
    script.onerror = () => {
      window.clearTimeout(timeout);
      script.remove();
      reject(new Error("网络失败"));
    };
    document.head.appendChild(script);
  });

function getSinaLiveQuote(stock_code: string): Promise<LiveQuote> {
  const symbol = normalizeAshareSymbol(stock_code);
  const globalName = `hq_str_${symbol}`;
  const url = `https://hq.sinajs.cn/rn=${Date.now()}&list=${symbol}`;

  return scriptQuote(url, "GBK", () => (window as unknown as Record<string, string | undefined>)[globalName])
    .then((raw) => {
      const fields = raw.split(",");
      const price = parseNumber(fields[3]);
      const previousClose = parseNumber(fields[2]);
      if (price === null || previousClose === null || previousClose <= 0) {
        throw new Error("数据异常");
      }

      const change = price - previousClose;
      return {
        symbol,
        stock_code: symbol.slice(2),
        stock_name: fields[0] || symbol,
        price,
        previous_close: previousClose,
        open: parseNumber(fields[1]),
        high: parseNumber(fields[4]),
        low: parseNumber(fields[5]),
        change,
        change_pct: change / previousClose,
        volume: parseNumber(fields[8]),
        amount: parseNumber(fields[9]),
        quote_date: fields[30] || "",
        quote_time: fields[31] || "",
        fetched_at: new Date().toISOString(),
        source: "Sina",
      };
    });
}

function getTencentLiveQuote(stock_code: string): Promise<LiveQuote> {
  const symbol = normalizeAshareSymbol(stock_code);
  const globalName = `v_${symbol}`;
  const url = `https://qt.gtimg.cn/r=${Date.now()}&q=${symbol}`;

  return scriptQuote(url, "GBK", () => (window as unknown as Record<string, string | undefined>)[globalName])
    .then((raw) => {
      const fields = raw.split("~");
      const price = parseNumber(fields[3]);
      const previousClose = parseNumber(fields[4]);
      if (price === null || previousClose === null || previousClose <= 0) {
        throw new Error("数据异常");
      }

      const rawTime = fields[30] ?? "";
      const quote_date = rawTime.length >= 8
        ? `${rawTime.slice(0, 4)}-${rawTime.slice(4, 6)}-${rawTime.slice(6, 8)}`
        : "";
      const quote_time = rawTime.length >= 14
        ? `${rawTime.slice(8, 10)}:${rawTime.slice(10, 12)}:${rawTime.slice(12, 14)}`
        : "";
      const change = parseNumber(fields[31]) ?? (price - previousClose);
      const changePct = parseNumber(fields[32]);

      return {
        symbol,
        stock_code: normalizeAshareCode(stock_code),
        stock_name: fields[1] || symbol,
        price,
        previous_close: previousClose,
        open: parseNumber(fields[5]),
        high: parseNumber(fields[33]),
        low: parseNumber(fields[34]),
        change,
        change_pct: changePct === null ? change / previousClose : changePct / 100,
        volume: parseNumber(fields[36]) === null ? null : Number(fields[36]) * 100,
        amount: parseNumber(fields[37]) === null ? null : Number(fields[37]) * 10_000,
        quote_date,
        quote_time,
        fetched_at: new Date().toISOString(),
        source: "Tencent",
      };
    });
}

export async function getLiveQuote(stock_code: string): Promise<LiveQuote> {
  const errors: string[] = [];
  for (const source of [getSinaLiveQuote, getTencentLiveQuote]) {
    try {
      return await source(stock_code);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "未知错误");
    }
  }
  throw new Error(`实时行情源均不可用：${errors.join(" / ")}`);
}
