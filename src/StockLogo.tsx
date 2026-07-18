import { useState } from "react";

import type { IndustryId } from "./industryConfig";

export const LOGO_ENABLED_INDUSTRY_IDS = [
  "telecom",
  "hydro",
  "tollroad",
  "nuclear",
  "oilgas",
  "resources",
  "consumer",
] as const satisfies readonly IndustryId[];

export const STOCK_LOGO_CODES = [
  "600941",
  "601728",
  "600050",
  "600900",
  "600025",
  "600674",
  "600886",
  "600236",
  "002039",
  "600377",
  "600350",
  "001965",
  "600012",
  "600548",
  "601985",
  "003816",
  "600938",
  "601857",
  "600028",
  "601088",
  "601225",
  "600188",
  "601899",
  "600547",
  "603993",
  "600519",
  "000858",
  "600887",
  "603288",
  "000333",
  "600690",
  "000568",
  "600600",
  "603195",
  "002032",
] as const;

const STOCK_LOGO_CODE_SET = new Set<string>(STOCK_LOGO_CODES);

type StockLogoProps = {
  stockCode: string;
  stockName: string;
  className?: string;
};

export function hasStockLogo(stockCode: string) {
  return STOCK_LOGO_CODE_SET.has(stockCode.match(/\d{6}/)?.[0] ?? stockCode);
}

export function StockLogo({ stockCode, stockName, className = "" }: StockLogoProps) {
  const normalizedCode = stockCode.match(/\d{6}/)?.[0] ?? stockCode;
  const [failed, setFailed] = useState(false);
  const showImage = hasStockLogo(normalizedCode) && !failed;

  return (
    <span className={`stock-logo ${className}`.trim()}>
      {showImage ? (
        <img
          src={`/stock-logos/${normalizedCode}.png`}
          alt={`${stockName} Logo`}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="stock-logo-fallback" role="img" aria-label={`${stockName} Logo`}>
          {stockName.slice(0, 2)}
        </span>
      )}
    </span>
  );
}
