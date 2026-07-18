import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProfitContributionTable } from "../src/App";
import type { BacktestProfitContributionPeriod } from "../src/types";

const period: BacktestProfitContributionPeriod = {
  period_type: "total",
  year: null,
  start_date: "2021-01-04",
  end_date: "2025-12-31",
  start_value: 100_000,
  end_value: 105_000,
  net_profit: 5_000,
  stock_net_profit: 4_800,
  cash_profit: 200,
  return_rate: 0.05,
  reconciliation_error: 0,
  stocks: [
    {
      stock_code: "sh.600519",
      stock_name: "贵州茅台",
      industry_id: "consumer",
      net_profit: 3_000,
      price_profit: 2_700,
      dividend_profit: 400,
      transaction_cost: 100,
      return_contribution: 0.03,
    },
    {
      stock_code: "sh.600887",
      stock_name: "伊利股份",
      industry_id: "consumer",
      net_profit: 1_800,
      price_profit: 1_700,
      dividend_profit: 150,
      transaction_cost: 50,
      return_contribution: 0.018,
    },
  ],
};

describe("ProfitContributionTable", () => {
  it("shows every involved stock and the reconciled contribution breakdown", () => {
    render(<ProfitContributionTable period={period} title="回测全周期股票利润贡献" />);

    expect(screen.getByText("回测全周期股票利润贡献")).toBeInTheDocument();
    expect(screen.getByText(/共涉及 2 只股票/)).toBeInTheDocument();
    expect(screen.getByText("贵州茅台")).toBeInTheDocument();
    expect(screen.getByText("伊利股份")).toBeInTheDocument();
    expect(screen.getByText("收益贡献 +3.0%")).toBeInTheDocument();
    expect(screen.getByText("收益贡献 +1.8%")).toBeInTheDocument();
    expect(screen.getAllByText("已从净利润扣除")).toHaveLength(2);
    expect(screen.getByText(/净利润 = 价格盈亏 \+ 分红贡献 − 交易成本/)).toBeInTheDocument();
  });
});
