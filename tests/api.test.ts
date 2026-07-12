import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getIndustryAnalysis,
  getIndustryRanking,
  getStrategyBacktest,
  prepareStrategyBacktest,
} from "../src/api";
import type { StrategyBacktestQuery } from "../src/types";

const baseQuery: StrategyBacktestQuery = {
  universe_mode: "single",
  industry_ids: ["bank"],
  industry_weighting: "risk_parity",
  max_industry_weight: 0.3,
  crisis_cash_buffer: 0.1,
  years: 3,
  start_date: null,
  end_date: "2026-07-10",
  rebalance_frequency: "quarterly",
  holding_count: 12,
  min_dividend_yield: 0.03,
  min_dividend_safety: 55,
  min_stable_growth: 45,
  max_risk_score: 45,
  max_payout_ratio: 0.8,
  dividend_weight: 0.25,
  safety_weight: 0.25,
  growth_weight: 0.2,
  valuation_weight: 0.15,
  risk_penalty_weight: 0.15,
  initial_capital: 1_000_000,
  commission_rate: 0.0002,
  stamp_duty_rate: 0.0005,
  transfer_fee_rate: 0.00001,
  slippage_rate: 0.0001,
  cash_yield: 0.015,
};

const okResponse = (body: unknown) => ({
  ok: true,
  status: 200,
  json: vi.fn().mockResolvedValue(body),
}) as unknown as Response;

describe("front-end API routing", () => {
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("keeps a bank-only backtest on the legacy bank endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse({ results: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await getStrategyBacktest(baseQuery);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [path, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(options.body as string);
    expect(path).toBe("/api/bank/strategy-backtest");
    expect(payload.industry_ids).toBeUndefined();
    expect(payload.universe_mode).toBeUndefined();
    expect(payload.crisis_cash_buffer).toBeUndefined();
    expect(payload.holding_count).toBe(12);
  });

  it("routes a selected multi-industry backtest to the generic engine", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse({ results: [] }));
    vi.stubGlobal("fetch", fetchMock);
    const query = {
      ...baseQuery,
      universe_mode: "selected" as const,
      industry_ids: ["telecom", "hydro"],
      max_industry_weight: 0.45,
    };

    await getStrategyBacktest(query);

    const [path, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(options.body as string);
    expect(path).toBe("/api/strategy/backtest");
    expect(payload.industry_ids).toEqual(["telecom", "hydro"]);
    expect(payload.crisis_cash_buffer).toBe(0.1);
  });

  it("uses the prepare endpoint for a full-industry data warm-up", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse({ results: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await prepareStrategyBacktest({
      ...baseQuery,
      universe_mode: "all",
      industry_ids: ["telecom", "hydro", "bank", "tollroad", "nuclear", "oilgas", "resources", "consumer"],
      holding_count: 16,
    });

    expect(fetchMock.mock.calls[0][0]).toBe("/api/strategy/backtest/prepare");
  });

  it("sends the industry and stock identity to the generic analysis endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse({ module: "industry_analysis" }));
    vi.stubGlobal("fetch", fetchMock);

    await getIndustryAnalysis("telecom", "600941", "2026-07-10", true);

    const [path, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/api/industry/analysis");
    expect(JSON.parse(options.body as string)).toEqual({
      industry_id: "telecom",
      stock_code: "600941",
      valuation_date: "2026-07-10",
      refresh_cache: true,
    });
  });

  it("loads a point-in-time peer ranking without calling the backtest API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse({ module: "industry_ranking", results: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await getIndustryRanking("consumer", "2026-07-11");

    const [path, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/api/industry/ranking");
    expect(JSON.parse(options.body as string)).toEqual({
      industry_id: "consumer",
      valuation_date: "2026-07-11",
      refresh_cache: false,
    });
  });

  it("renders FastAPI validation arrays as readable messages", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: vi.fn().mockResolvedValue({ detail: [{ msg: "行业上限不可行" }, { msg: "持仓数不足" }] }),
    } as unknown as Response));

    await expect(getIndustryAnalysis("telecom", "bad")).rejects.toThrow("行业上限不可行；持仓数不足");
  });
});
