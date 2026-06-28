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
  pb_history_chart: Array<{ date: string; pb: number; close: number | null }>;
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
