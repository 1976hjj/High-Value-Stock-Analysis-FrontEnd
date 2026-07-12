import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  IndustryTabs,
  IndustryUniverseBuilder,
  IndustryWorkspace,
} from "../src/IndustryWorkspace";
import { INDUSTRY_MAP } from "../src/industryConfig";
import type { IndustryAnalysisResult, IndustryPriceScenario, StrategyBacktestQuery } from "../src/types";

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

const sampleScenario = (id: IndustryPriceScenario["id"], name: string, mid: number, returnMid: number): IndustryPriceScenario => ({
  id,
  name,
  earnings_change: id === "bull" ? .15 : id === "base" ? .05 : id === "bear" ? -.15 : -.38,
  target_pe: id === "bull" ? 22 : id === "base" ? 19 : id === "bear" ? 14 : 10,
  dividend_yield_anchor: id === "bull" ? .025 : id === "base" ? .035 : id === "bear" ? .05 : .065,
  price_low: mid * .9,
  price_mid: mid,
  price_high: mid * 1.1,
  return_low: returnMid - .1,
  return_mid: returnMid,
  return_high: returnMid + .1,
  confidence: id === "crisis" ? .65 : .82,
  drivers: ["真实财报指标"],
  triggers: ["收入与利润满足该情景"],
  formula: "情景价 = 情景EPS×目标PE + 股息锚加权",
});

const consumerAutomatedAnalysis: IndustryAnalysisResult = {
  module: "industry_analysis",
  industry_id: "consumer",
  industry_name: "消费龙头",
  stock_code: "600519",
  stock_name: "贵州茅台",
  market_date: "2026-07-10",
  valuation_date: "2026-07-11",
  current_price: 1210,
  daily_change_pct: 0.003,
  current_pb: 8.2,
  current_pe: 18.3,
  valuation_metric: "pe",
  valuation_percentile: 0.31,
  scores: { defense: 84, income: 73, quality: 92, valuation: 69, risk: 18, overall: 84 },
  metrics: [],
  panorama: {
    report_date: "2026-03-31",
    published_date: "2026-04-25",
    coverage_ratio: 1,
    groups: [{
      id: "brand",
      title: "品牌与需求代理",
      metrics: [{
        key: "revenue",
        label: "报告期营业收入",
        value: "539.09 亿元",
        raw_value: 53_909_240_854,
        score: 81,
        status: "stable",
        quality: "derived",
        interpretation: "收入由净利润与净利率自动反算。",
        source: "Baostock 2026-03-31 财务报告",
      }, {
        key: "revenue_growth", label: "营业收入同比", value: "6.5%", raw_value: .065, score: 68, status: "stable", quality: "derived", interpretation: "收入增长代理需求。", source: "财报计算",
      }, {
        key: "profit_growth", label: "归母净利润同比", value: "1.4%", raw_value: .014, score: 58, status: "watch", quality: "reported", interpretation: "利润增速低于收入。", source: "财报原值",
      }, {
        key: "gross_margin", label: "毛利率", value: "89.8%", raw_value: .898, score: 95, status: "strong", quality: "reported", interpretation: "毛利率较高。", source: "财报原值",
      }],
    }, {
      id: "channel", title: "渠道与营运资本", metrics: [
        { key: "inventory_days", label: "存货周转天数", value: "995.6 天", raw_value: 995.6, score: 40, status: "risk", quality: "reported", interpretation: "需按白酒品类解释。", source: "财报原值" },
        { key: "cfo_to_revenue", label: "经营现金流/收入", value: "49.9%", raw_value: .499, score: 90, status: "strong", quality: "reported", interpretation: "回款较强。", source: "财报原值" },
      ],
    }, {
      id: "finance", title: "财务与资本回报", metrics: [
        { key: "roe_annualized", label: "年化 ROE", value: "42.3%", raw_value: .423, score: 95, status: "strong", quality: "derived", interpretation: "资本回报较高。", source: "财报计算" },
        { key: "cfo_to_np", label: "经营现金流/净利润", value: "0.96×", raw_value: .956, score: 72, status: "stable", quality: "reported", interpretation: "现金转换稳定。", source: "财报原值" },
      ],
    }, {
      id: "value", title: "股东回报与估值", metrics: [
        { key: "dividend_yield", label: "近12月股息率", value: "4.3%", raw_value: .043, score: 78, status: "stable", quality: "derived", interpretation: "实际分红收益率。", source: "分红与行情" },
        { key: "valuation_percentile", label: "近五年估值分位", value: "31.0%", raw_value: .31, score: 80, status: "stable", quality: "derived", interpretation: "处于中低分位。", source: "行情计算" },
      ],
    }],
  },
  price_projection: {
    model_name: "消费 EPS-PE + 现金分红交叉情景模型",
    current_price: 1210,
    current_pe: 18.3,
    implied_eps_ttm: 66.12,
    market_date: "2026-07-10",
    report_date: "2026-03-31",
    scenarios: [
      sampleScenario("bull", "需求与品牌共振", 1580, .306),
      sampleScenario("base", "稳健复购基准", 1450, .198),
      sampleScenario("bear", "需求降级与折扣", 910, -.248),
      sampleScenario("crisis", "品牌或渠道危机", 620, -.488),
    ],
    base_value_mid: 1450,
    defensive_entry_price: 900,
    conclusion: "基准价值高于现价，可进入风险复核。",
    assumptions: ["以当前价和PE反推EPS"],
    data_note: "价格区间不是未来股价保证。",
  },
  risk_flags: [],
  data_note: "自动财务全景已接入。",
};

const resourceAutomatedAnalysis: IndustryAnalysisResult = {
  ...consumerAutomatedAnalysis,
  industry_id: "resources",
  industry_name: "煤炭金属资源",
  stock_code: "601088",
  stock_name: "中国神华",
  current_price: 42.04,
  current_pb: 1.9,
  current_pe: 17.68,
  valuation_metric: "pb",
  valuation_percentile: .38,
  panorama: {
    report_date: "2026-03-31",
    published_date: "2026-04-25",
    coverage_ratio: 1,
    groups: [
      { id: "cycle", title: "商品周期与盈利弹性", metrics: [
        { key: "commodity_revenue_proxy", label: "商品景气收入代理", value: "-8.2%", raw_value: -.082, score: 48, status: "watch", quality: "proxy", interpretation: "不冒充现货煤价。", source: "财报" },
        { key: "commodity_profit_proxy", label: "商品景气利润代理", value: "-12.0%", raw_value: -.12, score: 50, status: "watch", quality: "proxy", interpretation: "利润周期代理。", source: "财报" },
        { key: "gross_margin", label: "毛利率", value: "34.5%", raw_value: .345, score: 76, status: "stable", quality: "reported", interpretation: "成本吸收代理。", source: "财报" },
      ] },
      { id: "cost", title: "成本曲线与运营效率代理", metrics: [{ key: "inventory_days", label: "存货周转天数", value: "42.0 天", raw_value: 42, score: 80, status: "stable", quality: "reported", interpretation: "库存效率。", source: "财报" }] },
      { id: "balance", title: "资产负债表与资本纪律", metrics: [
        { key: "cfo_to_np", label: "经营现金流/净利润", value: "1.18×", raw_value: 1.18, score: 86, status: "strong", quality: "reported", interpretation: "现金转换。", source: "财报" },
        { key: "liability_ratio", label: "资产负债率", value: "25.6%", raw_value: .256, score: 91, status: "strong", quality: "reported", interpretation: "低杠杆。", source: "财报" },
        { key: "asset_growth", label: "总资产同比", value: "3.0%", raw_value: .03, score: 82, status: "strong", quality: "reported", interpretation: "扩张克制。", source: "财报" },
      ] },
      { id: "return", title: "股东回报与周期估值", metrics: [
        { key: "dividend_cash_ttm", label: "近12月每股现金分红", value: "¥2.260/股", raw_value: 2.26, score: 90, status: "strong", quality: "reported", interpretation: "实际实施分红。", source: "分红记录" },
        { key: "dividend_yield", label: "近12月股息率", value: "5.4%", raw_value: .054, score: 84, status: "strong", quality: "derived", interpretation: "实际股息率。", source: "分红与行情" },
        { key: "valuation_percentile", label: "近五年估值分位", value: "38.0%", raw_value: .38, score: 76, status: "stable", quality: "derived", interpretation: "PB分位。", source: "行情" },
      ] },
    ],
  },
  price_projection: {
    model_name: "资源中周期 EPS-PE + 可持续股息锚情景模型",
    current_price: 42.04,
    current_pe: 17.68,
    implied_eps_ttm: 2.378,
    market_date: "2026-07-10",
    report_date: "2026-03-31",
    scenarios: [sampleScenario("bull", "供给约束与商品上行", 45, .07), sampleScenario("base", "中周期价格基准", 32.59, -.225), sampleScenario("bear", "需求收缩与去库存", 22, -.477), sampleScenario("crisis", "政策、事故或价格崩塌", 15, -.643)],
    base_value_mid: 32.59,
    defensive_entry_price: 20.83,
    conclusion: "当前价格已透支部分周期基本面，优先等待。",
    assumptions: ["峰值盈利向中周期收敛"],
    data_note: "价格区间不是未来股价保证。",
  },
};

const oilGasAutomatedAnalysis: IndustryAnalysisResult = {
  ...resourceAutomatedAnalysis,
  industry_id: "oilgas",
  industry_name: "综合油气",
  stock_code: "600938",
  stock_name: "中国海油",
  current_price: 28.15,
  current_pb: 1.65,
  current_pe: 10.73,
  valuation_metric: "pe",
  valuation_percentile: .41,
  panorama: {
    report_date: "2026-03-31",
    published_date: "2026-04-25",
    coverage_ratio: .963,
    groups: [
      { id: "upstream", title: "油价与上游盈利代理", metrics: [
        { key: "oil_revenue_proxy", label: "油气景气收入代理", value: "-4.8%", raw_value: -.048, score: 54, status: "watch", quality: "proxy", interpretation: "不冒充Brent油价。", source: "财报" },
        { key: "oil_profit_proxy", label: "上游盈利弹性代理", value: "-9.2%", raw_value: -.092, score: 52, status: "watch", quality: "proxy", interpretation: "油价利润代理。", source: "财报" },
        { key: "gross_margin", label: "综合毛利率", value: "48.0%", raw_value: .48, score: 90, status: "strong", quality: "reported", interpretation: "成本优势代理。", source: "财报" },
      ] },
      { id: "integration", title: "炼化销售与运营缓冲代理", metrics: [{ key: "inventory_days", label: "存货周转天数", value: "32.0 天", raw_value: 32, score: 84, status: "strong", quality: "reported", interpretation: "库存效率。", source: "财报" }] },
      { id: "capital", title: "资本开支、杠杆与资源续航代理", metrics: [
        { key: "cfo_to_np", label: "经营现金流/净利润", value: "1.32×", raw_value: 1.32, score: 89, status: "strong", quality: "reported", interpretation: "现金转换。", source: "财报" },
        { key: "liability_ratio", label: "资产负债率", value: "31.0%", raw_value: .31, score: 92, status: "strong", quality: "reported", interpretation: "低杠杆。", source: "财报" },
      ] },
      { id: "return", title: "股东回报与中周期估值", metrics: [
        { key: "dividend_cash_ttm", label: "近12月每股现金分红", value: "¥1.350/股", raw_value: 1.35, score: 90, status: "strong", quality: "reported", interpretation: "实际分红。", source: "分红记录" },
        { key: "dividend_yield", label: "近12月股息率", value: "4.8%", raw_value: .048, score: 79, status: "stable", quality: "derived", interpretation: "实际股息率。", source: "行情" },
        { key: "valuation_percentile", label: "近五年估值分位", value: "41.0%", raw_value: .41, score: 72, status: "stable", quality: "derived", interpretation: "PE分位。", source: "行情" },
      ] },
    ],
  },
  price_projection: {
    model_name: "油气中周期 EPS-PE + 一体化缓冲 + 可持续股息锚模型",
    current_price: 28.15,
    current_pe: 10.73,
    implied_eps_ttm: 2.624,
    market_date: "2026-07-10",
    report_date: "2026-03-31",
    scenarios: [sampleScenario("bull", "供给冲击与高油价", 34, .208), sampleScenario("base", "中周期油价与一体化平衡", 25.08, -.109), sampleScenario("bear", "需求衰退与油价下行", 17, -.396), sampleScenario("crisis", "油价崩塌或转型重估", 11, -.609)],
    base_value_mid: 25.08,
    defensive_entry_price: 16.2,
    conclusion: "基准情景略低于现价，等待更高安全垫。",
    assumptions: ["按上游与炼化结构进行中周期归一"],
    data_note: "价格区间不是未来股价保证。",
  },
};

const tollRoadAutomatedAnalysis: IndustryAnalysisResult = {
  ...oilGasAutomatedAnalysis,
  industry_id: "tollroad", industry_name: "成熟收费公路", stock_code: "600377", stock_name: "宁沪高速",
  current_price: 12.52, current_pb: 1.72, current_pe: 13.28, valuation_metric: "pe", valuation_percentile: .36,
  panorama: { report_date: "2026-03-31", published_date: "2026-04-25", coverage_ratio: 1, groups: [
    { id: "traffic", title: "车流、费率与通行收入代理", metrics: [
      { key: "traffic_revenue_proxy", label: "同口径车流与费率代理", value: "3.2%", raw_value: .032, score: 72, status: "stable", quality: "proxy", interpretation: "不冒充实际车流。", source: "财报" },
      { key: "traffic_profit_proxy", label: "车流盈利弹性代理", value: "4.8%", raw_value: .048, score: 76, status: "stable", quality: "proxy", interpretation: "利润代理。", source: "财报" },
    ] },
    { id: "asset", title: "路产运营与期限消耗代理", metrics: [{ key: "cfo_to_revenue", label: "经营现金流/收入", value: "52.0%", raw_value: .52, score: 82, status: "strong", quality: "reported", interpretation: "现金效率。", source: "财报" }] },
    { id: "finance", title: "债务、现金与分红承载", metrics: [
      { key: "cfo_to_np", label: "经营现金流/净利润", value: "1.16×", raw_value: 1.16, score: 78, status: "stable", quality: "reported", interpretation: "现金转换。", source: "财报" },
      { key: "liability_ratio", label: "资产负债率", value: "38.0%", raw_value: .38, score: 82, status: "strong", quality: "reported", interpretation: "杠杆。", source: "财报" },
      { key: "interest_cover", label: "EBIT利息保障", value: "6.20×", raw_value: 6.2, score: 84, status: "strong", quality: "reported", interpretation: "利息覆盖。", source: "财报" },
      { key: "asset_growth", label: "总资产同比", value: "4.0%", raw_value: .04, score: 78, status: "stable", quality: "reported", interpretation: "扩张速度。", source: "财报" },
    ] },
    { id: "return", title: "有限收费权与股东回报", metrics: [
      { key: "dividend_cash_ttm", label: "近12月每股现金分红", value: "¥0.470/股", raw_value: .47, score: 78, status: "stable", quality: "reported", interpretation: "实际分红。", source: "分红记录" },
      { key: "dividend_yield", label: "近12月股息率", value: "3.8%", raw_value: .038, score: 68, status: "stable", quality: "derived", interpretation: "实际股息率。", source: "行情" },
      { key: "valuation_percentile", label: "近五年估值分位", value: "36.0%", raw_value: .36, score: 76, status: "stable", quality: "derived", interpretation: "PE分位。", source: "行情" },
    ] },
  ] },
  price_projection: { model_name: "收费公路有限期限 EPS-PE + 可持续股息锚情景模型", current_price: 12.52, current_pe: 13.28, implied_eps_ttm: .943, market_date: "2026-07-10", report_date: "2026-03-31", scenarios: [sampleScenario("bull","车流复苏与期限改善",14,.118),sampleScenario("base","成熟车流与有限收费权",11.09,-.114),sampleScenario("bear","车流走弱与分流",8,-.361),sampleScenario("crisis","收费期限或费率政策冲击",5,-.601)], base_value_mid:11.09, defensive_entry_price:7.2, conclusion:"基准价值略低于现价，等待安全垫。", assumptions:["收费权不是永续资产"], data_note:"价格区间不是未来股价保证。" },
};

const nuclearAutomatedAnalysis: IndustryAnalysisResult = {
  ...tollRoadAutomatedAnalysis,
  industry_id:"nuclear",industry_name:"核电",stock_code:"601985",stock_name:"中国核电",current_price:8.91,current_pb:1.72,current_pe:22.26,valuation_metric:"pe",valuation_percentile:.46,
  panorama:{report_date:"2026-03-31",published_date:"2026-04-25",coverage_ratio:1,groups:[
    {id:"generation",title:"在运机组、利用小时与电价代理",metrics:[{key:"nuclear_generation_proxy",label:"核电量价收入代理",value:"4.2%",raw_value:.042,score:73,status:"stable",quality:"proxy",interpretation:"不冒充实际利用小时。",source:"财报"},{key:"nuclear_profit_proxy",label:"机组盈利变化代理",value:"2.6%",raw_value:.026,score:68,status:"stable",quality:"proxy",interpretation:"利润代理。",source:"财报"}]},
    {id:"construction",title:"在建机组与投产节奏代理",metrics:[{key:"asset_growth",label:"总资产同比",value:"8.0%",raw_value:.08,score:72,status:"stable",quality:"proxy",interpretation:"在建代理。",source:"财报"},{key:"asset_turnover",label:"资产周转率",value:"0.17×",raw_value:.17,score:66,status:"stable",quality:"reported",interpretation:"投产效率。",source:"财报"}]},
    {id:"finance",title:"资本开支、债务与现金覆盖",metrics:[{key:"cfo_to_np",label:"经营现金流/净利润",value:"1.62×",raw_value:1.62,score:79,status:"stable",quality:"reported",interpretation:"现金转换。",source:"财报"},{key:"liability_ratio",label:"资产负债率",value:"69.0%",raw_value:.69,score:48,status:"watch",quality:"reported",interpretation:"杠杆。",source:"财报"},{key:"interest_cover",label:"EBIT利息保障",value:"3.10×",raw_value:3.1,score:60,status:"watch",quality:"reported",interpretation:"利息覆盖。",source:"财报"}]},
    {id:"return",title:"股东回报、长久期与估值",metrics:[{key:"dividend_cash_ttm",label:"近12月每股现金分红",value:"¥0.232/股",raw_value:.232,score:70,status:"stable",quality:"reported",interpretation:"实际分红。",source:"分红记录"},{key:"dividend_yield",label:"近12月股息率",value:"2.6%",raw_value:.026,score:55,status:"watch",quality:"derived",interpretation:"股息率。",source:"行情"},{key:"valuation_percentile",label:"近五年估值分位",value:"46.0%",raw_value:.46,score:65,status:"stable",quality:"derived",interpretation:"PE分位。",source:"行情"}]}
  ]},
  price_projection:{model_name:"核电投产周期 EPS-PE + 债务现金闸门 + 股息锚模型",current_price:8.91,current_pe:22.26,implied_eps_ttm:.400,market_date:"2026-07-10",report_date:"2026-03-31",scenarios:[sampleScenario("bull","新机组投产与电价友好",9.2,.033),sampleScenario("base","稳定运行与有序投产",6.97,-.218),sampleScenario("bear","电价承压与投产延迟",4.8,-.461),sampleScenario("crisis","安全事件或建设重估",3,-.663)],base_value_mid:6.97,defensive_entry_price:4.25,conclusion:"基准价值低于现价，等待安全垫。",assumptions:["投产、债务和电价共同约束估值"],data_note:"价格区间不是未来股价保证。"}
};

const telecomAutomatedAnalysis: IndustryAnalysisResult={...nuclearAutomatedAnalysis,industry_id:"telecom",industry_name:"电信运营商",stock_code:"600941",stock_name:"中国移动",current_price:89.98,current_pb:1.55,current_pe:14.37,valuation_metric:"pe",valuation_percentile:.34,panorama:{report_date:"2026-03-31",published_date:"2026-04-25",coverage_ratio:1,groups:[
 {id:"subscriber",title:"用户、ARPU与通信主业代理",metrics:[{key:"telecom_revenue_proxy",label:"用户与ARPU收入代理",value:"2.8%",raw_value:.028,score:70,status:"stable",quality:"proxy",interpretation:"不冒充实际ARPU。",source:"财报"},{key:"telecom_profit_proxy",label:"运营利润变化代理",value:"4.1%",raw_value:.041,score:74,status:"stable",quality:"proxy",interpretation:"利润代理。",source:"财报"}]},
 {id:"network",title:"网络投资与第二曲线代理",metrics:[{key:"asset_growth",label:"总资产同比",value:"3.5%",raw_value:.035,score:80,status:"stable",quality:"proxy",interpretation:"网络投资代理。",source:"财报"},{key:"asset_turnover",label:"资产周转率",value:"0.48×",raw_value:.48,score:72,status:"stable",quality:"reported",interpretation:"网络效率。",source:"财报"},{key:"receivable_days",label:"应收账款周转天数",value:"38.0 天",raw_value:38,score:82,status:"strong",quality:"reported",interpretation:"回款。",source:"财报"}]},
 {id:"finance",title:"自由现金、资本结构与派息承载",metrics:[{key:"cfo_to_np",label:"经营现金流/净利润",value:"3.10×",raw_value:3.1,score:76,status:"stable",quality:"reported",interpretation:"现金转换。",source:"财报"},{key:"liability_ratio",label:"资产负债率",value:"34.0%",raw_value:.34,score:84,status:"strong",quality:"reported",interpretation:"杠杆。",source:"财报"}]},
 {id:"return",title:"派息、自由现金代理与估值",metrics:[{key:"dividend_cash_ttm",label:"近12月每股现金分红",value:"¥5.060/股",raw_value:5.06,score:90,status:"strong",quality:"reported",interpretation:"实际分红。",source:"分红记录"},{key:"dividend_yield",label:"近12月股息率",value:"5.6%",raw_value:.056,score:88,status:"strong",quality:"derived",interpretation:"实际股息率。",source:"行情"},{key:"valuation_percentile",label:"近五年估值分位",value:"34.0%",raw_value:.34,score:78,status:"stable",quality:"derived",interpretation:"PE分位。",source:"行情"}]}
]},price_projection:{model_name:"电信订阅现金流 EPS-PE + 资本开支闸门 + 可持续股息锚模型",current_price:89.98,current_pe:14.37,implied_eps_ttm:6.261,market_date:"2026-07-10",report_date:"2026-03-31",scenarios:[sampleScenario("bull","ARPU稳定与资本开支释放",112,.245),sampleScenario("base","通信主业稳定与云网增长",95.55,.062),sampleScenario("bear","资费竞争与新一轮投资",68,-.244),sampleScenario("crisis","政策或技术替代冲击",46,-.489)],base_value_mid:95.55,defensive_entry_price:62,conclusion:"基准价值略高于现价，可进入现金覆盖复核。",assumptions:["经营现金流需扣除资本开支"],data_note:"价格区间不是未来股价保证。"}};

function UniverseHarness() {
  const [query, setQuery] = useState(baseQuery);
  return (
    <>
      <IndustryUniverseBuilder query={query} activeIndustryId="bank" onChange={setQuery} />
      <output data-testid="query-state">{JSON.stringify(query)}</output>
    </>
  );
}

describe("industry interaction flows", () => {
  it("changes the active workspace when an industry tab is clicked", async () => {
    const onChange = vi.fn();
    render(<IndustryTabs value="bank" onChange={onChange} />);

    await userEvent.click(screen.getByRole("tab", { name: /水电/ }));

    expect(onChange).toHaveBeenCalledWith("hydro");
  });

  it("builds selected and all-industry universes through real click events", async () => {
    const user = userEvent.setup();
    render(<UniverseHarness />);

    await user.click(screen.getByRole("button", { name: "多行业" }));
    await user.click(screen.getByRole("checkbox", { name: /电信/ }));

    let query = JSON.parse(screen.getByTestId("query-state").textContent ?? "{}") as StrategyBacktestQuery;
    expect(query.universe_mode).toBe("selected");
    expect(query.industry_ids).toEqual(["bank", "telecom"]);
    expect(query.max_industry_weight).toBeCloseTo(0.45);

    await user.click(screen.getByRole("button", { name: "全行业" }));
    query = JSON.parse(screen.getByTestId("query-state").textContent ?? "{}") as StrategyBacktestQuery;
    expect(query.universe_mode).toBe("all");
    expect(query.industry_ids).toHaveLength(8);
    expect(query.holding_count).toBeGreaterThanOrEqual(8);
    expect(screen.getByText(/全行业防御池/)).toBeInTheDocument();
  });

  it("shows values returned by the backend industry analysis", () => {
    const analysis: IndustryAnalysisResult = {
      module: "industry_analysis",
      industry_id: "telecom",
      industry_name: "电信运营商",
      stock_code: "600941",
      stock_name: "中国移动",
      market_date: "2026-07-10",
      valuation_date: "2026-07-10",
      current_price: 89.98,
      daily_change_pct: 0.012,
      current_pb: 1.44,
      current_pe: 13.1,
      valuation_metric: "pe",
      valuation_percentile: 0.288,
      scores: { defense: 94, income: 91, quality: 90, valuation: 84, risk: 86, overall: 88 },
      metrics: [
        { key: "dividend", label: "股息覆盖", value: "1.6 倍", score: 92, status: "strong", source: "后端行情" },
      ],
      risk_flags: ["资本开支重新抬升"],
      data_note: "点时行情与行业先验综合评分。",
    };

    render(
      <IndustryWorkspace
        industry={INDUSTRY_MAP.telecom}
        page="overview"
        stockCode="600941"
        quote={null}
        quoteError=""
        valuationDate="2026-07-10"
        analysis={analysis}
        onSelectStock={vi.fn()}
      />,
    );

    expect(screen.getByText("¥89.98")).toBeInTheDocument();
    expect(screen.getByText("88")).toBeInTheDocument();
    expect(screen.getByText(/PE .*分位 28.8%/)).toBeInTheDocument();
    expect(screen.getByText("运营商四道否决闸门")).toBeInTheDocument();
  });

  it("shows the hydro-specific data dictionary without reusing the generic page", async () => {
    const user = userEvent.setup();
    render(
      <IndustryWorkspace
        industry={INDUSTRY_MAP.hydro}
        page="details"
        stockCode="600900"
        quote={null}
        quoteError=""
        valuationDate="2026-07-10"
        analysis={null}
        onSelectStock={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "水电数据全景" })).toBeInTheDocument();
    expect(screen.getByText(/运营、财务和估值共 24 个核心字段/)).toBeInTheDocument();
    expect(screen.getByText("来水偏差")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /财务与现金流/ }));
    expect(screen.getByText("净债务/EBITDA")).toBeInTheDocument();
    expect(screen.getByText("利息保障倍数")).toBeInTheDocument();
  });

  it("renders backend-calculated hydro price scenarios", () => {
    const hydroAnalysis: IndustryAnalysisResult = {
      ...consumerAutomatedAnalysis,
      industry_id: "hydro",
      industry_name: "大型水电",
      stock_code: "600900",
      stock_name: "长江电力",
      current_price: 28.03,
      current_pe: 19.01,
      price_projection: {
        ...consumerAutomatedAnalysis.price_projection!,
        model_name: "水电 EPS-PE + 实际股息锚情景模型",
        current_price: 28.03,
        current_pe: 19.01,
        implied_eps_ttm: 1.475,
        scenarios: [
          sampleScenario("bull", "丰水与电价友好", 35, .249),
          sampleScenario("base", "正常水文基准", 29.77, .062),
          sampleScenario("bear", "枯水与估值收缩", 20.19, -.28),
          sampleScenario("crisis", "政策或极端枯水", 15, -.465),
        ],
        base_value_mid: 29.77,
        defensive_entry_price: 22,
      },
    };
    render(
      <IndustryWorkspace
        industry={INDUSTRY_MAP.hydro}
        page="scenarios"
        stockCode="600900"
        quote={null}
        quoteError=""
        valuationDate="2026-07-11"
        analysis={hydroAnalysis}
        onSelectStock={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "水电股价情景推演" })).toBeInTheDocument();
    expect(screen.getByText("正常水文基准")).toBeInTheDocument();
    expect(screen.getAllByText("中枢 ¥29.77").length).toBeGreaterThan(0);
    expect(screen.getByText("¥22.00")).toBeInTheDocument();
  });

  it("shows the consumer-specific 25-field panorama and switches metric groups", async () => {
    const user = userEvent.setup();
    render(
      <IndustryWorkspace
        industry={INDUSTRY_MAP.consumer}
        page="details"
        stockCode="600519"
        quote={null}
        quoteError=""
        valuationDate="2026-07-10"
        analysis={null}
        onSelectStock={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "消费数据全景" })).toBeInTheDocument();
    expect(screen.getByText(/品牌、渠道、财务和估值共 25 个核心字段/)).toBeInTheDocument();
    expect(screen.getByText("终端销量 / 动销")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /渠道与库存/ }));
    expect(screen.getByText("渠道库存天数")).toBeInTheDocument();
    expect(screen.getByText("出货与动销差")).toBeInTheDocument();
  });

  it("renders backend-calculated consumer price scenarios", () => {
    render(
      <IndustryWorkspace
        industry={INDUSTRY_MAP.consumer}
        page="scenarios"
        stockCode="600519"
        quote={null}
        quoteError=""
        valuationDate="2026-07-10"
        analysis={consumerAutomatedAnalysis}
        onSelectStock={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "消费股价情景推演" })).toBeInTheDocument();
    expect(screen.getByText("稳健复购基准")).toBeInTheDocument();
    expect(screen.getAllByText("中枢 ¥1450.00").length).toBeGreaterThan(0);
    expect(screen.getByText("¥900.00")).toBeInTheDocument();
  });

  it("renders automated consumer values, scores and report dates from the backend", () => {
    render(
      <IndustryWorkspace
        industry={INDUSTRY_MAP.consumer}
        page="details"
        stockCode="600519"
        quote={null}
        quoteError=""
        valuationDate="2026-07-11"
        analysis={consumerAutomatedAnalysis}
        onSelectStock={vi.fn()}
      />,
    );

    expect(screen.getByText("539.09 亿元")).toBeInTheDocument();
    expect(screen.getAllByText("自动派生").length).toBeGreaterThan(0);
    expect(screen.getByText("81")).toBeInTheDocument();
    expect(screen.getByText(/财报期 2026-03-31/)).toBeInTheDocument();
  });

  it("uses automated fundamentals to generate the consumer overview conclusion", () => {
    render(
      <IndustryWorkspace
        industry={INDUSTRY_MAP.consumer}
        page="overview"
        stockCode="600519"
        quote={null}
        quoteError=""
        valuationDate="2026-07-11"
        analysis={consumerAutomatedAnalysis}
        onSelectStock={vi.fn()}
      />,
    );

    expect(screen.getByText("自动结论")).toBeInTheDocument();
    expect(screen.getByText("6.5% / 1.4%")).toBeInTheDocument();
    expect(screen.getByText(/当前首要约束是存货周转天数/)).toBeInTheDocument();
    expect(screen.getByText("毛利率 89.8%")).toBeInTheDocument();
  });

  it("replaces the duplicate consumer calculator with formulas and a live worked example", () => {
    render(
      <IndustryWorkspace
        industry={INDUSTRY_MAP.consumer}
        page="methods"
        stockCode="600519"
        quote={null}
        quoteError=""
        valuationDate="2026-07-11"
        analysis={consumerAutomatedAnalysis}
        onSelectStock={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "消费指标与价格模型说明" })).toBeInTheDocument();
    expect(screen.getByText("EPS TTM = 当前股价 ÷ PE TTM")).toBeInTheDocument();
    expect(screen.getByText("¥66.120")).toBeInTheDocument();
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
  });

  it("renders resource-specific mid-cycle price scenarios from backend data", () => {
    render(<IndustryWorkspace industry={INDUSTRY_MAP.resources} page="scenarios" stockCode="601088" quote={null} quoteError="" valuationDate="2026-07-11" analysis={resourceAutomatedAnalysis} onSelectStock={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "资源股价情景推演" })).toBeInTheDocument();
    expect(screen.getByText("中枢 ¥32.59")).toBeInTheDocument();
    expect(screen.getByText("供给约束与商品上行")).toBeInTheDocument();
    expect(screen.getByText("政策、事故或价格崩塌")).toBeInTheDocument();
  });

  it("explains resource cycle normalization with a real worked example", () => {
    render(<IndustryWorkspace industry={INDUSTRY_MAP.resources} page="methods" stockCode="601088" quote={null} quoteError="" valuationDate="2026-07-11" analysis={resourceAutomatedAnalysis} onSelectStock={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "资源指标与价格模型说明" })).toBeInTheDocument();
    expect(screen.getByText("收入景气代理")).toBeInTheDocument();
    expect(screen.getByText("¥2.378")).toBeInTheDocument();
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
  });

  it("renders oilgas scenarios with upstream and downstream structure", () => {
    render(<IndustryWorkspace industry={INDUSTRY_MAP.oilgas} page="scenarios" stockCode="600938" quote={null} quoteError="" valuationDate="2026-07-11" analysis={oilGasAutomatedAnalysis} onSelectStock={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "油气股价情景推演" })).toBeInTheDocument();
    expect(screen.getByText("中枢 ¥25.08")).toBeInTheDocument();
    expect(screen.getByText("中周期油价与一体化平衡")).toBeInTheDocument();
  });

  it("explains the company-specific oilgas sensitivity model", () => {
    render(<IndustryWorkspace industry={INDUSTRY_MAP.oilgas} page="methods" stockCode="600938" quote={null} quoteError="" valuationDate="2026-07-11" analysis={oilGasAutomatedAnalysis} onSelectStock={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "油气指标与价格模型说明" })).toBeInTheDocument();
    expect(screen.getByText("90.0%")).toBeInTheDocument();
    expect(screen.getByText("¥2.624")).toBeInTheDocument();
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
  });

  it("renders finite-concession tollroad price scenarios", () => {
    render(<IndustryWorkspace industry={INDUSTRY_MAP.tollroad} page="scenarios" stockCode="600377" quote={null} quoteError="" valuationDate="2026-07-11" analysis={tollRoadAutomatedAnalysis} onSelectStock={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "收费公路股价情景推演" })).toBeInTheDocument();
    expect(screen.getByText("中枢 ¥11.09")).toBeInTheDocument();
    expect(screen.getByText("收费期限或费率政策冲击")).toBeInTheDocument();
  });

  it("explains the tollroad duration and dividend model", () => {
    render(<IndustryWorkspace industry={INDUSTRY_MAP.tollroad} page="methods" stockCode="600377" quote={null} quoteError="" valuationDate="2026-07-11" analysis={tollRoadAutomatedAnalysis} onSelectStock={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "公路指标与价格模型说明" })).toBeInTheDocument();
    expect(screen.getByText("为什么不能使用永续估值")).toBeInTheDocument();
    expect(screen.getByText("¥0.943")).toBeInTheDocument();
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
  });

  it("renders nuclear commissioning and safety price scenarios", () => {
    render(<IndustryWorkspace industry={INDUSTRY_MAP.nuclear} page="scenarios" stockCode="601985" quote={null} quoteError="" valuationDate="2026-07-11" analysis={nuclearAutomatedAnalysis} onSelectStock={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "核电股价情景推演" })).toBeInTheDocument();
    expect(screen.getByText("中枢 ¥6.97")).toBeInTheDocument();
    expect(screen.getByText("安全事件或建设重估")).toBeInTheDocument();
  });

  it("explains nuclear commissioning, debt and cash gates", () => {
    render(<IndustryWorkspace industry={INDUSTRY_MAP.nuclear} page="methods" stockCode="601985" quote={null} quoteError="" valuationDate="2026-07-11" analysis={nuclearAutomatedAnalysis} onSelectStock={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "核电指标与价格模型说明" })).toBeInTheDocument();
    expect(screen.getByText("机组投产如何形成盈利")).toBeInTheDocument();
    expect(screen.getByText("¥0.400")).toBeInTheDocument();
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
  });

  it("renders telecom ARPU, capex and dividend price scenarios",()=>{render(<IndustryWorkspace industry={INDUSTRY_MAP.telecom} page="scenarios" stockCode="600941" quote={null} quoteError="" valuationDate="2026-07-11" analysis={telecomAutomatedAnalysis} onSelectStock={vi.fn()}/>);expect(screen.getByRole("heading",{name:"电信股价情景推演"})).toBeInTheDocument();expect(screen.getByText("中枢 ¥95.55")).toBeInTheDocument();expect(screen.getByText("政策或技术替代冲击")).toBeInTheDocument()});
  it("explains telecom free-cash-flow and payout gates",()=>{render(<IndustryWorkspace industry={INDUSTRY_MAP.telecom} page="methods" stockCode="600941" quote={null} quoteError="" valuationDate="2026-07-11" analysis={telecomAutomatedAnalysis} onSelectStock={vi.fn()}/>);expect(screen.getByRole("heading",{name:"电信指标与价格模型说明"})).toBeInTheDocument();expect(screen.getByText("资本开支决定自由现金")).toBeInTheDocument();expect(screen.getByText("¥6.261")).toBeInTheDocument();expect(screen.queryByRole("slider")).not.toBeInTheDocument()});

  it("loads and renders the automated peer ranking when the ranking module opens", async () => {
    const keyMetrics = consumerAutomatedAnalysis.panorama?.groups.flatMap((group) => group.metrics) ?? [];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        module: "industry_ranking",
        industry_id: "consumer",
        valuation_date: "2026-07-11",
        result_count: 1,
        results: [{
          rank: 1,
          stock_code: "600519",
          stock_name: "贵州茅台",
          market_date: "2026-07-10",
          report_date: "2026-03-31",
          overall_score: 82.6,
          defense_score: 80,
          quality_score: 88,
          income_score: 76,
          valuation_score: 69,
          risk_score: 22,
          valuation_percentile: .31,
          key_metrics: keyMetrics,
          risk_flags: [],
        }],
        failures: [],
        data_note: "仅使用点时财报和行情，不使用回测结果。",
      }),
    } as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);

    try {
      render(
        <IndustryWorkspace
          industry={INDUSTRY_MAP.consumer}
          page="reversion"
          stockCode="600519"
          quote={null}
          quoteError=""
          valuationDate="2026-07-11"
          analysis={consumerAutomatedAnalysis}
          onSelectStock={vi.fn()}
        />,
      );

      expect(await screen.findByText("#1 贵州茅台")).toBeInTheDocument();
      expect(screen.getByText("82.6")).toBeInTheDocument();
      expect(fetchMock.mock.calls[0][0]).toBe("/api/industry/ranking");
      expect(screen.getByText(/不使用回测结果/)).toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
