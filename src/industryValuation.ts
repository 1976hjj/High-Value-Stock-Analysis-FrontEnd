import type { IndustryAnalysisResult } from "./types";

const isFiniteNumber = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);

const formatPercentile = (value: number | null) =>
  value === null ? "暂无" : `${(value * 100).toFixed(1)}%`;

export function industryValuationPercentiles(analysis: IndustryAnalysisResult | null) {
  if (!analysis) return "分析后显示 PE / PB 五年分位";

  const pePercentile = isFiniteNumber(analysis.pe_percentile_5y)
    ? analysis.pe_percentile_5y
    : analysis.valuation_metric === "pe"
      ? analysis.valuation_percentile
      : null;
  const pbPercentile = isFiniteNumber(analysis.pb_percentile_5y)
    ? analysis.pb_percentile_5y
    : analysis.valuation_metric === "pb"
      ? analysis.valuation_percentile
      : null;

  return `PE 五年分位 ${formatPercentile(pePercentile)} · PB 五年分位 ${formatPercentile(pbPercentile)}`;
}
