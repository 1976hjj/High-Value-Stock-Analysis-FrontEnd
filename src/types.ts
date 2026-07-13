export type ScenarioName = "bull" | "base" | "bear" | "crisis";

export interface Scenario {
  name: ScenarioName;
  roe_range: [number, number];
  profit_growth_range: [number, number];
  target_pb_range: [number, number];
  price_range: [number, number];
  scenario_probability: number;
  trigger_conditions: string[];
  macro_conditions: string[];
  bank_conditions: string[];
  valuation_trigger: string;
  current_fit: {
    assessment: string;
    supporting_signals: string[];
    gaps_or_watchpoints: string[];
  };
}

export interface ValuationResult {
  stock_code: string;
  stock_name: string;
  bank_profile: {
    bank_type: string;
    brief: string;
    logo_text: string;
    logo_tone: "navy" | "coral" | "mint" | "violet";
  };
  current_price: number;
  daily_change_pct: number | null;
  current_pb: number;
  market_date: string | null;
  financial_report_date: string | null;
  cost_of_equity: number;
  pb_percentile_3y: number;
  pb_percentile_5y: number;
  pb_percentile_10y: number;
  fair_pb_pb_roe: number;
  pb_roe_fair_price: number;
  dividend_floor_price: number | null;
  dividend_stress_floor_price: number | null;
  residual_income_price: number;
  residual_income_prices: Record<"3y" | "5y" | "10y", number>;
  input_snapshot: Record<string, number | string | boolean | null>;
  pb_history_chart: Array<{ date: string; pb: number; pe?: number | null; close: number | null }>;
  scenarios: Record<ScenarioName, Scenario>;
  scenario_probabilities: Record<ScenarioName, number>;
  upside_potential: number;
  downside_risk: number;
  margin_of_safety: number;
  risk_flags: string[];
  risk_analysis: {
    current_assessment: string;
    drivers: Array<{
      category: string;
      status: "stable" | "watch" | "risk";
      current_reading: string;
      why_it_matters: string;
      deterioration_signal: string;
      data_source: string;
    }>;
    market_conditions: string[];
  };
  defensive_decision: {
    buy_wait_price: number;
    buy_wait_gap: number;
    buy_wait_status: "reached" | "near" | "wait" | "avoid";
    buy_wait_reason: string;
    risk_light: "green" | "yellow" | "red";
    risk_light_label: string;
    risk_light_reasons: string[];
    stress_tests: Array<{
      name: string;
      stressed_price: number | null;
      downside: number | null;
      severity: "green" | "yellow" | "red";
      note: string;
    }>;
  };
  final_rating: "deep_value" | "watch" | "hold_income" | "value_trap_risk" | "avoid";
}

export interface MonteCarloResult {
  probability_price_down_20: number;
  probability_price_up_20: number;
  probability_price_below_bear_floor: number;
  probability_price_above_base_value: number;
  expected_price: number;
  p10_price: number;
  p50_price: number;
  p90_price: number;
}

export interface IndustryMetric {
  current_value: number;
  average: number;
  median: number;
  p25: number;
  p75: number;
  percentile: number;
  sample_size: number;
}

export interface IndustryBenchmark {
  industry_name: string;
  as_of_date: string;
  sample_size: number;
  metrics: Record<string, IndustryMetric>;
  data_note: string;
}

export interface IndustryAnalysisMetric {
  key: string;
  label: string;
  value: string;
  score: number;
  status: "strong" | "stable" | "watch" | "risk";
  source: string;
}

export interface IndustryPanoramaMetric {
  key: string;
  label: string;
  value: string;
  raw_value: number | null;
  score: number;
  status: "strong" | "stable" | "watch" | "risk";
  quality: "reported" | "derived" | "proxy";
  interpretation: string;
  source: string;
}

export interface IndustryPanoramaGroup {
  id: string;
  title: string;
  metrics: IndustryPanoramaMetric[];
}

export interface IndustryPanorama {
  report_date: string;
  published_date: string;
  coverage_ratio: number;
  groups: IndustryPanoramaGroup[];
}

export interface IndustryPriceScenario {
  id: "bull" | "base" | "bear" | "crisis";
  name: string;
  earnings_change: number;
  target_pe: number;
  dividend_yield_anchor: number | null;
  price_low: number;
  price_mid: number;
  price_high: number;
  return_low: number;
  return_mid: number;
  return_high: number;
  confidence: number;
  drivers: string[];
  triggers: string[];
  formula: string;
}

export interface IndustryPriceProjection {
  model_name: string;
  current_price: number;
  current_pe: number;
  implied_eps_ttm: number;
  market_date: string;
  report_date: string;
  scenarios: IndustryPriceScenario[];
  base_value_mid: number;
  defensive_entry_price: number;
  conclusion: string;
  assumptions: string[];
  data_note: string;
}

export interface IndustryAnalysisResult {
  module: "industry_analysis";
  industry_id: string;
  industry_name: string;
  stock_code: string;
  stock_name: string;
  market_date: string;
  valuation_date: string;
  current_price: number;
  daily_change_pct: number | null;
  current_pb: number | null;
  current_pe: number | null;
  pb_percentile_5y?: number | null;
  pe_percentile_5y?: number | null;
  valuation_metric: "pb" | "pe";
  valuation_percentile: number;
  scores: {
    defense: number;
    income: number;
    quality: number;
    valuation: number;
    risk: number;
    overall: number;
  };
  metrics: IndustryAnalysisMetric[];
  panorama?: IndustryPanorama | null;
  price_projection?: IndustryPriceProjection | null;
  risk_flags: string[];
  data_note: string;
}

export interface IndustryRankingRow {
  rank: number;
  stock_code: string;
  stock_name: string;
  market_date: string;
  report_date: string | null;
  overall_score: number;
  defense_score: number;
  quality_score: number;
  income_score: number;
  valuation_score: number;
  risk_score: number;
  valuation_percentile: number;
  key_metrics: IndustryPanoramaMetric[];
  risk_flags: string[];
}

export interface IndustryRankingResponse {
  module: "industry_ranking";
  industry_id: "hydro" | "consumer";
  valuation_date: string;
  result_count: number;
  results: IndustryRankingRow[];
  failures: Array<{ stock_code: string; stock_name?: string; error: string }>;
  data_note: string;
}

export interface BankMeanReversionRow {
  rank: number;
  stock_code: string;
  stock_name: string;
  bank_profile: ValuationResult["bank_profile"];
  market_date: string | null;
  current_price: number;
  current_pb: number;
  pb_percentile_5y: number;
  pb_discount_to_5y_median: number;
  mean_reversion_upside: number;
  upside_potential: number;
  margin_of_safety: number;
  dividend_yield: number;
  roe: number;
  profit_growth_yoy: number;
  npl_ratio: number | null;
  provision_coverage: number | null;
  cet1_ratio: number | null;
  quality_score: number;
  risk_score: number;
  mean_reversion_score: number;
  reversion_probability: number;
  dividend_safety_score: number;
  stable_growth_score: number;
  income_candidate_score: number;
  status:
    | "high_conviction_reversion"
    | "undervalued_watch"
    | "fair_value"
    | "risk_discount"
    | "overvalued";
  income_status:
    | "core_income"
    | "income_watch"
    | "yield_trap_risk"
    | "not_income_candidate";
  tags: string[];
  income_tags: string[];
  risk_flags: string[];
  thesis: string;
}

export interface BankMeanReversionOverview {
  module: string;
  title: string;
  as_of_date: string | null;
  count: number;
  investable_count: number;
  risky_count: number;
  income_candidate_count: number;
  yield_trap_count: number;
  failed_count: number;
  results: BankMeanReversionRow[];
  failures: Array<{ stock_code: string; error: string }>;
  data_note: string;
}

export type BacktestStrategyId = "income_core" | "value_reversion" | "defensive_rotation";

export interface StrategyBacktestQuery {
  universe_mode: "single" | "selected" | "all";
  industry_ids: string[];
  industry_weighting: "equal" | "risk_parity" | "score";
  max_industry_weight: number;
  crisis_cash_buffer: number;
  years: number;
  start_date?: string | null;
  end_date?: string | null;
  rebalance_frequency: "monthly" | "quarterly" | "semiannual" | "annual";
  holding_count: number;
  min_dividend_yield: number;
  min_dividend_safety: number;
  min_stable_growth: number;
  max_risk_score: number;
  max_payout_ratio: number;
  dividend_weight: number;
  safety_weight: number;
  growth_weight: number;
  valuation_weight: number;
  risk_penalty_weight: number;
  initial_capital: number;
  commission_rate: number;
  stamp_duty_rate: number;
  transfer_fee_rate: number;
  slippage_rate: number;
  cash_yield: number;
}

export interface BacktestHolding {
  stock_code: string;
  stock_name: string;
  industry_id?: string;
  weight: number;
  score: number;
  dividend_yield: number | null;
  risk_score: number;
  entry_date?: string | null;
  holding_days?: number;
  profit?: number;
  position_value?: number;
  cost_basis?: number;
  profit_return?: number;
  dividend_safety_score?: number | null;
  stable_growth_score?: number | null;
  quality_score?: number | null;
  valuation_percentile?: number | null;
  reversion_potential?: number | null;
}

export interface BacktestHoldingPriceSeries {
  stock_code: string;
  stock_name: string;
  entry_date: string;
  price_curve: Array<{ date: string; value: number }>;
  start_price: number;
  entry_price: number;
  current_price: number;
  high_price: number;
  low_price: number;
  price_return: number;
  estimated_shares: number;
}

export interface StrategyBacktestResult {
  strategy_id: BacktestStrategyId;
  strategy_name: string;
  description: string;
  metrics: {
    total_return: number;
    annualized_return: number;
    max_drawdown: number;
    max_drawdown_date: string;
    recovery_date: string | null;
    recovery_days: number | null;
    volatility: number;
    sharpe: number | null;
    calmar: number | null;
    win_year_rate: number;
    annual_dividend_return: number;
    turnover: number;
    rebalance_count: number;
    total_transaction_cost: number;
  };
  equity_curve: Array<{ date: string; value: number }>;
  drawdown_curve: Array<{ date: string; value: number }>;
  transaction_cost_curve?: Array<{ date: string; value: number }>;
  yearly_returns: Array<{ year: number; return_rate: number }>;
  current_holdings: BacktestHolding[];
  holding_snapshots?: Array<{
    date: string;
    holdings: BacktestHolding[];
  }>;
  selection_snapshots?: Array<{
    date: string;
    holdings: BacktestHolding[];
    candidate_count: number;
    cash_weight: number;
  }>;
  holding_price_series?: BacktestHoldingPriceSeries[];
}

export interface StrategyBacktestResponse {
  module: string;
  title: string;
  start_date: string;
  end_date: string;
  strategy_count: number;
  benchmark_note: string;
  data_note: string;
  benchmark_curve?: Array<{ date: string; value: number }>;
  selected_industry_ids?: string[];
  universe_size?: number;
  industry_allocation?: Record<string, number>;
  failures?: Array<{ stock_code: string; error: string }>;
  results: StrategyBacktestResult[];
}
