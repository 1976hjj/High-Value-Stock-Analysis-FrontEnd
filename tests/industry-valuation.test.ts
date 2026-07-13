import { describe, expect, it } from "vitest";

import { industryValuationPercentiles } from "../src/industryValuation";
import type { IndustryAnalysisResult } from "../src/types";

describe("industryValuationPercentiles", () => {
  it("shows both PE and PB five-year percentiles when the API provides them", () => {
    const analysis = {
      valuation_metric: "pe",
      valuation_percentile: 0.396,
      pe_percentile_5y: 0.396,
      pb_percentile_5y: 0.274,
    } as IndustryAnalysisResult;

    expect(industryValuationPercentiles(analysis)).toBe(
      "PE 五年分位 39.6% · PB 五年分位 27.4%",
    );
  });

  it("keeps the legacy primary percentile and marks the other metric unavailable", () => {
    const analysis = {
      valuation_metric: "pb",
      valuation_percentile: 0.31,
    } as IndustryAnalysisResult;

    expect(industryValuationPercentiles(analysis)).toBe(
      "PE 五年分位 暂无 · PB 五年分位 31.0%",
    );
  });
});
