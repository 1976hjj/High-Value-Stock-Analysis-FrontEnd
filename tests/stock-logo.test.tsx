import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { INDUSTRIES } from "../src/industryConfig";
import {
  LOGO_ENABLED_INDUSTRY_IDS,
  STOCK_LOGO_CODES,
  StockLogo,
} from "../src/StockLogo";

const logoDirectory = join(process.cwd(), "public", "stock-logos");

describe("stock logo coverage", () => {
  it("has a normalized local PNG for every configured stock in all non-bank industries", () => {
    const enabledIds = new Set<string>(LOGO_ENABLED_INDUSTRY_IDS);
    const enabledIndustries = INDUSTRIES.filter((industry) => enabledIds.has(industry.id));
    const configuredCodes = enabledIndustries.flatMap((industry) => industry.stocks.map((stock) => stock.code));

    expect(enabledIndustries).toHaveLength(7);
    expect(configuredCodes).toHaveLength(35);
    expect(new Set(configuredCodes)).toEqual(new Set(STOCK_LOGO_CODES));

    for (const code of configuredCodes) {
      const png = readFileSync(join(logoDirectory, `${code}.png`));
      expect(png.subarray(0, 8).toString("hex"), `${code} must be a PNG`).toBe("89504e470d0a1a0a");
      expect(png.readUInt32BE(16), `${code} width`).toBe(256);
      expect(png.readUInt32BE(20), `${code} height`).toBe(256);
    }
  });

  it("uses the local asset and falls back cleanly after an image error", () => {
    render(<StockLogo stockCode="sh.600941" stockName="中国移动" />);

    const image = screen.getByAltText("中国移动 Logo");
    expect(image).toHaveAttribute("src", "/stock-logos/600941.png");

    fireEvent.error(image);
    expect(screen.getByRole("img", { name: "中国移动 Logo" })).toHaveTextContent("中国");
  });
});
