import { type CSSProperties, type FocusEvent as ReactFocusEvent, type FormEvent, type PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  getIndustryBenchmark,
  getLiveQuote,
  getMeanReversionOverview,
  getMonteCarlo,
  getStrategyBacktest,
  getValuation,
} from "./api";
import type { LiveQuote } from "./api";
import type {
  BacktestStrategyId,
  BankMeanReversionOverview,
  BankMeanReversionRow,
  IndustryBenchmark,
  MonteCarloResult,
  ScenarioName,
  StrategyBacktestQuery,
  StrategyBacktestResponse,
  StrategyBacktestResult,
  ValuationResult,
} from "./types";

type Page = "overview" | "reversion" | "backtest" | "details" | "scenarios" | "methods";
type UiTheme = "calm" | "fintech" | "terminal" | "research" | "anime" | "euro";
type ReversionMode = "reversion" | "income";

const SCENARIO_META: Record<
  ScenarioName,
  { label: string; className: string; note: string }
> = {
  bull: { label: "乐观修复", className: "bull", note: "盈利回升、估值修复" },
  base: { label: "基准稳定", className: "base", note: "经营平稳、股息延续" },
  bear: { label: "悲观承压", className: "bear", note: "息差与盈利承压" },
  crisis: {
    label: "危机重估",
    className: "crisis",
    note: "风险暴露、重新定价",
  },
};

// Ordered by broad market attention and liquidity, then by regional-bank coverage.
const BANK_OPTIONS = [
  ["600036", "招商银行"], ["601398", "工商银行"], ["601939", "建设银行"], ["601288", "农业银行"], ["601988", "中国银行"], ["601658", "邮储银行"], ["601328", "交通银行"],
  ["601166", "兴业银行"], ["000001", "平安银行"], ["601818", "光大银行"], ["601998", "中信银行"], ["600000", "浦发银行"], ["600016", "民生银行"], ["600015", "华夏银行"], ["601916", "浙商银行"],
  ["002142", "宁波银行"], ["601169", "北京银行"], ["601229", "上海银行"], ["600919", "江苏银行"], ["600926", "杭州银行"], ["601009", "南京银行"], ["601838", "成都银行"], ["601577", "长沙银行"], ["601997", "贵阳银行"], ["601963", "重庆银行"],
  ["601825", "上海农商银行"], ["601077", "渝农商行"], ["600928", "西安银行"], ["601665", "齐鲁银行"], ["601187", "厦门银行"], ["601860", "紫金银行"], ["601528", "瑞丰银行"], ["600908", "无锡银行"], ["001227", "兰州银行"], ["002936", "郑州银行"],
  ["002966", "苏州银行"], ["002948", "青岛银行"], ["601128", "常熟银行"], ["603323", "苏农银行"], ["002807", "江阴银行"], ["002839", "张家港行"], ["002958", "青农商行"],
] as const;

const BANK_LOGO_CODES = new Set([
  "000001", "001227", "002142", "002807", "002839", "002936", "002948", "002958",
  "002966", "600000", "600015", "600016", "600036", "600908", "600919", "600926",
  "600928", "601009", "601077", "601128", "601166", "601169", "601187", "601229",
  "601288", "601328", "601398", "601528", "601577", "601658", "601665", "601818",
  "601825", "601838", "601860", "601916", "601939", "601963", "601988", "601997",
  "601998", "603323",
]);

const BANK_SEARCH_ALIASES: Record<string, string> = {
  "600036": "zsyh zhaoshangyinhang cmb",
  "601398": "gsyh gongshangyinhang icbc",
  "601939": "jsyh jiansheyinhang ccb",
  "601288": "nyyh nongyeyinhang abc",
  "601988": "zgyh zhongguoyinhang boc",
  "601658": "ycyh youchuyinhang psbc",
  "601328": "jtyh jiaotongyinhang bcm",
  "601166": "xyyh xingyeyinhang cib",
  "000001": "payh pinganyinhang pab",
  "601818": "gdyh guangdayinhang ceb",
  "601998": "zxyh zhongxinyinhang citic",
  "600000": "pfyh pufa pudongfazhan spdb",
  "600016": "msyh minshengyinhang cmbc",
  "600015": "hxyh huaxiayinhang hxb",
  "601916": "zsyh zheshangyinhang czb",
  "002142": "nbyh ningboyinhang nbb",
  "601169": "bjyh beijingyinhang bob",
  "601229": "shyh shanghaiyinhang bos",
  "600919": "jsyh jiangsuyinhang",
  "600926": "hzyh hangzhouyinhang",
  "601009": "njyh nanjingyinhang",
  "601838": "cdyh chengduyinhang",
  "601577": "csyh changshayinhang",
  "601997": "gyyh guiyangyinhang",
  "601963": "cqyh chongqingyinhang",
  "601825": "shnsyh shanghainongshangyinhang",
  "601077": "ycns yh ycnsyh yuchongnongshangyinhang",
  "600928": "xayh xianyinhang",
  "601665": "qlyh qiluyinhang",
  "601187": "xmyh xiamenyinhang",
  "601860": "zjyh zijinyinhang",
  "601528": "rfyh ruifengyinhang",
  "600908": "wxyh wuxiyinhang",
  "001227": "lzyh lanzhouyinhang",
  "002936": "zzyh zhengzhouyinhang",
  "002966": "szyh suzhouyinhang",
  "002948": "qdyh qingdaoyinhang",
  "601128": "csyh changshuyinhang",
  "603323": "snyh sunongyinhang",
  "002807": "jyyh jiangyinyinhang",
  "002839": "zjgyh zhangjiagangyinhang",
  "002958": "qnsyh qingnongshanghang qingdaonongshang",
};

const formatBankOption = (bankCode: string) => {
  const normalized = bankCode.includes(".") ? bankCode.split(".")[1] : bankCode;
  const option = BANK_OPTIONS.find(([code]) => code === normalized);
  return option ? `${option[0]} · ${option[1]}` : normalized;
};

const normalizeBankSearchText = (text: string) =>
  text
    .toLowerCase()
    .replace(/[\s路·•・.。丶、,，:：;；|｜/\\\-—–_]/g, "");

const bankSearchHaystack = (code: string, name: string) =>
  normalizeBankSearchText(`${code}${name}${BANK_SEARCH_ALIASES[code] ?? ""}`);

const resolveBankCode = (input: string, fallback: string) => {
  const text = input.trim();
  if (!text) return fallback;
  const digitMatch = text.match(/\d{6}/);
  if (digitMatch) return digitMatch[0];
  const compact = text.replace(/\s/g, "");
  const exact = BANK_OPTIONS.find(
    ([code, name]) => name === text || `${code}·${name}` === compact,
  );
  if (exact) return exact[0];
  const normalizedText = normalizeBankSearchText(text);
  const partial = BANK_OPTIONS.find(
    ([code, name]) => code.includes(text) || name.includes(text) || bankSearchHaystack(code, name).includes(normalizedText),
  );
  return partial?.[0] ?? fallback;
};

const RATING: Record<
  ValuationResult["final_rating"],
  { title: string; detail: string; tone: string }
> = {
  deep_value: {
    title: "低估 · 基本面稳定",
    detail: "当前估值较低，且经营指标未出现明显恶化。",
    tone: "mint",
  },
  watch: {
    title: "观察中",
    detail: "价格和基本面还需要一起再走一段路。",
    tone: "peach",
  },
  hold_income: {
    title: "股息观察",
    detail: "现金分红特征较突出，仍需持续关注其可持续性。",
    tone: "lavender",
  },
  value_trap_risk: {
    title: "价值陷阱风险",
    detail: "低估值伴随基本面走弱，应重点辨别风险来源。",
    tone: "rose",
  },
  avoid: {
    title: "风险较高",
    detail: "盈利或资本缓冲承压，当前估值分析偏审慎。",
    tone: "rose",
  },
};

const REVERSION_STATUS: Record<
  BankMeanReversionRow["status"],
  { label: string; tone: string }
> = {
  high_conviction_reversion: { label: "高确定性回归", tone: "mint" },
  undervalued_watch: { label: "低估观察", tone: "peach" },
  fair_value: { label: "估值中性", tone: "lavender" },
  risk_discount: { label: "风险型低估", tone: "rose" },
  overvalued: { label: "估值偏高", tone: "gray" },
};

const INCOME_STATUS: Record<
  BankMeanReversionRow["income_status"],
  { label: string; tone: string }
> = {
  core_income: { label: "核心股息候选", tone: "mint" },
  income_watch: { label: "股息观察", tone: "peach" },
  yield_trap_risk: { label: "高息陷阱", tone: "rose" },
  not_income_candidate: { label: "非股息候选", tone: "gray" },
};

const BUY_WAIT_STATUS: Record<
  ValuationResult["defensive_decision"]["buy_wait_status"],
  { label: string; tone: string }
> = {
  reached: { label: "已到等待区", tone: "green" },
  near: { label: "接近等待区", tone: "yellow" },
  wait: { label: "继续等待", tone: "yellow" },
  avoid: { label: "先避开", tone: "red" },
};

const RISK_LIGHT: Record<
  ValuationResult["defensive_decision"]["risk_light"],
  { label: string; tone: string }
> = {
  green: { label: "绿灯", tone: "green" },
  yellow: { label: "黄灯", tone: "yellow" },
  red: { label: "红灯", tone: "red" },
};

const money = (value: number | null) =>
  value === null ? "—" : `¥${value.toFixed(2)}`;
const capitalMoney = (value: number) => {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 100_000_000) return `${sign}¥${(abs / 100_000_000).toFixed(2)}亿`;
  if (abs >= 10_000) return `${sign}¥${(abs / 10_000).toFixed(1)}万`;
  return `${sign}¥${abs.toFixed(0)}`;
};
const pct = (value: number) =>
  `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
const purePct = (value: number) => `${(value * 100).toFixed(1)}%`;
const drawdownPct = (value: number) =>
  value === 0 ? "0.0%" : pct(value);
const maybePct = (value: number | null) =>
  value === null ? "—" : purePct(value);
const dayPct = (value: number | null) =>
  value === null ? "—" : `${value >= 0 ? "+" : ""}${(value * 100).toFixed(2)}%`;
const signedMoney = (value: number | null) =>
  value === null ? "—" : `${value >= 0 ? "+" : "-"}¥${Math.abs(value).toFixed(2)}`;
const quoteTone = (value: number | null) =>
  value === null ? "flat" : value > 0 ? "up" : value < 0 ? "down" : "flat";
const quoteArrow = (value: number | null) =>
  value === null ? "—" : value > 0 ? "▲" : value < 0 ? "▼" : "◆";
const marketAmount = (value: number | null) => {
  if (value === null) return "—";
  if (Math.abs(value) >= 100_000_000) return `¥${(value / 100_000_000).toFixed(2)}亿`;
  if (Math.abs(value) >= 10_000) return `¥${(value / 10_000).toFixed(1)}万`;
  return `¥${value.toFixed(0)}`;
};
const lotVolume = (value: number | null) =>
  value === null ? "—" : `${(value / 1_000_000).toFixed(2)}万手`;
const recoveryText = (days: number | null, recoveryDate: string | null) =>
  days === null ? "尚未修复" : `${days}天 · ${recoveryDate}`;
const THEME_META: Record<UiTheme, { label: string; title: string }> = {
  calm: { label: "经典", title: "银行估值与股息筛选工作台" },
  fintech: { label: "科技粒子", title: "银行估值与回归信号台" },
  terminal: { label: "量化终端", title: "BANK SIGNAL TERMINAL" },
  research: { label: "投研白板", title: "银行估值工作台" },
  anime: { label: "动漫霓虹", title: "Bank Heroine Valuation Board" },
  euro: { label: "欧城石径", title: "European Bank Valuation Atelier" },
};

const initialTheme = (): UiTheme => {
  const saved = localStorage.getItem("bank-valuation-ui-theme");
  return saved === "fintech" || saved === "terminal" || saved === "research" || saved === "anime" || saved === "euro"
    ? saved
    : "calm";
};
const localToday = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
};

const SAVED_DASHBOARD_KEY = "bank-valuation-dashboard-current";
const DASHBOARD_DATA_VERSION = 2;

interface SavedDashboardState {
  dataVersion?: number;
  code: string;
  bankSearch: string;
  date: string;
  result: ValuationResult;
  monte: MonteCarloResult | null;
  benchmark: IndustryBenchmark | null;
  savedAt: string;
}

const loadSavedDashboard = (): SavedDashboardState | null => {
  try {
    const raw = localStorage.getItem(SAVED_DASHBOARD_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<SavedDashboardState>;
    if (saved.dataVersion !== DASHBOARD_DATA_VERSION) return null;
    if (!saved.result?.stock_code) return null;
    return {
      code: saved.code || saved.result.stock_code.replace(/\D/g, "").slice(-6) || "601398",
      bankSearch: saved.bankSearch || formatBankOption(saved.result.stock_code),
      date: saved.date || localToday(),
      result: saved.result,
      monte: saved.monte ?? null,
      benchmark: saved.benchmark ?? null,
      savedAt: saved.savedAt || new Date().toISOString(),
    };
  } catch {
    return null;
  }
};

const DEFAULT_BACKTEST_QUERY: StrategyBacktestQuery = {
  years: 10,
  start_date: null,
  end_date: null,
  rebalance_frequency: "quarterly",
  holding_count: 10,
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

const BACKTEST_PRESET_COMPARE_KEYS: Array<keyof StrategyBacktestQuery> = [
  "years",
  "start_date",
  "end_date",
  "rebalance_frequency",
  "holding_count",
  "min_dividend_yield",
  "min_dividend_safety",
  "min_stable_growth",
  "max_risk_score",
  "max_payout_ratio",
  "dividend_weight",
  "safety_weight",
  "growth_weight",
  "valuation_weight",
  "risk_penalty_weight",
  "initial_capital",
  "commission_rate",
  "stamp_duty_rate",
  "transfer_fee_rate",
  "slippage_rate",
  "cash_yield",
];

type SavedBacktestPreset = {
  id: string;
  name: string;
  createdAt: string;
  query: StrategyBacktestQuery;
};

const SAVED_BACKTEST_PRESETS_KEY = "bank-backtest-saved-parameter-sets";

const savedPresetName = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return `参数 ${local.toISOString().slice(0, 16).replace("T", " ")}`;
};

const readSavedBacktestPresets = (): SavedBacktestPreset[] => {
  try {
    const raw = localStorage.getItem(SAVED_BACKTEST_PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedBacktestPreset[];
    return Array.isArray(parsed) ? parsed.filter((item) => item?.id && item?.query) : [];
  } catch {
    return [];
  }
};

const writeSavedBacktestPresets = (presets: SavedBacktestPreset[]) => {
  localStorage.setItem(SAVED_BACKTEST_PRESETS_KEY, JSON.stringify(presets.slice(0, 20)));
};

function Particles() {
  return (
    <div className="particles" aria-hidden="true">
      {Array.from({ length: 20 }, (_, i) => (
        <i key={i} />
      ))}
    </div>
  );
}

function PriceBand({ result }: { result: ValuationResult }) {
  const scenarioNames = ["bull", "base", "bear", "crisis"] as ScenarioName[];
  const values = [
    result.current_price,
    ...scenarioNames.flatMap((name) => result.scenarios[name].price_range),
  ];
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const padding = Math.max((rawMax - rawMin) * 0.08, rawMax * 0.02, 1);
  const min = Math.max(0, rawMin - padding);
  const max = rawMax + padding;
  const toPercent = (value: number) => {
    if (max <= min) return 50;
    return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  };
  const x = (value: number) => `${toPercent(value).toFixed(3)}%`;
  return (
    <section className="card price-band">
      <div className="section-heading">
        <div>
          <span className="eyebrow">价格坐标</span>
          <h2>估值区间在何处</h2>
        </div>
        <span className="quiet">单位：元 / 股</span>
      </div>
      <div className="price-band-chart">
        <div className="axis price-axis">
          <span>{money(min)}</span>
          <span>{money(max)}</span>
        </div>
        {scenarioNames.map((name) => {
          const [low, high] = result.scenarios[name].price_range;
          const width = Math.max(0.8, toPercent(high) - toPercent(low));
          return (
            <div className={`band-row ${name}`} key={name}>
              <div className="band-label">{SCENARIO_META[name].label}</div>
              <div className="band-track">
                <div
                  className="band-fill"
                  style={{ left: x(low), width: `${width.toFixed(3)}%` }}
                />
                <span className="band-value low" style={{ left: x(low) }}>
                  {low.toFixed(2)}
                </span>
                <span className="band-value high" style={{ left: x(high) }}>
                  {high.toFixed(2)}
                </span>
              </div>
            </div>
          );
        })}
        <div className="current-pin-layer">
          <div className="current-pin" style={{ left: x(result.current_price) }}>
            <span>当前</span>
            <b>{money(result.current_price)}</b>
          </div>
        </div>
      </div>
    </section>
  );
}

function DefensiveDecisionPanel({ result }: { result: ValuationResult }) {
  const decision = result.defensive_decision;
  const waitStatus = BUY_WAIT_STATUS[decision.buy_wait_status];
  const light = RISK_LIGHT[decision.risk_light];
  const waitTooltip = "等待价是按基准情景下沿、PB-ROE合理价、剩余收益价和股息托底综合后，再扣安全边际得到的保守观察价。";
  const statusTooltip: Record<ValuationResult["defensive_decision"]["buy_wait_status"], string> = {
    reached: "现价低于等待价，不代表必须买入，还要看红绿灯和压力测试是否可接受。",
    near: "现价离等待价很近，可以进入重点观察，但最好继续要求风险信号不恶化。",
    wait: "现价离保守等待价还有距离，模型建议等更高安全边际。",
    avoid: "风险灯或基本面风险偏高，等待价只作为参考，不建议只因便宜行动。",
  };
  const stressTooltip = "压力测试价格不是目标价，而是把分红、悲观情景、危机情景分别压低后，看当前价还有多少缓冲。";
  const trafficTooltip = "红绿灯优先看经营风险、风险标签、资产质量、资本和压力下行。绿灯偏干净，黄灯需安全边际，红灯先排除风险。";
  return (
    <section className="card defensive-panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">防守决策</span>
          <h2>
            等待价、压力测试和风险红绿灯
            <span className="help-dot" data-tooltip="这块用于回答三个问题：什么价格再考虑、坏情景能扛多少、当前风险是否干净。">?</span>
          </h2>
        </div>
        <span className={`traffic-pill has-tooltip ${light.tone}`} data-tooltip={trafficTooltip}>{decision.risk_light_label}</span>
      </div>
      <div className="defensive-grid">
        <article className={`buy-wait-card ${waitStatus.tone}`}>
          <span>
            买入等待价
            <i className="help-dot" data-tooltip={waitTooltip}>?</i>
          </span>
          <b>{money(decision.buy_wait_price)}</b>
          <em className="has-tooltip" data-tooltip={statusTooltip[decision.buy_wait_status]}>{waitStatus.label}</em>
          <small>等待价较当前 {pct(decision.buy_wait_gap)}</small>
          <p>{decision.buy_wait_reason}</p>
        </article>
        <article className="stress-card">
          <span>
            压力测试
            <i className="help-dot" data-tooltip={stressTooltip}>?</i>
          </span>
          <div className="stress-list">
            {decision.stress_tests.map((item) => (
              <div className={`has-tooltip ${item.severity}`} key={item.name} data-tooltip={item.note}>
                <i />
                <strong>{item.name}</strong>
                <b>{money(item.stressed_price)}</b>
                <small>{item.downside === null ? "—" : pct(item.downside)}</small>
              </div>
            ))}
          </div>
        </article>
        <article className={`traffic-card ${light.tone}`}>
          <span>
            风险红绿灯
            <i className="help-dot" data-tooltip={trafficTooltip}>?</i>
          </span>
          <div className="traffic-light">
            <i className="red" />
            <i className="yellow" />
            <i className="green" />
            <b className={light.tone}>{light.label}</b>
          </div>
          <ul>
            {decision.risk_light_reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}

function MonteChart({ data }: { data: MonteCarloResult }) {
  const points = [
    { label: "P10", value: data.p10_price },
    { label: "P50", value: data.p50_price },
    { label: "P90", value: data.p90_price },
  ];
  const min = Math.min(...points.map((p) => p.value)) * 0.9;
  const max = Math.max(...points.map((p) => p.value)) * 1.1;
  const y = (value: number) => 110 - ((value - min) / (max - min || 1)) * 82;
  const polyline = points
    .map((p, index) => `${45 + index * 125},${y(p.value)}`)
    .join(" ");
  return (
    <section className="card monte-card">
      <div className="section-heading">
        <div>
          <span className="eyebrow">未来五年模拟</span>
          <h2>价格分布的中间地带</h2>
        </div>
        <span className="pill">10,000 次</span>
      </div>
      <svg viewBox="0 0 340 145" role="img" aria-label="蒙特卡洛分位价格图">
        <line x1="35" y1="115" x2="315" y2="115" className="grid" />
        <line x1="35" y1="70" x2="315" y2="70" className="grid" />
        <polyline points={polyline} className="monte-line" />
        {points.map((point, index) => (
          <g key={point.label}>
            <circle
              cx={45 + index * 125}
              cy={y(point.value)}
              r="6"
              className="monte-point"
            />
            <text x={45 + index * 125} y="135" textAnchor="middle">
              {point.label}
            </text>
            <text
              x={45 + index * 125}
              y={y(point.value) - 12}
              textAnchor="middle"
              className="point-price"
            >
              {money(point.value)}
            </text>
          </g>
        ))}
      </svg>
      <div className="probability-pairs">
        <span>
          跌超 20% <b>{purePct(data.probability_price_down_20)}</b>
        </span>
        <span>
          涨超 20% <b>{purePct(data.probability_price_up_20)}</b>
        </span>
      </div>
    </section>
  );
}

function ScenarioPage({ result }: { result: ValuationResult }) {
  return (
    <div className="scenario-page fade-in">
      <div className="page-intro">
        <span className="eyebrow">四种未来</span>
        <h1>不是预测，是为不同路径预留位置。</h1>
        <p>情景概率会根据 PB 所处位置、盈利、分红与风险缓冲动态分配。</p>
      </div>
      <div className="scenario-grid">
        {(["bull", "base", "bear", "crisis"] as ScenarioName[]).map((name) => {
          const s = result.scenarios[name];
          return (
            <article className={`scenario-card ${name}`} key={name}>
              <div className="scenario-top">
                <span>{SCENARIO_META[name].label}</span>
                <b>{purePct(s.scenario_probability)}</b>
              </div>
              <p>{SCENARIO_META[name].note}</p>
              <div className="scenario-price">
                {money(s.price_range[0])}
                <em> — </em>
                {money(s.price_range[1])}
              </div>
              <dl>
                <div>
                  <dt>ROE</dt>
                  <dd>
                    {purePct(s.roe_range[0])} – {purePct(s.roe_range[1])}
                  </dd>
                </div>
                <div>
                  <dt>盈利增速</dt>
                  <dd>
                    {pct(s.profit_growth_range[0])} –{" "}
                    {pct(s.profit_growth_range[1])}
                  </dd>
                </div>
                <div>
                  <dt>目标 PB</dt>
                  <dd>
                    {s.target_pb_range[0].toFixed(2)} –{" "}
                    {s.target_pb_range[1].toFixed(2)}
                  </dd>
                </div>
              </dl>
              <ul>
                {s.trigger_conditions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function ScenarioConditions({ result }: { result: ValuationResult }) {
  return (
    <section className="scenario-conditions">
      <div className="page-intro compact">
        <span className="eyebrow">情景出现的条件</span>
        <h2>概率不是拍脑袋：每种路径都有对应的环境与银行信号。</h2>
      </div>
      {(["bull", "base", "bear", "crisis"] as ScenarioName[]).map((name) => {
        const scenario = result.scenarios[name];
        const fit = scenario.current_fit;
        return (
          <article className={`condition-card ${name}`} key={name}>
            <div className="condition-title">
              <span>{SCENARIO_META[name].label}</span>
              <b>{purePct(scenario.scenario_probability)}</b>
              <small>{fit.assessment}</small>
            </div>
            <div className="condition-columns">
              <div>
                <h3>宏观 / 市场环境</h3>
                <ul>
                  {scenario.macro_conditions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>银行需要出现的信号</h3>
                <ul>
                  {scenario.bank_conditions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>估值如何变化</h3>
                <p>{scenario.valuation_trigger}</p>
              </div>
            </div>
            <div className="current-fit">
              <span>与当前数据的关系</span>
              <div>
                {fit.supporting_signals.map((item) => (
                  <b key={item}>✓ {item}</b>
                ))}
                {fit.gaps_or_watchpoints.map((item) => (
                  <i key={item}>· {item}</i>
                ))}
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}

function MethodPage() {
  return (
    <div className="method-page fade-in">
      <div className="page-intro">
        <span className="eyebrow">读数指南</span>
        <h1>指标怎么算，策略怎么选。</h1>
        <p>这里把页面里用到的主要指标、银行排序、高股息回测和估值模型放在同一页，方便核对每个数字的含义。</p>
      </div>
      <div className="method-grid">
        <article>
          <b>01</b>
          <h2>估值与价格指标</h2>
          <p>这一组回答“现在贵不贵”。银行股的核心不是看收入故事，而是看一元净资产能创造多少利润，以及市场愿意给这份净资产多少折价或溢价。</p>
          <dl>
            <dt>股价</dt><dd>估值模型使用最近可得收盘价；页面顶部实时价只用于观察盘中变化和实时 PB 估算。</dd>
            <dt>每股净资产</dt><dd>BPS = 归母净资产 / 总股本，是 PB 的分母，也近似代表每股账面资本。</dd>
            <dt>PB</dt><dd>市净率 = 股价 / 每股净资产。银行资产负债表占核心位置，所以 PB 是银行估值的主指标。</dd>
            <dt>PE</dt><dd>市盈率 = 股价 / 每股收益，也可用总市值 / 归母净利润。利润波动大时，PE 容易失真。</dd>
            <dt>PB 分位</dt><dd>把当前 PB 放进过去 3/5/10 年 PB 样本排序。10% 表示比历史上约 90% 的时候便宜。</dd>
            <dt>折价幅度</dt><dd>相对历史 PB 中位数的折价 = 当前 PB / 历史中位 PB - 1，用来估算均值回归空间。</dd>
            <dt>股息率</dt><dd>近 12 个月每股现金分红 / 当前股价。价格越低、分红越稳定，股息率越高。</dd>
          </dl>
          <p className="method-example">例：股价 10 元，每股净资产 20 元，则 PB=0.50；每股收益 1 元，则 PE=10 倍；每股分红 0.45 元，则股息率为 4.5%。</p>
          <p className="method-caution">注意：低 PB 只说明市场给了折价，不自动等于便宜。若 ROE 下滑、不良暴露或资本不足，低 PB 可能是风险补偿。</p>
        </article>
        <article>
          <b>02</b>
          <h2>盈利、质量和资本</h2>
          <p>这一组回答“低估有没有陷阱”。银行是杠杆经营，利润、资产质量和资本缓冲要一起看。</p>
          <dl>
            <dt>ROE</dt><dd>净资产收益率 = 归母净利润 / 平均净资产，衡量银行用资本赚钱的能力。</dd>
            <dt>净利润同比</dt><dd>本期归母净利润相对上年同期的增长率，用来判断盈利趋势。</dd>
            <dt>息差压力</dt><dd>若贷款收益率下降快于负债成本，利润会承压；前端主要通过利润趋势和风险标签间接反映。</dd>
            <dt>不良率</dt><dd>不良贷款 / 总贷款，越高代表资产质量压力越大。</dd>
            <dt>拨备覆盖率</dt><dd>贷款损失准备 / 不良贷款，衡量风险缓冲。</dd>
            <dt>CET1</dt><dd>核心一级资本充足率，衡量资本垫厚不厚。</dd>
            <dt>分红率</dt><dd>现金分红 / 归母净利润。过高可能影响资本补充，过低则股息吸引力不足。</dd>
          </dl>
          <p className="method-example">例：ROE 12%、利润还在增长，同时不良率下降，比“低 PB 但 ROE 快速下滑”的银行更可靠。</p>
          <p className="method-caution">读数顺序：先看 ROE 是否覆盖权益成本，再看利润是否恶化，最后看不良、拨备和 CET1 能不能承受压力。</p>
        </article>
        <article>
          <b>03</b>
          <h2>三类估值模型</h2>
          <p>模型不会给出唯一真值，而是从盈利能力、现金分红和长期内在价值三个角度互相校验。</p>
          <dl>
            <dt>权益成本</dt><dd>投资者要求的最低回报率。若 ROE 长期低于权益成本，账面净资产应打折。</dd>
            <dt>PB-ROE</dt><dd>核心逻辑：ROE 越高且越稳定，合理 PB 越高；合理价 = 合理 PB × 每股净资产。</dd>
            <dt>股息底部</dt><dd>价格 = 每股分红 / 目标股息率；同时计算分红削减 30% 后的压力底部。</dd>
            <dt>剩余收益</dt><dd>剩余收益 = 净资产 × (ROE - 权益成本)。只有超过权益成本的利润才增加价值。</dd>
            <dt>剩余收益价</dt><dd>内在价值 = 当前净资产 + 未来剩余收益折现，再换算到每股价格。</dd>
            <dt>情景价格</dt><dd>乐观、基准、悲观、危机四档分别对应不同 ROE、利润增速、目标 PB 和触发条件。</dd>
          </dl>
          <p className="method-example">例：每股净资产 20 元，合理 PB 0.8，则 PB-ROE 合理价约 16 元。</p>
          <p className="method-caution">解释方式：如果 PB-ROE 价、股息底部和剩余收益价都明显高于现价，信号更扎实；若只有一个模型给高价，要回到风险项检查。</p>
        </article>
        <article>
          <b>04</b>
          <h2>防守价格与红绿灯</h2>
          <p>这一组不是预测最高能涨到哪里，而是帮助判断“现在买是否有缓冲”。</p>
          <dl>
            <dt>等待价</dt><dd>综合基准情景下沿、PB-ROE 价、剩余收益价和股息托底后，再扣安全边际。</dd>
            <dt>买入差距</dt><dd>买入差距 = 等待价 / 当前价 - 1。正数表示当前价已经低于等待价，负数表示还没到等待区。</dd>
            <dt>安全边际</dt><dd>估算价值相对当前价格的折扣空间，越高越有缓冲；负数表示现价高于模型价值。</dd>
            <dt>压力价格</dt><dd>假设 ROE 下滑、分红削减或资产质量恶化时的价格，用来观察下行承受力。</dd>
            <dt>风险灯</dt><dd>根据盈利、资产质量、资本、分红稳定性给出绿/黄/红提示。</dd>
            <dt>风险标签</dt><dd>把主要风险写成短标签，例如利润下滑、拨备偏低、资本缓冲不足、股息压力。</dd>
          </dl>
          <p className="method-example">例：合理价 12 元，等待价 9.5 元，现价 10.5 元，页面会提示“接近但仍需等待”。</p>
          <p className="method-caution">使用方式：绿色不等于一定买，红色也不等于一定卖；它只是提示你先检查哪些风险项。</p>
        </article>
        <article className="method-wide">
          <b>05</b>
          <h2>银行排序如何打分</h2>
          <p>排序不是单看便宜，而是把低估、均值回归、股息、质量和风险放在一起。</p>
          <dl>
            <dt>低估分</dt><dd>PB 分位越低、相对 5 年中位 PB 折价越大，分数越高。</dd>
            <dt>回归分</dt><dd>当前 PB 回到历史中位或合理区间时的上行空间越大，分数越高。</dd>
            <dt>股息分</dt><dd>股息率较高且分红率不过度透支利润，分数越高。</dd>
            <dt>质量分</dt><dd>ROE 稳定、利润不恶化、不良率低、拨备和 CET1 有缓冲，分数越高。</dd>
            <dt>风险扣分</dt><dd>利润下滑、资产质量恶化、资本偏薄、分红不可持续都会扣分。</dd>
          </dl>
          <ol>
            <li>先计算 PB 分位、相对 5 年 PB 中位数折价、均值回归空间和基准情景上行空间。</li>
            <li>再看股息率、股息安全分、ROE、利润增速、不良率、拨备覆盖率和 CET1。</li>
            <li>把银行分为“高确定性回归、低估观察、估值中性、风险型低估、估值偏高”等状态。</li>
            <li>股息视角会另算“核心股息、股息观察、股息陷阱风险、非股息候选”。</li>
          </ol>
          <p className="method-example">例：A 银行 PB 分位 8%、ROE 稳定、股息率 5%、风险低，会排在“低估观察”前列；B 银行也低 PB，但利润转负、不良上升，会被归为“风险型低估”。</p>
          <p className="method-caution">排序的含义是“优先研究顺序”，不是自动买入名单。前排银行仍要看价格是否到等待区、风险灯是否变黄或变红。</p>
        </article>
        <article className="method-wide">
          <b>06</b>
          <h2>高股息银行策略回测</h2>
          <p>回测模拟“每期按规则选一篮子银行、定期调仓、计入交易成本和现金收益”的过程。</p>
          <dl>
            <dt>核心目标</dt><dd>寻找股息率较高、分红安全、盈利稳定、估值不过高、风险不过度暴露的银行组合。</dd>
            <dt>股息安全</dt><dd>综合分红率、ROE、利润趋势、资本缓冲和风险项，避免只追高股息率。</dd>
            <dt>稳定增长</dt><dd>偏好利润不剧烈恶化、ROE 较稳、资产质量没有明显下行的银行。</dd>
            <dt>调仓频率</dt><dd>按月、季度、半年或年度重新筛选；频率越高越灵敏，但交易成本也越高。</dd>
            <dt>交易成本</dt><dd>回测计入佣金、印花税、过户费、滑点和现金收益，避免收益被高估。</dd>
          </dl>
          <ol>
            <li>选股池：A 股上市银行，使用当时可见的价格、PB、分红、ROE、风险数据。</li>
            <li>硬过滤：剔除股息率过低、股息安全分过低、风险分过高、分红支付率过高的样本。</li>
            <li>综合打分：股息率、股息安全、稳定增长、估值折价加分，风险分扣分。</li>
            <li>持仓构建：选得分靠前的 N 只银行，按设置频率月度/季度/半年/年度调仓。</li>
            <li>绩效统计：计算累计收益、年化收益、最大回撤、夏普、胜率、股息贡献和交易成本。</li>
          </ol>
          <p className="method-example">例：设置持仓 10 只、最低股息率 3%、季度调仓；每季度重新排序，卖出跌出前列的银行，买入新进入前列的银行。</p>
          <p className="method-caution">看回测不要只看年化收益，还要同时看最大回撤、修复时间、换手率和交易成本。高股息策略的优势通常是现金流和回撤控制，不是每天都跑赢。</p>
        </article>
        <article className="method-wide">
          <b>07</b>
          <h2>建议的读数顺序</h2>
          <ol>
            <li>先看顶部实时价格和估值收盘价，确认当前价格是否已经明显偏离估值使用价格。</li>
            <li>再看风险灯和压力测试，排除利润、资产质量、资本和分红的明显红灯。</li>
            <li>看 PB 分位和均值回归空间，判断是否处于历史低位。</li>
            <li>看 PB-ROE、股息底部和剩余收益三个模型是否互相支持。</li>
            <li>最后看银行排序和回测：排序用于找候选，回测用于理解策略长期特征。</li>
          </ol>
          <p className="method-example">例：某银行 PB 分位很低，但红灯提示“利润转负、不良上升”，应先归为风险观察；另一家 PB 没那么低，但股息安全、ROE 稳定、回测回撤小，可能更适合股息组合。</p>
        </article>
      </div>
      <div className="data-note">
        <span>数据边界</span>
        <p>
          日价格主要来自 Baostock 不复权收盘价，实时价格来自第三方行情源并只用于展示和实时 PB 估算；财务数据使用估值日前已披露的最新报告。
          回测会尽量按历史时点取数，但仍受数据源覆盖、财报披露滞后和默认补齐规则影响，结果用于研究，不等同于可交易承诺。
        </p>
      </div>
    </div>
  );
}

const DETAIL_FIELDS: Array<
  [string, string, "money" | "percent" | "number" | "multiple"]
> = [
  ["bps", "每股净资产", "money"],
  ["eps", "每股收益（TTM）", "money"],
  ["daily_change_pct", "当日涨跌幅", "percent"],
  ["roe", "年化 ROE", "percent"],
  ["net_profit", "净利润", "number"],
  ["profit_growth_yoy", "净利润同比", "percent"],
  ["pe_current", "当前 PE", "multiple"],
  ["dividend_per_share", "近12个月每股现金分红", "money"],
  ["payout_ratio", "分红率", "percent"],
  ["dividend_yield", "近12个月股息率", "percent"],
  ["nim", "净息差", "percent"],
  ["npl_ratio", "不良贷款率", "percent"],
  ["provision_coverage", "拨备覆盖率", "percent"],
  ["cet1_ratio", "核心一级资本充足率", "percent"],
  ["capital_adequacy_ratio", "资本充足率", "percent"],
  ["risk_free_rate", "无风险利率（模型假设）", "percent"],
  ["equity_risk_premium", "股权风险溢价（模型假设）", "percent"],
  ["beta", "Beta（模型假设）", "multiple"],
  ["long_term_growth", "长期增长率（模型假设）", "percent"],
];

function valueFor(
  value: number | string | boolean | null,
  kind: "money" | "percent" | "number" | "multiple",
) {
  if (value === null || value === undefined) return "—";
  if (typeof value !== "number") return String(value);
  if (kind === "money") return money(value);
  if (kind === "percent") return purePct(value);
  if (kind === "multiple") return `${value.toFixed(2)}x`;
  return Math.abs(value) >= 1e8
    ? `${(value / 1e8).toFixed(2)} 亿`
    : value.toFixed(4);
}

function LegacyPbHistoryChart({
  points,
  currentPb,
}: {
  points: ValuationResult["pb_history_chart"];
  currentPb: number;
}) {
  if (points.length < 2)
    return <p className="no-history">当前数据源未提供带日期的 PB 历史序列。</p>;
  const values = points.map((point) => point.pb);
  const min = Math.min(...values) * 0.92;
  const max = Math.max(...values) * 1.08;
  const x = (index: number) => 28 + (index / (points.length - 1)) * 404;
  const y = (value: number) => 145 - ((value - min) / (max - min || 1)) * 112;
  const line = points
    .map((point, index) => `${x(index)},${y(point.pb)}`)
    .join(" ");
  return (
    <div className="pb-chart">
      <div className="chart-labels">
        <span>{points[0].date}</span>
        <b>当前 PB {currentPb.toFixed(2)}</b>
        <span>{points[points.length - 1].date}</span>
      </div>
      <svg viewBox="0 0 460 170" role="img" aria-label="历史 PB 走势">
        <line x1="25" y1="145" x2="435" y2="145" className="grid" />
        <line x1="25" y1="89" x2="435" y2="89" className="grid" />
        <line x1="25" y1="33" x2="435" y2="33" className="grid" />
        <polyline points={line} className="pb-line" />
        <circle
          cx={x(points.length - 1)}
          cy={y(points[points.length - 1].pb)}
          r="4"
          className="pb-point"
        />
        <text x="4" y="36">
          {max.toFixed(2)}
        </text>
        <text x="4" y="148">
          {min.toFixed(2)}
        </text>
      </svg>
    </div>
  );
}

function PbHistoryChart({
  points,
  currentPb,
}: {
  points: ValuationResult["pb_history_chart"];
  currentPb: number;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [chartWidth, setChartWidth] = useState(1100);
  const firstDate = points[0]?.date ?? "";
  const lastDate = points.at(-1)?.date ?? "";
  const [startDate, setStartDate] = useState(firstDate);
  const [endDate, setEndDate] = useState(lastDate);
  useEffect(() => {
    const node = svgRef.current;
    if (!node) return;
    const updateWidth = () => {
      const rect = node.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      setChartWidth(Math.max(720, Math.round((rect.width / rect.height) * 220)));
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    setStartDate(firstDate);
    setEndDate(lastDate);
    setHoverIndex(null);
  }, [firstDate, lastDate]);
  const allPriced = points.filter(
    (point): point is { date: string; pb: number; pe?: number | null; close: number } =>
      point.close !== null,
  );
  if (points.length < 2 || allPriced.length < 2)
    return <LegacyPbHistoryChart points={points} currentPb={currentPb} />;
  const rangeStart = startDate <= endDate ? startDate : endDate;
  const rangeEnd = startDate <= endDate ? endDate : startDate;
  const visiblePoints = points.filter((point) => point.date >= rangeStart && point.date <= rangeEnd);
  const priced = visiblePoints.filter(
    (point): point is { date: string; pb: number; pe?: number | null; close: number } =>
      point.close !== null,
  );
  const hasEnoughRange = visiblePoints.length >= 2 && priced.length >= 2;
  const pbValues = visiblePoints.map((point) => point.pb);
  const peValues = visiblePoints
    .map((point) => point.pe)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const prices = priced.map((point) => point.close);
  const hasPe = peValues.length >= 2;
  const percentileIn = (values: number[], value: number) =>
    values.length ? values.filter((item) => item <= value).length / values.length : null;
  const formatLocalDate = (date: Date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  const rangeForPreset = (years: number | null) => {
    if (!years) return { start: firstDate, end: lastDate };
    const cutoff = new Date(`${lastDate}T00:00:00`);
    cutoff.setFullYear(cutoff.getFullYear() - years);
    const targetStart = formatLocalDate(cutoff);
    const start = firstDate >= targetStart
      ? firstDate
      : points.find((point) => point.date >= targetStart)?.date ?? firstDate;
    return { start, end: lastDate };
  };
  const applyRangePreset = (years: number | null) => {
    const next = rangeForPreset(years);
    setStartDate(next.start);
    setEndDate(next.end);
    setHoverIndex(null);
  };
  const isRangePresetActive = (years: number | null) => {
    const preset = rangeForPreset(years);
    if (years && preset.start === firstDate) return false;
    return startDate === preset.start && endDate === preset.end;
  };
  const presetControls = (
    <div className="pb-range-presets" aria-label="历史区间快捷选择">
      {[3, 5, 10].map((years) => (
        <button
          type="button"
          key={years}
          className={isRangePresetActive(years) ? "active" : ""}
          onClick={() => applyRangePreset(years)}
        >
          {years}年
        </button>
      ))}
      <button
        type="button"
        className={isRangePresetActive(null) ? "active" : ""}
        onClick={() => applyRangePreset(null)}
      >
        所有时间
      </button>
    </div>
  );
  if (!hasEnoughRange) {
    return (
      <div className="pb-chart dual-chart">
        <div className="pb-range-controls">
          {presetControls}
          <label>开始 <input type="date" min={firstDate} max={lastDate} value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
          <label>结束 <input type="date" min={firstDate} max={lastDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
        </div>
        <p className="no-history">当前时间段内可用数据不足，请放宽开始或结束日期。</p>
      </div>
    );
  }
  const pbMin = Math.min(...pbValues) * 0.92;
  const pbMax = Math.max(...pbValues) * 1.08;
  const peMin = hasPe ? Math.min(...peValues) * 0.92 : 0;
  const peMax = hasPe ? Math.max(...peValues) * 1.08 : 1;
  const priceMin = Math.min(...prices) * 0.92;
  const priceMax = Math.max(...prices) * 1.08;
  const chartLeft = 72;
  const chartRight = chartWidth - 82;
  const chartTop = 34;
  const chartBottom = 184;
  const chartHeight = chartBottom - chartTop;
  const chartSpan = chartRight - chartLeft;
  const x = (index: number) => chartLeft + (index / (visiblePoints.length - 1)) * chartSpan;
  const pbY = (value: number) =>
    chartBottom - ((value - pbMin) / (pbMax - pbMin || 1)) * chartHeight;
  const peY = (value: number) =>
    chartBottom - ((value - peMin) / (peMax - peMin || 1)) * chartHeight;
  const priceY = (value: number) =>
    chartBottom - ((value - priceMin) / (priceMax - priceMin || 1)) * chartHeight;
  const priceAtIndex = (index: number) => {
    for (let cursor = index; cursor >= 0; cursor -= 1) {
      const close = visiblePoints[cursor]?.close;
      if (close !== null && close !== undefined) return close;
    }
    return prices[0];
  };
  const pbLine = visiblePoints
    .map((point, index) => `${x(index)},${pbY(point.pb)}`)
    .join(" ");
  const peLine = hasPe
    ? visiblePoints
        .filter((point) => typeof point.pe === "number")
        .map((point, index) => `${index === 0 ? "M" : "L"}${x(visiblePoints.indexOf(point))},${peY(point.pe as number)}`)
        .join(" ")
    : "";
  const priceLine = visiblePoints
    .map((_, index) => `${x(index)},${priceY(priceAtIndex(index))}`)
    .join(" ");
  const pbTicks = [pbMax, (pbMax + pbMin) / 2, pbMin].map((value, index) => ({
    index,
    value,
    y: pbY(value),
  }));
  const priceTicks = [priceMax, (priceMax + priceMin) / 2, priceMin].map((value, index) => ({
    index,
    value,
    y: priceY(value),
  }));
  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const chartX = ((event.clientX - rect.left) / rect.width) * chartWidth;
    const ratio = Math.min(Math.max((chartX - chartLeft) / chartSpan, 0), 1);
    setHoverIndex(Math.round(ratio * (visiblePoints.length - 1)));
  };
  const activeIndex = hoverIndex !== null && visiblePoints[hoverIndex] ? hoverIndex : null;
  const activePoint = activeIndex !== null ? visiblePoints[activeIndex] : null;
  const activePrice = activeIndex !== null ? priceAtIndex(activeIndex) : null;
  const activeX = activeIndex !== null ? x(activeIndex) : 0;
  const activePbY = activePoint ? pbY(activePoint.pb) : 0;
  const activePe = typeof activePoint?.pe === "number" ? activePoint.pe : null;
  const activePeY = activePe !== null ? peY(activePe) : 0;
  const activePriceY = activePrice !== null ? priceY(activePrice) : 0;
  const activePbPercentile = activePoint ? percentileIn(pbValues, activePoint.pb) : null;
  const activePePercentile = activePe !== null ? percentileIn(peValues, activePe) : null;
  const activePricePercentile = activePrice !== null ? percentileIn(prices, activePrice) : null;
  const activePriceReturn = activePrice !== null ? activePrice / prices[0] - 1 : 0;
  const rangeLastPoint = visiblePoints.at(-1)!;
  const rangeLastPrice = priceAtIndex(visiblePoints.length - 1);
  const rangeLastPe = typeof rangeLastPoint.pe === "number" ? rangeLastPoint.pe : null;
  const rangeLastPbPercentile = percentileIn(pbValues, rangeLastPoint.pb);
  const rangeLastPePercentile = rangeLastPe !== null ? percentileIn(peValues, rangeLastPe) : null;
  const rangeLastPricePercentile = percentileIn(prices, rangeLastPrice);
  const tooltipX = activeX > chartWidth - 238 ? activeX - 222 : activeX + 14;
  const tooltipY = activePbY < 116 ? activePbY + 12 : activePbY - 108;
  return (
    <div className="pb-chart dual-chart">
      <div className="pb-range-controls">
        {presetControls}
        <label>开始 <input type="date" min={firstDate} max={lastDate} value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
        <label>结束 <input type="date" min={firstDate} max={lastDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
      </div>
      <div className="pb-range-summary">
        <span>区间末 PB <b>{purePct(rangeLastPbPercentile ?? 0)}</b></span>
        <span>区间末 PE <b>{rangeLastPePercentile === null ? "暂无历史" : purePct(rangeLastPePercentile)}</b></span>
        <span>区间末价 <b>{purePct(rangeLastPricePercentile ?? 0)}</b></span>
      </div>
      <div className="chart-labels">
        <span>{visiblePoints[0].date}</span>
        <b>
          <i className="pb-key" />
          PB {rangeLastPoint.pb.toFixed(2)}
          {hasPe && <><i className="pe-key" />PE {rangeLastPe?.toFixed(2) ?? "—"}</>}
          <i className="price-key" />收盘价 {money(rangeLastPrice)}
        </b>
        <span>{rangeLastPoint.date}</span>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${chartWidth} 220`}
        role="img"
        aria-label="历史 PB 和不复权收盘价走势"
        tabIndex={0}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoverIndex(null)}
        onFocus={() => setHoverIndex(visiblePoints.length - 1)}
        onBlur={() => setHoverIndex(null)}
      >
        {pbTicks.map((tick) => (
          <g className="pb-axis-tick" key={`pb-${tick.index}`}>
            <line x1={chartLeft} y1={tick.y} x2={chartRight} y2={tick.y} className="grid" />
            <text x={chartLeft - 10} y={tick.y + 3} textAnchor="end">PB {tick.value.toFixed(2)}</text>
          </g>
        ))}
        {priceTicks.map((tick) => (
          <text className="price-axis-tick" x={chartRight + 10} y={tick.y + 3} key={`price-${tick.index}`}>
            ¥{tick.value.toFixed(2)}
          </text>
        ))}
        <polyline points={priceLine} className="price-history-line" />
        {peLine && <path d={peLine} className="pe-history-line" />}
        <polyline points={pbLine} className="pb-line" />
        <circle
          cx={x(visiblePoints.length - 1)}
          cy={pbY(rangeLastPoint.pb)}
          r="4"
          className="pb-point"
        />
        {rangeLastPe !== null && (
          <circle
            cx={x(visiblePoints.length - 1)}
            cy={peY(rangeLastPe)}
            r="3.7"
            className="pe-history-point"
          />
        )}
        <circle
          cx={x(visiblePoints.length - 1)}
          cy={priceY(rangeLastPrice)}
          r="3.5"
          className="price-history-point"
        />
        {activePoint && activePrice !== null && (
          <g className="pb-crosshair">
            <line x1={activeX} y1={chartTop} x2={activeX} y2={chartBottom} />
            <line x1={chartLeft} y1={activePbY} x2={chartRight} y2={activePbY} />
            <circle cx={activeX} cy={activePbY} r="4.5" className="pb-point" />
            {activePe !== null && <circle cx={activeX} cy={activePeY} r="4" className="pe-history-point" />}
            <circle cx={activeX} cy={activePriceY} r="4" className="price-history-point" />
            <g className="pb-history-tooltip" transform={`translate(${tooltipX},${tooltipY})`}>
              <rect width="208" height="122" rx="10" />
              <text className="date" x="12" y="17">{activePoint.date}</text>
              <text x="12" y="34">
                <tspan>PB</tspan><tspan className="value" x="196" textAnchor="end">{activePoint.pb.toFixed(2)}x</tspan>
              </text>
              <text x="12" y="47">
                <tspan>PE</tspan><tspan className="value pe" x="196" textAnchor="end">{activePe === null ? "暂无" : `${activePe.toFixed(2)}x`}</tspan>
              </text>
              <text x="12" y="60">
                <tspan>收盘价</tspan><tspan className="value price" x="196" textAnchor="end">{money(activePrice)}</tspan>
              </text>
              <text x="12" y="73">
                <tspan>PB分位</tspan><tspan className="value" x="196" textAnchor="end">{activePbPercentile === null ? "—" : purePct(activePbPercentile)}</tspan>
              </text>
              <text x="12" y="86">
                <tspan>PE分位</tspan><tspan className="value pe" x="196" textAnchor="end">{activePePercentile === null ? "暂无" : purePct(activePePercentile)}</tspan>
              </text>
              <text x="12" y="99">
                <tspan>价格分位</tspan><tspan className="value price" x="196" textAnchor="end">{activePricePercentile === null ? "—" : purePct(activePricePercentile)}</tspan>
              </text>
              <text x="12" y="112">
                <tspan>价格涨跌</tspan><tspan className="value price" x="196" textAnchor="end">{pct(activePriceReturn)}</tspan>
              </text>
            </g>
          </g>
        )}
        <rect className="pb-hit-zone" x={chartLeft} y={chartTop - 10} width={chartSpan} height={chartHeight + 20} />
      </svg>
      <p className="dual-note">
        绿线为 PB，橙线为 PE（后端返回历史 PE 后显示），紫线为除权除息后自然反映的实际收盘价；分位均按所选时间段重新计算。
      </p>
    </div>
  );
}

const INDUSTRY_METRIC_LABELS: Record<
  string,
  { label: string; unit: "multiple" | "percent"; leading?: boolean }
> = {
  pb: { label: "PB", unit: "multiple" },
  pe: { label: "PE", unit: "multiple" },
  roe: { label: "年化 ROE", unit: "percent" },
  profit_growth_yoy: { label: "净利润同比", unit: "percent" },
  nim: { label: "净息差", unit: "percent", leading: true },
  net_interest_spread: { label: "净利差", unit: "percent", leading: true },
  npl_ratio: { label: "不良贷款率", unit: "percent", leading: true },
  provision_coverage: { label: "拨备覆盖率", unit: "percent", leading: true },
  loan_provision_ratio: { label: "贷款拨备率", unit: "percent", leading: true },
  cet1_ratio: { label: "核心一级资本充足率", unit: "percent", leading: true },
  capital_adequacy_ratio: { label: "资本充足率", unit: "percent", leading: true },
  loan_to_deposit_ratio: { label: "存贷比", unit: "percent", leading: true },
};

function IndustryBenchmarkCard({
  benchmark,
  loading,
}: {
  benchmark: IndustryBenchmark | null;
  loading: boolean;
}) {
  if (loading)
    return (
      <section className="card industry-card">
        <span className="eyebrow">银行行业横向比较</span>
        <h2>正在汇总 A 股银行样本…</h2>
        <p className="industry-wait">
          首次查询会逐只读取同行市场与财报数据，结果将按日期写入 CSV 并缓存 24
          小时。
        </p>
      </section>
    );
  if (!benchmark)
    return (
      <section className="card industry-card">
        <span className="eyebrow">银行行业横向比较</span>
        <h2>行业基准暂未返回</h2>
        <p className="industry-wait">
          主估值不受影响；可稍后重新查询以获取同行比较。
        </p>
      </section>
    );
  return (
    <section className="card industry-card">
      <div className="section-heading">
        <div>
          <span className="eyebrow">
            {benchmark.industry_name} · {benchmark.as_of_date}
          </span>
          <h2>同行估值位置</h2>
        </div>
        <span className="pill">{benchmark.sample_size} 家样本</span>
      </div>
      <div className="indicator-flow" aria-label="先行指标到核心结果的传导图">
        <div className="flow-stage leading-stage"><span>先行观察</span><p>净息差 · 净利差 · 不良率 · 拨备 · 资本 · 存贷比</p></div>
        <i>→</i>
        <div className="flow-stage core-stage"><span>核心经营结果</span><p>ROE · 净利润同比</p></div>
        <i>→</i>
        <div className="flow-stage valuation-stage"><span>估值结果</span><p>PB · PE</p></div>
      </div>
      <div className="industry-grid">
        {Object.entries(benchmark.metrics).map(([key, metric]) => {
          const meta = INDUSTRY_METRIC_LABELS[key] ?? { label: key, unit: "percent" as const };
          const format = (value: number) =>
            meta.unit === "percent" ? purePct(value) : `${value.toFixed(2)}x`;
          return (
            <article className={meta.leading ? "leading" : ""} key={key}>
              <span>{meta.label}{meta.leading && <i className="leading-tag">先行观察</i>}<i className="sample-tag">n={metric.sample_size}</i></span>
              <b>本行 {format(metric.current_value)} · 行业中位 {format(metric.median)}</b>
              <div className="industry-range">
                <em />
                <strong style={{ left: `${metric.percentile * 100}%` }}>
                  {purePct(metric.percentile)}
                </strong>
              </div>
              <small>
                均值 {format(metric.average)} · P25–P75 {format(metric.p25)}–
                {format(metric.p75)} · 本行 {purePct(metric.percentile)}
              </small>
            </article>
          );
        })}
      </div>
      <p className="industry-note">{benchmark.data_note}</p>
    </section>
  );
}

function RiskInsights({
  result,
  monte,
}: {
  result: ValuationResult;
  monte: MonteCarloResult | null;
}) {
  const statusLabel = {
    stable: "当前稳定",
    watch: "需要跟踪",
    risk: "风险关注",
  } as const;
  return (
    <section className="card risk-insights">
      <div className="section-heading">
        <div>
          <span className="eyebrow">风险传导与市场环境</span>
          <h2>什么会让基本面变差？</h2>
        </div>
      </div>
      <p className="risk-summary">{result.risk_analysis.current_assessment}</p>
      <div className="risk-driver-grid">
        {result.risk_analysis.drivers.map((driver) => (
          <article className={driver.status} key={driver.category}>
            <div>
              <span>{driver.category}</span>
              <b>{statusLabel[driver.status]}</b>
            </div>
            <strong>{driver.current_reading}</strong>
            <p>{driver.why_it_matters}</p>
            <small>
              <em>观察信号</em>
              {driver.deterioration_signal}
            </small>
            <small className="source">数据：{driver.data_source}</small>
          </article>
        ))}
      </div>
      <div className="market-risk">
        <div>
          <span className="eyebrow">外部环境</span>
          <h3>即使本行指标暂稳，仍需留意</h3>
        </div>
        <ul>
          {result.risk_analysis.market_conditions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <div className="scenario-explainer">
        <div>
          <b>“基准上行”不是概率</b>
          <span>
            基准情景价格区间上沿 ÷ 当前价 − 1，即{" "}
            {money(result.scenarios.base.price_range[1])} 相对{" "}
            {money(result.current_price)} 的幅度。
          </span>
        </div>
        <div>
          <b>“危机下行”也不是概率</b>
          <span>
            危机场景价格区间下沿 ÷ 当前价 − 1，即{" "}
            {money(result.scenarios.crisis.price_range[0])} 相对{" "}
            {money(result.current_price)} 的幅度。
          </span>
        </div>
        {monte && (
          <div>
            <b>模拟的下跌概率</b>
            <span>
              未来模拟中价格低于当前价 80% 的次数占比：
              {purePct(monte.probability_price_down_20)}。
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

function DetailsPage({ result }: { result: ValuationResult }) {
  return (
    <div className="details-page fade-in">
      <div className="page-intro">
        <span className="eyebrow">数据全景</span>
        <h1>历史位置、输入参数与模型结果，放在同一张桌面上。</h1>
        <p>
          市场价格和 PB 来自
          Baostock；银行专属风险指标会在数据源缺失时使用后端已披露的默认假设。
        </p>
      </div>
      <section className="card full-history">
        <div className="section-heading">
          <div>
            <span className="eyebrow">全历史采样</span>
            <h2>历史 PB / PE / 收盘价轨迹</h2>
          </div>
          <div className="percentile-summary">
            <span>3年 {purePct(result.pb_percentile_3y)}</span>
            <span>5年 {purePct(result.pb_percentile_5y)}</span>
            <span>10年 {purePct(result.pb_percentile_10y)}</span>
          </div>
        </div>
        <PbHistoryChart
          points={result.pb_history_chart}
          currentPb={result.current_pb}
        />
      </section>
      <section className="details-grid">
        <section className="card detail-card">
          <span className="eyebrow">原始与默认输入</span>
          <h2>本次估值使用的数据</h2>
          <div className="data-table">
            {DETAIL_FIELDS.map(([key, label, kind]) => (
              <div key={key}>
                <span>{label}</span>
                <b>{valueFor(result.input_snapshot[key], kind)}</b>
              </div>
            ))}
          </div>
        </section>
        <section className="card detail-card">
          <span className="eyebrow">模型派生结果</span>
          <h2>三把估值尺</h2>
          <div className="model-results">
            <div>
              <span>PB-ROE 合理 PB</span>
              <b>{result.fair_pb_pb_roe.toFixed(2)}x</b>
              <small>合理价格 {money(result.pb_roe_fair_price)}</small>
            </div>
            <div>
              <span>股息率底部</span>
              <b>{money(result.dividend_floor_price)}</b>
              <small>
                分红削减压力 {money(result.dividend_stress_floor_price)}
              </small>
            </div>
            {(["3y", "5y", "10y"] as const).map((year) => (
              <div key={year}>
                <span>剩余收益 · {year}</span>
                <b>{money(result.residual_income_prices[year])}</b>
                <small>含终值的内在价值</small>
              </div>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}

function MeanReversionPage({
  overview,
  loading,
  error,
  onRefresh,
  onSelectStock,
}: {
  overview: BankMeanReversionOverview | null;
  loading: boolean;
  error: string;
  onRefresh: (forceRefresh?: boolean) => void;
  onSelectStock: (stockCode: string) => void;
}) {
  const [mode, setMode] = useState<ReversionMode>("reversion");
  const isIncomeMode = mode === "income";
  const displayRows = useMemo(() => {
    if (!overview) return [];
    if (mode === "reversion") return overview.results;
    const incomeOrder: Record<BankMeanReversionRow["income_status"], number> = {
      core_income: 0,
      income_watch: 1,
      not_income_candidate: 2,
      yield_trap_risk: 3,
    };
    return [...overview.results].sort(
      (a, b) =>
        incomeOrder[a.income_status] - incomeOrder[b.income_status] ||
        b.income_candidate_score - a.income_candidate_score ||
        b.dividend_safety_score - a.dividend_safety_score,
    );
  }, [mode, overview]);
  const leaders = displayRows.slice(0, 3);
  return (
    <div className="reversion-page fade-in">
      <div className="reversion-head">
        <div>
          <span className="eyebrow">
            {isIncomeMode ? "BANK INCOME SAFETY" : "BANK MEAN REVERSION"}
          </span>
          <h1>{isIncomeMode ? "股息安全与稳定增长候选池" : "银行低估与均值回归排序"}</h1>
          <p>
            {overview?.as_of_date
              ? `数据日期 ${overview.as_of_date}`
              : "等待全银行样本返回"}
          </p>
        </div>
        <div className="reversion-actions">
          <div className="ranking-mode" role="tablist" aria-label="排序模式">
            <button
              type="button"
              className={mode === "reversion" ? "active" : ""}
              aria-selected={mode === "reversion"}
              onClick={() => setMode("reversion")}
            >
              均值回归
            </button>
            <button
              type="button"
              className={mode === "income" ? "active" : ""}
              aria-selected={mode === "income"}
              onClick={() => setMode("income")}
            >
              股息低风险
            </button>
          </div>
          <div className="ranking-tools">
            <button className="refresh-button primary" type="button" onClick={() => onRefresh(false)} disabled={loading}>
              {loading ? "汇总中…" : "更新排序"}
            </button>
            <button className="refresh-button" type="button" onClick={() => onRefresh(true)} disabled={loading}>
              强制刷新
            </button>
          </div>
        </div>
      </div>
      {error && (
        <div className="error">
          {error}
          <span>请确认后端新接口已启动，并且 Baostock 网络可访问。</span>
        </div>
      )}
      {loading && !overview && (
        <div className="loading reversion-loading">
          <span />
          <span />
          <span /> 正在逐家银行计算估值位置
        </div>
      )}
      {overview && (
        <>
          <section className="reversion-summary">
            <article>
              <span>{isIncomeMode ? "高股息+低风险" : "候选银行"}</span>
              <b>{isIncomeMode ? overview.income_candidate_count : overview.investable_count}</b>
              <small>{isIncomeMode ? "股息安全与增长稳定优先" : "低估且未触发硬风险"}</small>
            </article>
            <article>
              <span>{isIncomeMode ? "高息陷阱提示" : "风险型低估"}</span>
              <b>{isIncomeMode ? overview.yield_trap_count : overview.risky_count}</b>
              <small>{isIncomeMode ? "高股息但基本面需警惕" : "便宜但需先看经营风险"}</small>
            </article>
            <article>
              <span>已排序样本</span>
              <b>{overview.count}</b>
              <small>失败 {overview.failed_count} 家</small>
            </article>
          </section>
          {leaders.length > 0 && (
            <section className="reversion-leaders">
              {leaders.map((row, index) => (
                <article key={row.stock_code}>
                  <div className="leader-rank">#{isIncomeMode ? index + 1 : row.rank}</div>
                  <BankLogo
                    stockCode={row.stock_code}
                    stockName={row.stock_name}
                    profile={row.bank_profile}
                  />
                  <div>
                    <h2>{row.stock_name}</h2>
                    <span>{row.stock_code}</span>
                  </div>
                  <b>
                    {(isIncomeMode ? row.income_candidate_score : row.mean_reversion_score).toFixed(1)}
                  </b>
                  <small>
                    {isIncomeMode
                      ? INCOME_STATUS[row.income_status].label
                      : REVERSION_STATUS[row.status].label}
                  </small>
                </article>
              ))}
            </section>
          )}
          <section className="card reversion-table-card">
            <div className="section-heading">
              <div>
                <span className="eyebrow">{isIncomeMode ? "股息候选池" : "排序明细"}</span>
                <h2>
                  {isIncomeMode ? "用股息安全先过滤，再看稳定增长" : "便宜，但尽量不是坏掉的便宜"}
                </h2>
              </div>
              <span className="pill">{isIncomeMode ? "income score 0–100" : "score 0–100"}</span>
            </div>
            <div className={`reversion-table ${isIncomeMode ? "income-table" : ""}`}>
              <div className="reversion-table-head">
                <span>银行</span>
                <span>{isIncomeMode ? "股息状态" : "状态"}</span>
                <span>{isIncomeMode ? "候选分" : "回归分"}</span>
                <span>{isIncomeMode ? "股息安全" : "5年PB分位"}</span>
                <span>{isIncomeMode ? "稳定增长" : "均值空间"}</span>
                <span>{isIncomeMode ? "股息质量" : "基本面"}</span>
                <span>动作</span>
              </div>
              {displayRows.map((row, index) => {
                const status = isIncomeMode
                  ? INCOME_STATUS[row.income_status]
                  : REVERSION_STATUS[row.status];
                const rowTags = isIncomeMode ? row.income_tags : row.tags;
                return (
                  <article className={`reversion-row ${status.tone}`} key={row.stock_code}>
                    <div className="row-bank">
                      <b>#{isIncomeMode ? index + 1 : row.rank}</b>
                      <BankLogo
                        stockCode={row.stock_code}
                        stockName={row.stock_name}
                        profile={row.bank_profile}
                      />
                      <div>
                        <strong>{row.stock_name}</strong>
                        <span>{row.stock_code} · PB {row.current_pb.toFixed(2)}</span>
                      </div>
                    </div>
                    <div>
                      <em className={`status-badge ${status.tone}`}>
                        {status.label}
                      </em>
                      <small>
                        {isIncomeMode
                          ? `${purePct(row.dividend_yield)} 股息率`
                          : `${purePct(row.reversion_probability)} 回归概率`}
                      </small>
                    </div>
                    <div className="score-cell">
                      <b>
                        {(isIncomeMode ? row.income_candidate_score : row.mean_reversion_score).toFixed(1)}
                      </b>
                      <i
                        style={{
                          width: `${isIncomeMode ? row.income_candidate_score : row.mean_reversion_score}%`,
                        }}
                      />
                    </div>
                    <div>
                      <strong>
                        {isIncomeMode ? row.dividend_safety_score.toFixed(1) : purePct(row.pb_percentile_5y)}
                      </strong>
                      <small>
                        {isIncomeMode ? `风险分 ${row.risk_score.toFixed(1)}` : `折价 ${pct(row.pb_discount_to_5y_median)}`}
                      </small>
                    </div>
                    <div>
                      <strong>
                        {isIncomeMode ? row.stable_growth_score.toFixed(1) : pct(row.mean_reversion_upside)}
                      </strong>
                      <small>
                        {isIncomeMode ? `利润 ${pct(row.profit_growth_yoy)}` : `安全边际 ${pct(row.margin_of_safety)}`}
                      </small>
                    </div>
                    <div className="fundamental-cell">
                      <span>ROE {purePct(row.roe)}</span>
                      <span>股息 {purePct(row.dividend_yield)}</span>
                      <span>不良 {maybePct(row.npl_ratio)}</span>
                      <span>{isIncomeMode ? `拨备 ${maybePct(row.provision_coverage)}` : `CET1 ${maybePct(row.cet1_ratio)}`}</span>
                    </div>
                    <button type="button" onClick={() => onSelectStock(row.stock_code)}>
                      查看
                    </button>
                    <p>{row.thesis}</p>
                    <div className="reversion-tags">
                      {rowTags.map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                    {row.risk_flags.length > 0 && (
                      <div className="row-risk-flags">
                        {row.risk_flags.map((flag) => (
                          <i key={flag}>{flag}</i>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
            <p className="industry-note">{overview.data_note}</p>
          </section>
        </>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="empty-state fade-in">
      <div className="empty-orb">⌁</div>
      <span className="eyebrow">开始分析</span>
      <h1>输入股票代码，查看估值、股息和风险。</h1>
      <p>
        可输入代码或银行名称；选择日期后，系统会使用当天或此前最近交易日的数据。
      </p>
    </div>
  );
}

function BankSearchBox({
  value,
  selectedCode,
  onValueChange,
  onSelect,
}: {
  value: string;
  selectedCode: string;
  onValueChange: (value: string) => void;
  onSelect: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const keyword = normalizeBankSearchText(value);
  const matches = useMemo(() => {
    if (!keyword) return BANK_OPTIONS.slice(0, 10);
    const filtered = BANK_OPTIONS.filter(([code, name]) =>
      bankSearchHaystack(code, name).includes(keyword),
    );
    if (filtered.length === 0) return BANK_OPTIONS.slice(0, 10);
    if (filtered.length === 1 && filtered[0][0] === selectedCode) {
      const rest = BANK_OPTIONS.filter(([code]) => code !== selectedCode);
      return [...filtered, ...rest].slice(0, 10);
    }
    return filtered.slice(0, 10);
  }, [keyword, selectedCode]);
  const choose = (bankCode: string) => {
    onSelect(bankCode);
    onValueChange(formatBankOption(bankCode));
    setOpen(false);
  };
  return (
    <div className="bank-search">
      <input
        value={value}
        onChange={(event) => {
          const nextValue = event.target.value;
          onValueChange(nextValue);
          setOpen(true);
          const resolved = resolveBankCode(nextValue, selectedCode);
          if (/\d{6}/.test(nextValue) && resolved !== selectedCode) {
            onSelect(resolved);
          }
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && open && matches.length > 0) {
            event.preventDefault();
            choose(matches[0][0]);
          }
          if (event.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder="输入代码或银行名"
        aria-label="搜索银行"
        autoComplete="off"
      />
      <button type="button" aria-label="展开银行列表" onClick={() => setOpen((current) => !current)}>
        ▾
      </button>
      {open && (
        <div className="bank-search-menu">
          {matches.length > 0 ? (
            matches.map(([bankCode, name]) => (
              <button
                type="button"
                className={bankCode === selectedCode ? "active" : ""}
                key={bankCode}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(bankCode)}
              >
                <span>{bankCode}</span>
                <b>{name}</b>
              </button>
            ))
          ) : (
            <p>没有匹配的银行</p>
          )}
        </div>
      )}
    </div>
  );
}

function BankLogo({
  stockCode,
  stockName,
  profile,
}: {
  stockCode: string;
  stockName: string;
  profile: ValuationResult["bank_profile"];
}) {
  const normalized = stockCode.includes(".") ? stockCode.split(".")[1] : stockCode;
  const [failed, setFailed] = useState(false);
  const hasLogo = BANK_LOGO_CODES.has(normalized);

  useEffect(() => {
    setFailed(false);
  }, [normalized]);

  return (
    <div className={`bank-logo ${failed || !hasLogo ? profile.logo_tone : "real"}`} aria-label={`${stockName} 标识`}>
      {failed || !hasLogo ? (
        profile.logo_text
      ) : (
        <img
          src={`/bank-logos/${normalized}.png`}
          alt={`${stockName} logo`}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

const BACKTEST_FREQUENCY_LABEL: Record<StrategyBacktestQuery["rebalance_frequency"], string> = {
  monthly: "每月",
  quarterly: "每季",
  semiannual: "半年",
  annual: "每年",
};

type BacktestWeightKey =
  | "dividend_weight"
  | "safety_weight"
  | "growth_weight"
  | "valuation_weight"
  | "risk_penalty_weight";

const BACKTEST_WEIGHT_KEYS: BacktestWeightKey[] = [
  "dividend_weight",
  "safety_weight",
  "growth_weight",
  "valuation_weight",
  "risk_penalty_weight",
];

const BACKTEST_WEIGHT_FIELDS: Array<[string, BacktestWeightKey, string]> = [
  ["股息权重", "dividend_weight", "越高越偏向高股息率银行。适合提高现金收益，但不要单独拉太高。"],
  ["安全权重", "safety_weight", "越高越看重分红覆盖、资本和资产质量，通常有助于压低回撤。"],
  ["增长权重", "growth_weight", "越高越看重利润、ROE 和经营稳定性，用来避开增长走弱的银行。"],
  ["低估权重", "valuation_weight", "越高越偏向 PB 历史低位和均值回归空间。"],
  ["风险权重", "risk_penalty_weight", "越高越严格惩罚风险分高的银行，追求稳健时可以提高。"],
];

type BacktestOptimizationGoal = "defensive" | "balanced" | "income";

type BacktestOptimizationOption = {
  goal: BacktestOptimizationGoal;
  label: string;
  note: string;
  query: StrategyBacktestQuery;
  metrics: StrategyBacktestResult["metrics"];
  strategyName: string;
  score: number;
};

const BACKTEST_OPTIMIZATION_META: Record<
  BacktestOptimizationGoal,
  { label: string; note: string; strategyId: BacktestStrategyId }
> = {
  defensive: { label: "稳健权重", note: "提高安全与风险权重，优先观察回撤。", strategyId: "income_core" },
  balanced: { label: "均衡权重", note: "在股息、安全、增长和低估之间折中。", strategyId: "income_core" },
  income: { label: "收益权重", note: "提高股息与低估权重，偏向收益弹性。", strategyId: "income_core" },
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const roundTo = (value: number, digits = 2) => Number(value.toFixed(digits));
const backtestWeightTotal = (query: Pick<StrategyBacktestQuery, BacktestWeightKey>) =>
  roundTo(BACKTEST_WEIGHT_KEYS.reduce((sum, key) => sum + query[key], 0), 2);

const normalizeWeightPatch = (weights: Record<BacktestWeightKey, number>) => {
  const units = BACKTEST_WEIGHT_KEYS.reduce((next, key) => ({
    ...next,
    [key]: Math.round(clamp(weights[key], 0, 1) * 100),
  }), {} as Record<BacktestWeightKey, number>);
  let total = BACKTEST_WEIGHT_KEYS.reduce((sum, key) => sum + units[key], 0);
  if (total < 100) {
    units.risk_penalty_weight += 100 - total;
  } else if (total > 100) {
    let overflow = total - 100;
    const reducers: BacktestWeightKey[] = [
      "risk_penalty_weight",
      ...BACKTEST_WEIGHT_KEYS
        .filter((key) => key !== "risk_penalty_weight")
        .sort((left, right) => units[right] - units[left]),
    ];
    for (const key of reducers) {
      if (overflow <= 0) break;
      const take = Math.min(units[key], overflow);
      units[key] -= take;
      overflow -= take;
    }
  }
  return BACKTEST_WEIGHT_KEYS.reduce((next, key) => ({
    ...next,
    [key]: roundTo(units[key] / 100, 2),
  }), {} as Record<BacktestWeightKey, number>);
};

const rebalanceBacktestWeights = (
  query: StrategyBacktestQuery,
  changedKey: BacktestWeightKey,
  nextValue: number,
) => {
  const units = BACKTEST_WEIGHT_KEYS.reduce((next, key) => ({
    ...next,
    [key]: Math.round(clamp(query[key], 0, 1) * 100),
  }), {} as Record<BacktestWeightKey, number>);
  const requested = Math.round(clamp(nextValue, 0, 1) * 100);
  const current = units[changedKey];
  const delta = requested - current;
  const balanceKey: BacktestWeightKey = changedKey === "risk_penalty_weight"
    ? "safety_weight"
    : "risk_penalty_weight";

  if (delta > 0) {
    let need = delta;
    const reducers: BacktestWeightKey[] = [
      balanceKey,
      ...BACKTEST_WEIGHT_KEYS
        .filter((key) => key !== changedKey && key !== balanceKey)
        .sort((left, right) => units[right] - units[left]),
    ];
    for (const key of reducers) {
      if (need <= 0) break;
      const take = Math.min(units[key], need);
      units[key] -= take;
      need -= take;
    }
    units[changedKey] = current + delta - need;
  } else if (delta < 0) {
    units[changedKey] = requested;
    units[balanceKey] += -delta;
  }

  return BACKTEST_WEIGHT_KEYS.reduce((next, key) => ({
    ...next,
    [key]: roundTo(units[key] / 100, 2),
  }), {} as Record<BacktestWeightKey, number>);
};

const normalizeBacktestQuery = (query: StrategyBacktestQuery): StrategyBacktestQuery => ({
  ...query,
  years: Math.round(clamp(query.years, 3, 15)),
  holding_count: Math.round(clamp(query.holding_count, 3, 20)),
  min_dividend_yield: roundTo(clamp(query.min_dividend_yield, 0, .12), 4),
  min_dividend_safety: Math.round(clamp(query.min_dividend_safety, 0, 95)),
  min_stable_growth: Math.round(clamp(query.min_stable_growth, 0, 95)),
  max_risk_score: Math.round(clamp(query.max_risk_score, 15, 75)),
  max_payout_ratio: roundTo(clamp(query.max_payout_ratio, .35, 1.2), 3),
  initial_capital: Math.round(clamp(query.initial_capital ?? DEFAULT_BACKTEST_QUERY.initial_capital, 10_000, 1_000_000_000)),
  commission_rate: roundTo(clamp(query.commission_rate ?? DEFAULT_BACKTEST_QUERY.commission_rate, 0, .01), 6),
  stamp_duty_rate: roundTo(clamp(query.stamp_duty_rate ?? DEFAULT_BACKTEST_QUERY.stamp_duty_rate, 0, .02), 6),
  transfer_fee_rate: roundTo(clamp(query.transfer_fee_rate ?? DEFAULT_BACKTEST_QUERY.transfer_fee_rate, 0, .01), 6),
  slippage_rate: roundTo(clamp(query.slippage_rate ?? DEFAULT_BACKTEST_QUERY.slippage_rate, 0, .02), 6),
  cash_yield: roundTo(clamp(query.cash_yield ?? DEFAULT_BACKTEST_QUERY.cash_yield, 0, .1), 6),
  ...normalizeWeightPatch({
    dividend_weight: query.dividend_weight ?? DEFAULT_BACKTEST_QUERY.dividend_weight,
    safety_weight: query.safety_weight ?? DEFAULT_BACKTEST_QUERY.safety_weight,
    growth_weight: query.growth_weight ?? DEFAULT_BACKTEST_QUERY.growth_weight,
    valuation_weight: query.valuation_weight ?? DEFAULT_BACKTEST_QUERY.valuation_weight,
    risk_penalty_weight: query.risk_penalty_weight ?? DEFAULT_BACKTEST_QUERY.risk_penalty_weight,
  }),
});

const MIN_BACKTEST_CALENDAR_DAYS = 170;

const parseDateOnly = (value: string | null | undefined) => {
  if (!value) return null;
  const timestamp = Date.parse(`${value}T00:00:00`);
  return Number.isFinite(timestamp) ? timestamp : null;
};

const validateBacktestDateRange = (query: StrategyBacktestQuery) => {
  const start = parseDateOnly(query.start_date);
  const end = parseDateOnly(query.end_date);
  if (start === null || end === null) return "";
  if (end < start) return "结束日期不能早于开始日期";
  const calendarDays = Math.floor((end - start) / 86_400_000) + 1;
  if (calendarDays < MIN_BACKTEST_CALENDAR_DAYS) {
    return "回测区间太短，至少选择约 6 个月（后端最低 120 个交易日），否则样本不足容易误判";
  }
  return "";
};

const selectNumericInput = (event: ReactFocusEvent<HTMLInputElement>) => {
  event.currentTarget.select();
};

const trimIntegerLeadingZeros = (event: FormEvent<HTMLInputElement>) => {
  const input = event.currentTarget;
  if (input.step && input.step !== "1") return;
  if (!/^0\d+$/.test(input.value)) return;
  input.value = String(Number(input.value));
};

const backtestQueryKey = (query: StrategyBacktestQuery) =>
  JSON.stringify({
    years: query.years,
    start_date: query.start_date ?? null,
    end_date: query.end_date ?? null,
    rebalance_frequency: query.rebalance_frequency,
    holding_count: query.holding_count,
    min_dividend_yield: query.min_dividend_yield,
    min_dividend_safety: query.min_dividend_safety,
    min_stable_growth: query.min_stable_growth,
    max_risk_score: query.max_risk_score,
    max_payout_ratio: query.max_payout_ratio,
    dividend_weight: query.dividend_weight,
    safety_weight: query.safety_weight,
    growth_weight: query.growth_weight,
    valuation_weight: query.valuation_weight,
    risk_penalty_weight: query.risk_penalty_weight,
    initial_capital: query.initial_capital,
    commission_rate: query.commission_rate,
    stamp_duty_rate: query.stamp_duty_rate,
    transfer_fee_rate: query.transfer_fee_rate,
    slippage_rate: query.slippage_rate,
    cash_yield: query.cash_yield,
  });

const buildOptimizationCandidates = (baseQuery: StrategyBacktestQuery) => {
  const base = normalizeBacktestQuery(baseQuery);
  const patch = (
    goal: BacktestOptimizationGoal,
    weights: Record<BacktestWeightKey, number>,
  ) => ({ goal, query: normalizeBacktestQuery({ ...base, ...normalizeWeightPatch(weights) }) });
  const candidates = [
    patch("defensive", {
      dividend_weight: .22,
      safety_weight: .3,
      growth_weight: .18,
      valuation_weight: .1,
      risk_penalty_weight: .2,
    }),
    patch("defensive", {
      dividend_weight: .18,
      safety_weight: .34,
      growth_weight: .2,
      valuation_weight: .08,
      risk_penalty_weight: .2,
    }),
    patch("defensive", {
      dividend_weight: .25,
      safety_weight: .28,
      growth_weight: .15,
      valuation_weight: .12,
      risk_penalty_weight: .2,
    }),
    patch("defensive", {
      dividend_weight: base.dividend_weight,
      safety_weight: base.safety_weight + .08,
      growth_weight: base.growth_weight,
      valuation_weight: base.valuation_weight - .05,
      risk_penalty_weight: base.risk_penalty_weight + .07,
    }),
    patch("balanced", {
      dividend_weight: .25,
      safety_weight: .25,
      growth_weight: .2,
      valuation_weight: .15,
      risk_penalty_weight: .15,
    }),
    patch("balanced", {
      dividend_weight: .22,
      safety_weight: .24,
      growth_weight: .24,
      valuation_weight: .16,
      risk_penalty_weight: .14,
    }),
    patch("balanced", {
      dividend_weight: .28,
      safety_weight: .22,
      growth_weight: .18,
      valuation_weight: .18,
      risk_penalty_weight: .14,
    }),
    patch("balanced", {
      dividend_weight: base.dividend_weight,
      safety_weight: base.safety_weight,
      growth_weight: base.growth_weight,
      valuation_weight: base.valuation_weight,
      risk_penalty_weight: base.risk_penalty_weight,
    }),
    patch("income", {
      dividend_weight: .36,
      safety_weight: .18,
      growth_weight: .16,
      valuation_weight: .2,
      risk_penalty_weight: .1,
    }),
    patch("income", {
      dividend_weight: .32,
      safety_weight: .2,
      growth_weight: .14,
      valuation_weight: .22,
      risk_penalty_weight: .12,
    }),
    patch("income", {
      dividend_weight: .4,
      safety_weight: .16,
      growth_weight: .12,
      valuation_weight: .22,
      risk_penalty_weight: .1,
    }),
    patch("income", {
      dividend_weight: base.dividend_weight + .08,
      safety_weight: base.safety_weight - .04,
      growth_weight: base.growth_weight - .03,
      valuation_weight: base.valuation_weight + .05,
      risk_penalty_weight: base.risk_penalty_weight - .06,
    }),
  ];
  const seen = new Set<string>();
  return candidates.filter((item) => {
    const key = `${item.goal}:${backtestQueryKey(item.query)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const scoreBacktestOption = (
  goal: BacktestOptimizationGoal,
  metrics: StrategyBacktestResult["metrics"],
) => {
  const annual = metrics.annualized_return;
  const drawdown = Math.abs(metrics.max_drawdown);
  const sharpe = metrics.sharpe ?? 0;
  const calmar = metrics.calmar ?? 0;
  const dividend = metrics.annual_dividend_return;
  const win = metrics.win_year_rate;
  const volatility = metrics.volatility;
  const turnover = metrics.turnover;
  if (goal === "defensive") {
    return annual * 80 + dividend * 35 + win * 10 + sharpe * 2 + calmar * 1.5 - drawdown * 120 - volatility * 25 - turnover * 1.2;
  }
  if (goal === "income") {
    return annual * 120 + dividend * 45 + win * 6 + sharpe * 1.4 + calmar - drawdown * 55 - volatility * 12 - turnover * .6;
  }
  return annual * 100 + dividend * 25 + win * 8 + sharpe * 2 + calmar * 1.2 - drawdown * 75 - volatility * 18 - turnover * .8;
};

const pickOptimizationResult = (
  response: StrategyBacktestResponse,
  goal: BacktestOptimizationGoal,
) => {
  const preferred = BACKTEST_OPTIMIZATION_META[goal].strategyId;
  return response.results.find((item) => item.strategy_id === preferred) ?? response.results[0] ?? null;
};

type HoldingContribution = {
  entryDate: string | null;
  holdingDays: number;
  profit: number;
};

const daysBetween = (start: string, end: string) => {
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return 0;
  return Math.max(0, Math.round((endTime - startTime) / 86_400_000));
};

const pointValueAtOrBefore = (
  points: Array<{ date: string; value: number }> | undefined,
  date: string,
) => {
  if (!points?.length) return 0;
  let value = points[0].value;
  for (const point of points) {
    if (point.date > date) break;
    value = point.value;
  }
  return value;
};

const snapshotAtOrBefore = (strategy: StrategyBacktestResult, date: string) => {
  let active = strategy.holding_snapshots?.[0] ?? null;
  for (const snapshot of strategy.holding_snapshots ?? []) {
    if (snapshot.date > date) break;
    active = snapshot;
  }
  return active;
};

const holdingEntryDate = (strategy: StrategyBacktestResult, stockCode: string, date: string) => {
  let entryDate: string | null = null;
  let inPosition = false;
  for (const snapshot of strategy.holding_snapshots ?? []) {
    if (snapshot.date > date) break;
    const exists = snapshot.holdings.some((holding) => holding.stock_code === stockCode);
    if (exists && !inPosition) {
      entryDate = snapshot.date;
    }
    inPosition = exists;
  }
  return inPosition ? entryDate : null;
};

const holdingContribution = (
  strategy: StrategyBacktestResult,
  stockCode: string,
  date: string,
): HoldingContribution => {
  const snapshotHolding = snapshotAtOrBefore(strategy, date)?.holdings.find(
    (holding) => holding.stock_code === stockCode,
  );
  const entryDate = snapshotHolding?.entry_date ?? holdingEntryDate(strategy, stockCode, date);
  return {
    entryDate,
    holdingDays: snapshotHolding?.holding_days ?? (entryDate ? daysBetween(entryDate, date) : 0),
    profit: snapshotHolding?.profit ?? 0,
  };
};

const holdingIntervalsForStock = (
  strategy: StrategyBacktestResult,
  stockCode: string,
  lastDate: string,
) => {
  const intervals: Array<{ start: string; end: string }> = [];
  let activeStart: string | null = null;
  const snapshots = strategy.holding_snapshots ?? [];

  snapshots.forEach((snapshot, index) => {
    const hasHolding = snapshot.holdings.some((holding) => holding.stock_code === stockCode);
    const nextDate = snapshots[index + 1]?.date ?? lastDate;
    if (hasHolding && activeStart === null) {
      activeStart = snapshot.date;
    }
    if ((!hasHolding || index === snapshots.length - 1) && activeStart !== null) {
      intervals.push({ start: activeStart, end: hasHolding ? nextDate : snapshot.date });
      activeStart = null;
    }
  });

  return intervals;
};

const segmentOverlapsIntervals = (
  startDate: string,
  endDate: string,
  intervals: Array<{ start: string; end: string }>,
) => intervals.some((interval) => startDate <= interval.end && endDate >= interval.start);

const highlightedPathSegments = (
  points: Array<{ date: string; value: number }>,
  x: (index: number) => number,
  y: (value: number) => number,
  intervals: Array<{ start: string; end: string }>,
) => {
  const segments: string[] = [];
  let current: string[] = [];
  points.forEach((point, index) => {
    const previous = points[index - 1];
    const segmentStart = previous?.date ?? point.date;
    const highlighted = segmentOverlapsIntervals(segmentStart, point.date, intervals);
    const command = `${current.length === 0 ? "M" : "L"}${x(index).toFixed(2)},${y(point.value).toFixed(2)}`;
    if (highlighted) {
      current.push(command);
      return;
    }
    if (current.length > 1) segments.push(current.join(" "));
    current = [];
  });
  if (current.length > 1) segments.push(current.join(" "));
  return segments;
};

function ParamLabel({ label, tooltip }: { label: string; tooltip: string }) {
  return (
    <span className="param-label">
      {label}
      <i className="help-dot" data-tooltip={tooltip}>?</i>
    </span>
  );
}

function NumberStepper({
  value,
  min,
  max,
  step = 1,
  decimals = 0,
  onChange,
  ariaLabel,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  decimals?: number;
  onChange: (value: number) => void;
  ariaLabel: string;
}) {
  const normalized = clamp(value, min, max);
  const format = (item: number) => (decimals > 0 ? item.toFixed(decimals) : `${Math.round(item)}`);
  const [draft, setDraft] = useState(format(normalized));
  useEffect(() => {
    setDraft(format(normalized));
  }, [normalized, decimals]);
  const commit = (next: number) => {
    if (!Number.isFinite(next)) return;
    const committed = roundTo(clamp(next, min, max), decimals);
    setDraft(format(committed));
    onChange(committed);
  };

  return (
    <div className="number-stepper">
      <button
        type="button"
        onClick={() => commit(normalized - step)}
        disabled={normalized <= min}
        aria-label={`${ariaLabel} 减少`}
      >
        -
      </button>
      <input
        inputMode={decimals > 0 ? "decimal" : "numeric"}
        value={draft}
        onFocus={selectNumericInput}
        onInput={trimIntegerLeadingZeros}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => commit(Number(draft))}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
        aria-label={ariaLabel}
      />
      <button
        type="button"
        onClick={() => commit(normalized + step)}
        disabled={normalized >= max}
        aria-label={`${ariaLabel} 增加`}
      >
        +
      </button>
    </div>
  );
}

function BacktestLineChart({
  strategy,
  mode,
  highlightedStockCode,
  benchmarkPoints,
}: {
  strategy: StrategyBacktestResult;
  mode: "equity" | "drawdown";
  highlightedStockCode?: string;
  benchmarkPoints?: Array<{ date: string; value: number }>;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [chartWidth, setChartWidth] = useState(900);
  const points = mode === "equity" ? strategy.equity_curve : strategy.drawdown_curve;
  useEffect(() => {
    const node = svgRef.current;
    if (!node) return;
    const updateWidth = () => {
      const rect = node.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      setChartWidth(Math.max(450, Math.round((rect.width / rect.height) * 150)));
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const benchmarkSeries = mode === "equity" && benchmarkPoints?.length
    ? points
        .map((point, index) => ({
          date: point.date,
          value: pointValueAtOrBefore(benchmarkPoints, point.date),
          index,
        }))
        .filter((point) => point.value > 0)
    : [];
  const values = [...points.map((point) => point.value), ...benchmarkSeries.map((point) => point.value)];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const chartLeft = mode === "equity" ? 64 : 54;
  const chartRight = chartWidth - 20;
  const chartSpan = chartRight - chartLeft;
  const y = (value: number) => 126 - ((value - min) / (max - min || 1)) * 100;
  const x = (index: number) => chartLeft + (index / Math.max(points.length - 1, 1)) * chartSpan;
  const yTicks = [max, (max + min) / 2, min].map((value, index) => ({
    index,
    value,
    y: y(value),
    label: mode === "equity" ? capitalMoney(value) : drawdownPct(value),
  }));
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(2)},${y(point.value).toFixed(2)}`).join(" ");
  const benchmarkPath = benchmarkSeries
    .map((point, index) => `${index === 0 ? "M" : "L"}${x(point.index).toFixed(2)},${y(point.value).toFixed(2)}`)
    .join(" ");
  const lastPointDate = points.at(-1)?.date ?? "";
  const highlightSegments = mode === "equity" && highlightedStockCode
    ? highlightedPathSegments(
        points,
        x,
        y,
        holdingIntervalsForStock(strategy, highlightedStockCode, lastPointDate),
      )
    : [];
  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const chartX = ((event.clientX - rect.left) / rect.width) * chartWidth;
    const ratio = Math.min(Math.max((chartX - chartLeft) / chartSpan, 0), 1);
    setHoverIndex(Math.round(ratio * Math.max(points.length - 1, 0)));
  };
  const maxDrawdownIndex = mode === "drawdown"
    ? points.findIndex((point) => point.date === strategy.metrics.max_drawdown_date)
    : -1;
  const maxDrawdownPoint = maxDrawdownIndex >= 0 ? points[maxDrawdownIndex] : null;
  const markerX = maxDrawdownIndex >= 0 ? x(maxDrawdownIndex) : 0;
  const markerY = maxDrawdownPoint ? y(maxDrawdownPoint.value) : 0;
  const markerLabelX = Math.min(Math.max(markerX, 82), chartWidth - 82);
  const activeIndex = hoverIndex !== null && points[hoverIndex] ? hoverIndex : null;
  const activePoint = activeIndex !== null ? points[activeIndex] : null;
  const activeX = activeIndex !== null ? x(activeIndex) : 0;
  const activeY = activePoint ? y(activePoint.value) : 0;
  const activeEquity = activePoint
    ? { date: activePoint.date, value: pointValueAtOrBefore(strategy.equity_curve, activePoint.date) }
    : null;
  const activeDrawdown = activePoint
    ? { date: activePoint.date, value: pointValueAtOrBefore(strategy.drawdown_curve, activePoint.date) }
    : null;
  const initialEquity = strategy.equity_curve[0]?.value || 1;
  const initialBenchmark = benchmarkPoints?.[0]?.value || initialEquity;
  const cumulativeReturn = activeEquity ? activeEquity.value / initialEquity - 1 : null;
  const activeBenchmarkValue = activePoint ? pointValueAtOrBefore(benchmarkPoints, activePoint.date) : 0;
  const benchmarkReturn = activeBenchmarkValue > 0 ? activeBenchmarkValue / initialBenchmark - 1 : null;
  const excessReturn = cumulativeReturn !== null && benchmarkReturn !== null
    ? cumulativeReturn - benchmarkReturn
    : null;
  const activeCost = activePoint ? pointValueAtOrBefore(strategy.transaction_cost_curve, activePoint.date) : 0;
  const drawdownToDate = activeIndex !== null
    ? Math.min(...strategy.drawdown_curve.slice(0, activeIndex + 1).map((point) => point.value))
    : null;
  const activeSnapshot = activePoint
    ? [...(strategy.holding_snapshots ?? [])]
        .reverse()
        .find((snapshot) => snapshot.date <= activePoint.date)
    : null;
  const activeHoldings = activeSnapshot?.holdings ?? [];
  const tooltipHoldingStartY = 135;
  const tooltipHoldingRowGap = 11;
  const tooltipHeight = Math.max(150, tooltipHoldingStartY + Math.max(activeHoldings.length, 1) * tooltipHoldingRowGap + 8);
  const tooltipX = activeX > chartWidth - 228 ? activeX - 214 : activeX + 10;
  const tooltipY = 0;
  return (
    <svg
      ref={svgRef}
      className={`backtest-chart ${mode}`}
      viewBox={`0 0 ${chartWidth} 150`}
      role="img"
      aria-label={`${strategy.strategy_name}${mode === "equity" ? "净值曲线" : "回撤曲线"}`}
      tabIndex={0}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setHoverIndex(null)}
      onFocus={() => setHoverIndex(points.length - 1)}
      onBlur={() => setHoverIndex(null)}
    >
      {yTicks.map((tick) => (
        <g className="chart-y-tick" key={`${mode}-tick-${tick.index}`}>
          <line x1={chartLeft} y1={tick.y} x2={chartRight} y2={tick.y} className="grid" />
          <text x={chartLeft - 8} y={tick.y + 3} textAnchor="end">{tick.label}</text>
        </g>
      ))}
      {benchmarkPath && <path className="benchmark-line" d={benchmarkPath} />}
      <path className="strategy-line" d={path} />
      {highlightSegments.map((segment, index) => (
        <path className="holding-highlight-line" d={segment} key={`${highlightedStockCode}-${index}`} />
      ))}
      {maxDrawdownPoint && (
        <g className="drawdown-marker">
          <line x1={markerX} y1="18" x2={markerX} y2="126" />
          <circle cx={markerX} cy={markerY} r="4.5" />
          <text x={markerLabelX} y="24" textAnchor="middle">
            <tspan x={markerLabelX}>最大回撤 {drawdownPct(maxDrawdownPoint.value)}</tspan>
            <tspan x={markerLabelX} dy="12">{maxDrawdownPoint.date}</tspan>
          </text>
        </g>
      )}
      {activePoint && activeEquity && activeDrawdown && cumulativeReturn !== null && drawdownToDate !== null && (
        <g className="chart-crosshair">
          <line x1={activeX} y1="18" x2={activeX} y2="126" />
          <line x1={chartLeft} y1={activeY} x2={chartRight} y2={activeY} />
          <circle cx={activeX} cy={activeY} r="4.5" />
          <g className="chart-tooltip" transform={`translate(${tooltipX},${tooltipY})`}>
            <rect width="204" height={tooltipHeight} rx="12" />
            <line className="tooltip-divider" x1="12" y1="24" x2="192" y2="24" />
            <line className="tooltip-divider subtle" x1="12" y1="109" x2="192" y2="109" />
            <text className="date" x="12" y="16">{activePoint.date}</text>
            <text x="12" y="37">
              <tspan>累计</tspan><tspan className="value" x="192" textAnchor="end">{pct(cumulativeReturn)}</tspan>
            </text>
            <text x="12" y="50">
              <tspan>基准</tspan><tspan className="value benchmark-value" x="192" textAnchor="end">{benchmarkReturn !== null ? pct(benchmarkReturn) : "..."}</tspan>
            </text>
            <text x="12" y="63">
              <tspan>超额</tspan><tspan className="value" x="192" textAnchor="end">{excessReturn !== null ? pct(excessReturn) : "..."}</tspan>
            </text>
            <text x="12" y="76">
              <tspan>回撤</tspan><tspan className="value" x="192" textAnchor="end">{drawdownPct(activeDrawdown.value)}</tspan>
            </text>
            <text x="12" y="89">
              <tspan>最大</tspan><tspan className="value" x="192" textAnchor="end">{drawdownPct(drawdownToDate)}</tspan>
            </text>
            <text x="12" y="102">
              <tspan>成本</tspan><tspan className="value" x="192" textAnchor="end">{capitalMoney(activeCost)}</tspan>
            </text>
            <text className="holdings-title" x="12" y="121">
              持仓 {activeSnapshot ? `${activeSnapshot.date} · ${activeHoldings.length}只` : "暂无快照"}
            </text>
            {activeHoldings.map((holding, index) => {
              const contribution = holdingContribution(strategy, holding.stock_code, activePoint.date);
              return (
                <text className="holding-row" x="12" y={tooltipHoldingStartY + index * tooltipHoldingRowGap} key={holding.stock_code}>
                  <tspan>{holding.stock_name}</tspan>
                  <tspan className="muted" dx="4">{contribution.holdingDays}天</tspan>
                  <tspan className="value" x="192" textAnchor="end">{capitalMoney(contribution.profit)}</tspan>
                </text>
              );
            })}
          </g>
        </g>
      )}
      <rect className="chart-hit-zone" x={chartLeft} y="12" width={chartSpan} height="120" />
      <text x={chartLeft} y="144">{points[0]?.date.slice(0, 4)}</text>
      <text x={chartRight} y="144" textAnchor="end">{points.at(-1)?.date.slice(0, 4)}</text>
    </svg>
  );
}

function BacktestPage({
  backtest,
  loading,
  error,
  preparing,
  query,
  onQueryChange,
  onRunWithQuery,
  onRefresh,
  onPrepare,
}: {
  backtest: StrategyBacktestResponse | null;
  loading: boolean;
  error: string;
  preparing: boolean;
  query: StrategyBacktestQuery;
  onQueryChange: (query: StrategyBacktestQuery) => void;
  onRunWithQuery: (query: StrategyBacktestQuery) => void;
  onRefresh: () => void;
  onPrepare: () => void;
}) {
  const [optimizing, setOptimizing] = useState(false);
  const [optimizationError, setOptimizationError] = useState("");
  const [optimizationOptions, setOptimizationOptions] = useState<BacktestOptimizationOption[]>([]);
  const [savedPresets, setSavedPresets] = useState<SavedBacktestPreset[]>(readSavedBacktestPresets);
  const [selectedSavedPresetId, setSelectedSavedPresetId] = useState("");
  const [highlightedHoldingCode, setHighlightedHoldingCode] = useState("");
  const [chartHeight, setChartHeight] = useState(() => {
    const saved = Number(localStorage.getItem("bank-backtest-chart-height"));
    return Number.isFinite(saved) && saved >= 160 && saved <= 260 ? saved : 190;
  });
  const active = backtest?.results.find((item) => item.strategy_id === "income_core") ?? backtest?.results[0] ?? null;
  const activeHighlightedHolding = active?.current_holdings.find((item) => item.stock_code === highlightedHoldingCode)
    ?? active?.current_holdings[0]
    ?? null;
  const weightTotal = backtestWeightTotal(query);
  const updateQuery = <K extends keyof StrategyBacktestQuery,>(key: K, value: StrategyBacktestQuery[K]) => {
    setOptimizationError("");
    setOptimizationOptions([]);
    setSelectedSavedPresetId("");
    onQueryChange({ ...query, [key]: value });
  };
  const updateWeight = (key: BacktestWeightKey, value: number) => {
    setOptimizationError("");
    setOptimizationOptions([]);
    setSelectedSavedPresetId("");
    onQueryChange({ ...query, ...rebalanceBacktestWeights(query, key, value) });
  };
  const updateBuyCostRate = (value: number) => {
    setOptimizationError("");
    setOptimizationOptions([]);
    setSelectedSavedPresetId("");
    onQueryChange({
      ...query,
      commission_rate: roundTo(Math.max(0, value), 6),
      transfer_fee_rate: 0,
      slippage_rate: 0,
    });
  };
  useEffect(() => {
    if (Math.abs(weightTotal - 1) <= 0.001) return;
    onQueryChange({
      ...query,
      ...normalizeWeightPatch({
        dividend_weight: query.dividend_weight,
        safety_weight: query.safety_weight,
        growth_weight: query.growth_weight,
        valuation_weight: query.valuation_weight,
        risk_penalty_weight: query.risk_penalty_weight,
      }),
    });
  }, [weightTotal]);
  const isPresetActive = (preset: StrategyBacktestQuery) => (
    BACKTEST_PRESET_COMPARE_KEYS.every((key) => query[key] === preset[key])
  );
  const applyPreset = (preset: StrategyBacktestQuery) => {
    setOptimizationError("");
    setOptimizationOptions([]);
    setSelectedSavedPresetId("");
    onRunWithQuery(preset);
  };
  const saveCurrentPreset = () => {
    const preset: SavedBacktestPreset = {
      id: `${Date.now()}`,
      name: savedPresetName(),
      createdAt: new Date().toISOString(),
      query: normalizeBacktestQuery(query),
    };
    const next = [preset, ...savedPresets].slice(0, 20);
    setSavedPresets(next);
    setSelectedSavedPresetId(preset.id);
    writeSavedBacktestPresets(next);
  };
  const applySavedPreset = (presetId: string) => {
    setSelectedSavedPresetId(presetId);
    const preset = savedPresets.find((item) => item.id === presetId);
    if (!preset) return;
    setOptimizationError("");
    setOptimizationOptions([]);
    onRunWithQuery(normalizeBacktestQuery(preset.query));
  };
  const deleteSelectedPreset = () => {
    if (!selectedSavedPresetId) return;
    const next = savedPresets.filter((item) => item.id !== selectedSavedPresetId);
    setSavedPresets(next);
    setSelectedSavedPresetId("");
    writeSavedBacktestPresets(next);
  };
  const runOptimization = async () => {
    if (dateRangeError) {
      setOptimizationError(dateRangeError);
      return;
    }
    setOptimizing(true);
    setOptimizationError("");
    setOptimizationOptions([]);
    try {
      const best = new Map<BacktestOptimizationGoal, BacktestOptimizationOption>();
      let failures = 0;

      for (const candidate of buildOptimizationCandidates(query)) {
        try {
          const response = await getStrategyBacktest(candidate.query);
          const result = pickOptimizationResult(response, candidate.goal);
          if (!result) {
            failures += 1;
            continue;
          }
          const meta = BACKTEST_OPTIMIZATION_META[candidate.goal];
          const option: BacktestOptimizationOption = {
            goal: candidate.goal,
            label: meta.label,
            note: meta.note,
            query: candidate.query,
            metrics: result.metrics,
            strategyName: result.strategy_name,
            score: scoreBacktestOption(candidate.goal, result.metrics),
          };
          const previous = best.get(candidate.goal);
          if (!previous || option.score > previous.score) {
            best.set(candidate.goal, option);
          }
        } catch {
          failures += 1;
        }
      }

      const ordered = (["defensive", "balanced", "income"] as BacktestOptimizationGoal[])
        .map((goal) => best.get(goal))
        .filter((item): item is BacktestOptimizationOption => Boolean(item));
      setOptimizationOptions(ordered);
      if (ordered.length === 0) {
        setOptimizationError("暂时没有算出可用权重组，请先确认缓存/后端可用后再试。");
      } else if (failures > 0) {
        setOptimizationError(`有 ${failures} 组候选权重回测失败，已展示可用结果。`);
      }
    } finally {
      setOptimizing(false);
    }
  };
  const runLabel = query.start_date || query.end_date
    ? `${query.start_date || backtest?.start_date || "start"} 至 ${query.end_date || backtest?.end_date || "latest"}`
    : `${query.years}年 · ${BACKTEST_FREQUENCY_LABEL[query.rebalance_frequency]}`;
  const activeStartValue = active?.equity_curve[0]?.value ?? query.initial_capital;
  const activeEndValue = active?.equity_curve.at(-1)?.value ?? activeStartValue;
  const activeProfit = activeEndValue - activeStartValue;
  const activeTransactionCost = active?.metrics.total_transaction_cost
    ?? pointValueAtOrBefore(active?.transaction_cost_curve, active?.equity_curve.at(-1)?.date ?? "")
    ?? 0;
  const buyCostRate = query.commission_rate + query.transfer_fee_rate + query.slippage_rate;
  const dateRangeError = validateBacktestDateRange(query);
  useEffect(() => {
    localStorage.setItem("bank-backtest-chart-height", `${chartHeight}`);
  }, [chartHeight]);
  useEffect(() => {
    if (!active?.current_holdings.length) {
      setHighlightedHoldingCode("");
      return;
    }
    if (!active.current_holdings.some((item) => item.stock_code === highlightedHoldingCode)) {
      setHighlightedHoldingCode(active.current_holdings[0].stock_code);
    }
  }, [active?.strategy_id, active?.current_holdings.map((item) => item.stock_code).join("|"), highlightedHoldingCode]);

  return (
    <div className="backtest-page fade-in">
      <div className="reversion-head">
        <div>
          <span className="eyebrow">DIVIDEND STRATEGY BACKTEST</span>
          <h1>高股息银行策略回测</h1>
          <p>{backtest ? `${backtest.start_date} 至 ${backtest.end_date}` : "等待回测结果"}</p>
        </div>
        <div className="reversion-actions">
          <button className="refresh-button" type="button" onClick={onPrepare} disabled={loading || preparing || optimizing || Boolean(dateRangeError)}>
            {preparing ? "拉取中..." : "拉取缓存并重试"}
          </button>
          <button className="refresh-button primary" type="button" onClick={onRefresh} disabled={loading || preparing || optimizing || Boolean(dateRangeError)}>
            {loading ? "回测中..." : "运行回测"}
          </button>
        </div>
      </div>
      <section className="card backtest-controls">
        <div className="section-heading">
          <div>
            <span className="eyebrow">BACKTEST BUILDER</span>
            <h2>自由组合策略参数</h2>
          </div>
          <div className="backtest-presets">
            <button
              type="button"
              className={isPresetActive(DEFAULT_BACKTEST_QUERY) ? "active" : ""}
              onClick={() => applyPreset(DEFAULT_BACKTEST_QUERY)}
              disabled={loading || preparing || optimizing}
            >
              默认
            </button>
            <button
              type="button"
              className="optimizer-trigger"
              onClick={() => void runOptimization()}
              disabled={loading || preparing || optimizing || Boolean(dateRangeError)}
            >
              {optimizing ? "计算中..." : "智能寻优"}
            </button>
            <button
              type="button"
              className="save-preset-button"
              onClick={saveCurrentPreset}
              disabled={loading || preparing || optimizing}
            >
              保存当前
            </button>
            <div className="saved-preset-controls">
              <select
                value={selectedSavedPresetId}
                onChange={(event) => applySavedPreset(event.target.value)}
                disabled={loading || preparing || optimizing || savedPresets.length === 0}
              >
                <option value="">{savedPresets.length ? "选择已存参数" : "暂无已存参数"}</option>
                {savedPresets.map((preset) => (
                  <option value={preset.id} key={preset.id}>{preset.name}</option>
                ))}
              </select>
              {selectedSavedPresetId && (
                <button
                  type="button"
                  className="delete-preset-button"
                  onClick={deleteSelectedPreset}
                  disabled={loading || preparing || optimizing}
                  aria-label="删除已存参数"
                >
                  删除
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="backtest-control-grid">
          <label>
            <ParamLabel label="开始日期" tooltip="回测起点。建议至少覆盖一轮完整牛熊周期；做 10 年稳定性测试时可从 2016 年附近开始。" />
            <input className={dateRangeError ? "invalid" : ""} type="date" max={query.end_date ?? undefined} value={query.start_date ?? ""} onChange={(event) => updateQuery("start_date", event.target.value || null)} />
          </label>
          <label>
            <ParamLabel label="结束日期" tooltip="回测终点。通常用最新交易日；想检验某段行情，比如 2020-2022 或 2023-至今，可以手动截断。" />
            <input className={dateRangeError ? "invalid" : ""} type="date" min={query.start_date ?? undefined} value={query.end_date ?? ""} onChange={(event) => updateQuery("end_date", event.target.value || null)} />
          </label>
          <label>
            <ParamLabel label="未选日期时年数" tooltip="开始/结束日期为空时使用最近 N 年。建议先看 10 年，再分别看 3 年、5 年，确认策略不是只适合某一段行情。" />
            <NumberStepper ariaLabel="未选日期时年数" min={3} max={15} value={query.years} onChange={(value) => updateQuery("years", value)} />
          </label>
          <label>
            <ParamLabel label="调仓频率" tooltip="调仓越频繁越灵敏，但交易成本和换手也更高。银行股高股息策略通常先用每季；想更稳可试半年。" />
            <select value={query.rebalance_frequency} onChange={(event) => updateQuery("rebalance_frequency", event.target.value as StrategyBacktestQuery["rebalance_frequency"])}>
              <option value="monthly">每月</option>
              <option value="quarterly">每季</option>
              <option value="semiannual">半年</option>
              <option value="annual">每年</option>
            </select>
          </label>
          <label>
            <ParamLabel label="持仓数量" tooltip="组合持有几只银行。数量少更集中、波动可能更大；8-12 只通常较平衡，低回撤可偏 10-15。" />
            <NumberStepper ariaLabel="持仓数量" min={3} max={20} value={query.holding_count} onChange={(value) => updateQuery("holding_count", value)} />
          </label>
          <label>
            <ParamLabel label="最低股息率" tooltip="低于该股息率的银行会被排除。3%-4%适合稳健筛选；设太高容易只剩高息但基本面承压的股票。" />
            <NumberStepper ariaLabel="最低股息率" min={0} max={20} step={0.1} decimals={1} value={query.min_dividend_yield * 100} onChange={(value) => updateQuery("min_dividend_yield", value / 100)} />
          </label>
          <label>
            <ParamLabel label="股息安全分" tooltip="衡量分红可持续性，越高越严格。追求低回撤可设 60-70；想扩大候选池可降到 50-55。" />
            <NumberStepper ariaLabel="股息安全分" min={0} max={100} value={query.min_dividend_safety} onChange={(value) => updateQuery("min_dividend_safety", value)} />
          </label>
          <label>
            <ParamLabel label="稳定增长分" tooltip="衡量利润、ROE 等稳定程度。设高可避开利润转弱银行；如果市场整体承压，过高会导致候选不足。" />
            <NumberStepper ariaLabel="稳定增长分" min={0} max={100} value={query.min_stable_growth} onChange={(value) => updateQuery("min_stable_growth", value)} />
          </label>
          <label>
            <ParamLabel label="最高风险分" tooltip="风险分高于该值会被剔除。低回撤建议 30-40；如果想提高收益弹性，可放宽到 45-50 后观察回撤是否明显变差。" />
            <NumberStepper ariaLabel="最高风险分" min={0} max={100} value={query.max_risk_score} onChange={(value) => updateQuery("max_risk_score", value)} />
          </label>
          <label>
            <ParamLabel label="派息率上限" tooltip="派息率过高说明利润对分红覆盖不足。稳健股息策略常用 70%-85%；超过 100%通常要谨慎。" />
            <NumberStepper ariaLabel="派息率上限" min={0} max={150} value={query.max_payout_ratio * 100} onChange={(value) => updateQuery("max_payout_ratio", value / 100)} />
          </label>
          <label>
            <ParamLabel label="初始资金(万)" tooltip="用于把净值收益换算成真实金额，比如填 100 表示初始资金 100 万。" />
            <NumberStepper ariaLabel="初始资金万元" min={1} max={100000} value={query.initial_capital / 10000} onChange={(value) => updateQuery("initial_capital", value * 10000)} />
          </label>
          <label>
            <ParamLabel label="买入成本率" tooltip="佣金、滑点、过户费等买入侧成本合计。填 0.03 表示 0.03%。" />
            <NumberStepper ariaLabel="买入成本率" min={0} max={2} step={0.001} decimals={3} value={buyCostRate * 100} onChange={(value) => updateBuyCostRate(value / 100)} />
          </label>
          <label>
            <ParamLabel label="卖出印花税" tooltip="卖出侧印花税率。A 股常见口径可按实际费率手动调整。" />
            <NumberStepper ariaLabel="卖出印花税" min={0} max={2} step={0.001} decimals={3} value={query.stamp_duty_rate * 100} onChange={(value) => updateQuery("stamp_duty_rate", value / 100)} />
          </label>
        </div>
        {dateRangeError && <p className="backtest-inline-error">{dateRangeError}</p>}
        <div className="weight-head">
          <span>权重分配</span>
          <b>总和 {weightTotal.toFixed(2)} / 1.00</b>
        </div>
        <div className="weight-grid">
          {BACKTEST_WEIGHT_FIELDS.map(([label, key, tooltip]) => (
            <label key={key}>
              <span>
                <ParamLabel label={label} tooltip={tooltip} />
                <b>{query[key].toFixed(2)}</b>
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={query[key]}
                style={{ "--range-progress": `${query[key] * 100}%` } as CSSProperties}
                onChange={(event) => updateWeight(key, Number(event.target.value))}
              />
            </label>
          ))}
        </div>
        {(optimizing || optimizationOptions.length > 0 || optimizationError) && (
          <div className="optimizer-panel">
            <div className="optimizer-head">
              <span>权重寻优</span>
              <small>{optimizing ? "正在固定筛选条件，逐组回测权重..." : "筛选条件不变，仅给出 3 组权重参考"}</small>
            </div>
            {optimizationError && <p className="optimizer-error">{optimizationError}</p>}
            <div className="optimizer-options">
              {optimizationOptions.map((option) => (
                <button
                  type="button"
                  key={option.goal}
                  onClick={() => onRunWithQuery(option.query)}
                  disabled={loading || preparing || optimizing}
                >
                  <b>{option.label}</b>
                  <span>{option.note}</span>
                  <strong>{pct(option.metrics.annualized_return)}</strong>
                  <small>回撤 {pct(option.metrics.max_drawdown)} · 夏普 {option.metrics.sharpe?.toFixed(2) ?? "—"}</small>
                  <i>
                    股息 {option.query.dividend_weight.toFixed(2)} · 安全 {option.query.safety_weight.toFixed(2)} · 增长 {option.query.growth_weight.toFixed(2)} · 低估 {option.query.valuation_weight.toFixed(2)} · 风险 {option.query.risk_penalty_weight.toFixed(2)}
                  </i>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
      {error && (
        <div className="error backtest-error">
          {error}
          <span>如果是缓存缺失，点击“拉取缓存并重试”会逐家刷新银行数据，完成后自动重新回测；如果提示无法连接后端，请先启动 8000 端口服务。</span>
          <button type="button" onClick={onPrepare} disabled={loading || preparing || optimizing}>
            {preparing ? "正在拉取缓存..." : "拉取缓存并重试"}
          </button>
        </div>
      )}
      {loading && !backtest && (
        <div className="loading reversion-loading">
          <span /><span /><span /> 正在回测当前权重组合
        </div>
      )}
      {backtest && (
        <>
          {active && (
            <>
              <section className="card backtest-detail">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">策略明细</span>
                    <h2>{active.strategy_name}</h2>
                  </div>
                  <span className="pill">{runLabel}</span>
                </div>
                <p className="backtest-description">{active.description}</p>
                <div className="chart-size-control">
                  <span>图高</span>
                  <input
                    type="range"
                    min={160}
                    max={260}
                    step={10}
                    value={chartHeight}
                    onChange={(event) => setChartHeight(Number(event.target.value))}
                    aria-label="调整图表高度"
                  />
                  <b>{chartHeight}px</b>
                </div>
                <div className="backtest-metrics">
                  <span>累计收益 <b>{pct(active.metrics.total_return)}</b></span>
                  <span>年化收益 <b>{pct(active.metrics.annualized_return)}</b></span>
                  <span>最大回撤 <b>{pct(active.metrics.max_drawdown)}</b></span>
                  <span>回撤日期 <b>{active.metrics.max_drawdown_date}</b></span>
                  <span>修复耗时 <b>{recoveryText(active.metrics.recovery_days, active.metrics.recovery_date)}</b></span>
                  <span>夏普 <b>{active.metrics.sharpe?.toFixed(2) ?? "—"}</b></span>
                  <span>胜率 <b>{purePct(active.metrics.win_year_rate)}</b></span>
                  <span>年化股息贡献 <b>{purePct(active.metrics.annual_dividend_return)}</b></span>
                  <span>初始资金 <b>{capitalMoney(activeStartValue)}</b></span>
                  <span>期末资产 <b>{capitalMoney(activeEndValue)}</b></span>
                  <span>利润金额 <b>{capitalMoney(activeProfit)}</b></span>
                  <span>交易成本 <b>{capitalMoney(activeTransactionCost)}</b></span>
                </div>
                <div
                  className="backtest-charts"
                  style={{ "--backtest-chart-height": `${chartHeight}px` } as CSSProperties}
                >
                  <div>
                    <span className="chart-title-row">
                      <span>
                        净值曲线
                        {activeHighlightedHolding && <b> · 高亮 {activeHighlightedHolding.stock_name}</b>}
                      </span>
                      <span className="chart-legend">
                        <i className="strategy-dot" />策略
                        <i className="benchmark-dot" />银行等权基准
                      </span>
                    </span>
                    <BacktestLineChart
                      strategy={active}
                      mode="equity"
                      highlightedStockCode={activeHighlightedHolding?.stock_code}
                      benchmarkPoints={backtest.benchmark_curve}
                    />
                  </div>
                  <div>
                    <span>回撤曲线</span>
                    <BacktestLineChart strategy={active} mode="drawdown" />
                  </div>
                </div>
              </section>
              <section className="backtest-lower">
                <div className="card yearly-card">
                  <div className="section-heading">
                    <h2>年度收益</h2>
                  </div>
                  <div className="yearly-grid">
                    {active.yearly_returns.map((item) => (
                      <span className={item.return_rate >= 0 ? "up" : "down"} key={item.year}>
                        {item.year}<b>{pct(item.return_rate)}</b>
                      </span>
                    ))}
                  </div>
                </div>
                <div className="card holdings-card">
                  <div className="section-heading">
                    <h2>当前组合</h2>
                  </div>
                  <div className="holding-list">
                    {active.current_holdings.map((item) => {
                      const contribution = holdingContribution(
                        active,
                        item.stock_code,
                        active.equity_curve.at(-1)?.date ?? "",
                      );
                      return (
                        <button
                          type="button"
                          className={activeHighlightedHolding?.stock_code === item.stock_code ? "active" : ""}
                          key={item.stock_code}
                          onClick={() => setHighlightedHoldingCode(item.stock_code)}
                        >
                          <b>{item.stock_name}</b>
                          <span>{item.stock_code}</span>
                          <strong>{purePct(item.weight)}</strong>
                          <small>
                            持仓 {contribution.holdingDays}天 · 贡献 {capitalMoney(contribution.profit)} · 股息 {purePct(item.dividend_yield)} · 风险 {item.risk_score.toFixed(1)}
                          </small>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </section>
              <p className="industry-note">{backtest.data_note}</p>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default function App() {
  const savedDashboard = useMemo(loadSavedDashboard, []);
  const [theme, setTheme] = useState<UiTheme>(initialTheme);
  const [page, setPage] = useState<Page>("overview");
  const [code, setCode] = useState(savedDashboard?.code ?? "601398");
  const [bankSearch, setBankSearch] = useState(savedDashboard?.bankSearch ?? formatBankOption("601398"));
  const [date, setDate] = useState(savedDashboard?.date ?? localToday);
  const [result, setResult] = useState<ValuationResult | null>(savedDashboard?.result ?? null);
  const [liveQuote, setLiveQuote] = useState<LiveQuote | null>(null);
  const [liveQuoteError, setLiveQuoteError] = useState("");
  const [monte, setMonte] = useState<MonteCarloResult | null>(savedDashboard?.monte ?? null);
  const [benchmark, setBenchmark] = useState<IndustryBenchmark | null>(savedDashboard?.benchmark ?? null);
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);
  const [reversion, setReversion] = useState<BankMeanReversionOverview | null>(null);
  const [reversionLoading, setReversionLoading] = useState(false);
  const [reversionError, setReversionError] = useState("");
  const [backtest, setBacktest] = useState<StrategyBacktestResponse | null>(null);
  const [backtestQuery, setBacktestQuery] = useState<StrategyBacktestQuery>(DEFAULT_BACKTEST_QUERY);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [backtestPreparing, setBacktestPreparing] = useState(false);
  const [backtestError, setBacktestError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [marketLagNoticeVisible, setMarketLagNoticeVisible] = useState(false);
  const rating = result ? RATING[result.final_rating] : null;
  const marketDateLagged = Boolean(result?.market_date && date && result.market_date < date);
  const displayedPrice = liveQuote?.price ?? result?.current_price ?? null;
  const displayedChangePct = liveQuote?.change_pct ?? result?.daily_change_pct ?? null;
  const displayedChange = liveQuote?.change ?? null;
  const displayedPb =
    result && displayedPrice !== null && result.current_price > 0
      ? result.current_pb * (displayedPrice / result.current_price)
      : result?.current_pb ?? null;
  const visiblePage = useMemo(
    () => (result || page === "reversion" || page === "backtest" || page === "methods" ? page : "overview"),
    [page, result],
  );

  useEffect(() => {
    if (visiblePage === "reversion" && !reversion && !reversionLoading) {
      void loadMeanReversion(false);
    }
  }, [visiblePage]);

  useEffect(() => {
    if (visiblePage === "backtest" && !backtest && !backtestLoading) {
      void loadBacktest();
    }
  }, [visiblePage]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("bank-valuation-ui-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!result) return;
    try {
      const payload: SavedDashboardState = {
        dataVersion: DASHBOARD_DATA_VERSION,
        code,
        bankSearch,
        date,
        result,
        monte,
        benchmark,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(SAVED_DASHBOARD_KEY, JSON.stringify(payload));
    } catch (err) {
      console.warn("[Bank Valuation] failed to save dashboard state", err);
    }
  }, [result, monte, benchmark, code, bankSearch, date]);

  useEffect(() => {
    if (!marketLagNoticeVisible) return;
    const timer = window.setTimeout(() => setMarketLagNoticeVisible(false), 30_000);
    return () => window.clearTimeout(timer);
  }, [marketLagNoticeVisible, result?.market_date, date]);

  useEffect(() => {
    if (!result?.stock_code) {
      setLiveQuote(null);
      setLiveQuoteError("");
      return;
    }

    let active = true;
    const load = async () => {
      try {
        const quote = await getLiveQuote(result.stock_code);
        if (!active) return;
        setLiveQuote(quote);
        setLiveQuoteError("");
      } catch (err) {
        if (!active) return;
        setLiveQuoteError(err instanceof Error ? err.message : "实时行情暂不可用");
      }
    };

    setLiveQuote(null);
    setLiveQuoteError("");
    void load();
    const timer = window.setInterval(load, 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [result?.stock_code]);

  async function loadMeanReversion(forceRefresh = false) {
    setReversionLoading(true);
    setReversionError("");
    try {
      const overview = await getMeanReversionOverview(date, forceRefresh, true);
      setReversion(overview);
    } catch (err) {
      setReversionError(err instanceof Error ? err.message : "暂时无法连接全银行排序服务");
    } finally {
      setReversionLoading(false);
    }
  }

  const shouldPrepareBacktestCache = (message: string) =>
    /缓存|cache|快照|本地|历史不足|生成缓存/i.test(message);

  async function prepareBacktestData(params = backtestQuery) {
    const validationError = validateBacktestDateRange(params);
    if (validationError) {
      setBacktestError(validationError);
      return;
    }
    setBacktestPreparing(true);
    setBacktestError("");
    try {
      const overview = await getMeanReversionOverview(date, true, true);
      setReversion(overview);
      const response = await getStrategyBacktest(params);
      setBacktest(response);
    } catch (err) {
      setBacktestError(err instanceof Error ? err.message : "自动拉取缓存失败，请确认后端和数据源可用");
    } finally {
      setBacktestPreparing(false);
    }
  }

  async function loadBacktest(params = backtestQuery, allowAutoPrepare = true) {
    const validationError = validateBacktestDateRange(params);
    if (validationError) {
      setBacktestError(validationError);
      return;
    }
    setBacktestLoading(true);
    setBacktestError("");
    try {
      const response = await getStrategyBacktest(params);
      setBacktest(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : "暂时无法完成策略回测";
      if (allowAutoPrepare && shouldPrepareBacktestCache(message)) {
        setBacktestLoading(false);
        await prepareBacktestData(params);
        return;
      }
      setBacktestError(message);
    } finally {
      setBacktestLoading(false);
    }
  }

  async function runAnalysis(forceRefresh = false, targetCode = code) {
    setLoading(true);
    setError("");
    setLiveQuote(null);
    setLiveQuoteError("");
    setPage("overview");
    try {
      // Baostock keeps process-global socket state. Request sequentially so a
      // valuation run is not interrupted by Monte Carlo opening another session.
      const valuation = await getValuation(targetCode, date, forceRefresh);
      setResult(valuation);
      setMarketLagNoticeVisible(Boolean(valuation.market_date && date && valuation.market_date < date));
      const simulation = await getMonteCarlo(targetCode, date, forceRefresh);
      setMonte(simulation);
      setBenchmark(null);
      setBenchmarkLoading(true);
      void getIndustryBenchmark(targetCode, date, forceRefresh)
        .then(setBenchmark)
        .catch((industryError) =>
          console.warn(
            "[Bank Valuation] industry benchmark unavailable",
            industryError,
          ),
        )
        .finally(() => setBenchmarkLoading(false));
    } catch (err) {
      setError(err instanceof Error ? err.message : "暂时无法连接数据服务");
      setMarketLagNoticeVisible(false);
      setBenchmarkLoading(false);
    } finally {
      setLoading(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const resolvedCode = resolveBankCode(bankSearch, code);
    setCode(resolvedCode);
    setBankSearch(formatBankOption(resolvedCode));
    await runAnalysis(false, resolvedCode);
  }

  function selectReversionStock(stockCode: string) {
    const plainCode = stockCode.includes(".") ? stockCode.split(".")[1] : stockCode;
    setCode(plainCode);
    setBankSearch(formatBankOption(plainCode));
    void runAnalysis(false, plainCode);
  }

  return (
    <main>
      <Particles />
      <aside className="sidebar">
        <div className="brand">
          <i>银</i>
          <div>
            <b>银栖</b>
            <span>Banking, gently.</span>
          </div>
        </div>
        <nav>
          {(
            [
              ["overview", "概览", false],
              ["reversion", "银行排序", false],
              ["backtest", "策略回测", false],
              ["details", "数据全景", true],
              ["scenarios", "情景推演", true],
              ["methods", "模型说明", false],
            ] as [Page, string, boolean][]
          ).map(([key, label, requiresResult]) => {
            const disabled = requiresResult && !result;
            return (
              <button
                className={`${visiblePage === key ? "active" : ""} ${disabled ? "disabled" : ""}`}
                onClick={() => !disabled && setPage(key)}
                disabled={disabled}
                title={disabled ? "先选择银行并开始分析" : label}
                key={key}
              >
                {key === "overview"
                  ? "◌"
                  : key === "reversion"
                    ? "▦"
                    : key === "backtest"
                      ? "↝"
                  : key === "details"
                    ? "▤"
                    : key === "scenarios"
                      ? "◇"
                      : "⌁"}
                <span>{label}</span>
              </button>
            );
          })}
        </nav>
        <div className="sidebar-foot">
          <div className="theme-panel">
            <span>外观</span>
            <div className="theme-switch">
              {(Object.entries(THEME_META) as [UiTheme, { label: string; title: string }][]).map(([key, meta]) => (
                <button
                  type="button"
                  className={theme === key ? "active" : ""}
                  onClick={() => setTheme(key)}
                  key={key}
                >
                  {meta.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>
      <div className="content">
        <header>
          <div>
            <span className="eyebrow">A-SHARE BANK VALUATION</span>
            <h1>{THEME_META[theme].title}</h1>
          </div>
          <form onSubmit={submit}>
            <label>
              股票代码
              <BankSearchBox
                value={bankSearch}
                selectedCode={code}
                onValueChange={setBankSearch}
                onSelect={setCode}
              />
            </label>
            <label>
              估值日期
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <button className="query-button" disabled={loading}>
              {loading ? "正在取数…" : "开始分析 →"}
            </button>
          </form>
        </header>
        {error && (
          <div className="error">
            {error}
            <span>请确认后端已在 8000 端口启动，且 Baostock 网络可访问。</span>
          </div>
        )}
        {result && marketDateLagged && marketLagNoticeVisible && (
          <div className="market-lag transient">
            <div>
              <b>市场数据还没有更新到你选择的日期</b>
              <span>
                你选择的是 {date}，当前接口实际拿到的最近可用收盘日是 {result.market_date}。
                这通常是当天尚未收盘、Baostock 还未发布日线，或数据源延迟导致；估值已先使用最近交易日数据。
              </span>
            </div>
            <button type="button" onClick={() => void runAnalysis(true)} disabled={loading}>
              重新查询今日数据
            </button>
          </div>
        )}
        {!result && !loading && !error && !["reversion", "backtest"].includes(visiblePage) && <EmptyState />}
        {loading && (
          <div className="loading">
            <span />
            <span />
            <span /> 正在整理市场、财报与分红数据
          </div>
        )}
        {visiblePage === "reversion" && (
          <MeanReversionPage
            overview={reversion}
            loading={reversionLoading}
            error={reversionError}
            onRefresh={(forceRefresh = false) => void loadMeanReversion(forceRefresh)}
            onSelectStock={selectReversionStock}
          />
        )}
        {visiblePage === "backtest" && (
          <BacktestPage
            backtest={backtest}
            loading={backtestLoading}
            error={backtestError}
            preparing={backtestPreparing}
            query={backtestQuery}
            onQueryChange={setBacktestQuery}
            onRunWithQuery={(nextQuery) => {
              setBacktestQuery(nextQuery);
              void loadBacktest(nextQuery);
            }}
            onRefresh={() => void loadBacktest()}
            onPrepare={() => void prepareBacktestData()}
          />
        )}
        {result && visiblePage === "overview" && (
          <div className="overview fade-in">
            <section className="hero-card">
              <div>
                <span className="eyebrow">
                  {result.stock_code} · 估值收盘 {result.market_date ?? "—"}
                  {liveQuote && ` · 实时 ${liveQuote.quote_date} ${liveQuote.quote_time}`}
                </span>
                <div className="bank-heading">
                  <BankLogo
                    stockCode={result.stock_code}
                    stockName={result.stock_name}
                    profile={result.bank_profile}
                  />
                  <div>
                    <h2>{result.stock_name}</h2>
                    <span className="bank-profile">{result.bank_profile.bank_type} · {result.bank_profile.brief}</span>
                  </div>
                </div>
                <p>
                  财务报告期：{result.financial_report_date ?? "—"}
                  　·　使用最近已披露数据
                </p>
              </div>
              <div className="hero-price">
                <span>{liveQuote ? "实时价格" : "估值收盘价"}</span>
                <b>{money(displayedPrice)}</b>
                <em className={`day-change ${quoteTone(displayedChangePct)}`}>
                  {quoteArrow(displayedChangePct)}{" "}
                  {dayPct(displayedChangePct)}
                  {displayedChange !== null && ` / ${signedMoney(displayedChange)}`}
                </em>
                <small>
                  PB {displayedPb === null ? "—" : displayedPb.toFixed(2)}
                  {liveQuote ? ` · 估值收盘 ${money(result.current_price)}` : ""}
                </small>
                <div className="quote-strip">
                  <span>昨收 <b>{money(liveQuote?.previous_close ?? result.current_price)}</b></span>
                  <span>今开 <b>{money(liveQuote?.open ?? null)}</b></span>
                  <span>最高 <b>{money(liveQuote?.high ?? null)}</b></span>
                  <span>最低 <b>{money(liveQuote?.low ?? null)}</b></span>
                  <span>成交额 <b>{marketAmount(liveQuote?.amount ?? null)}</b></span>
                  <span>成交量 <b>{lotVolume(liveQuote?.volume ?? null)}</b></span>
                </div>
                <i className={`quote-status ${liveQuoteError ? "warn" : liveQuote ? "live" : ""}`}>
                  {liveQuote
                    ? `实时轮询中 · ${liveQuote.source}`
                    : liveQuoteError
                      ? `${liveQuoteError}，暂用估值收盘`
                      : "正在连接实时行情..."}
                </i>
              </div>
              <div className={`rating ${rating!.tone}`}>
                <span>分析分类</span>
                <b>{rating!.title}</b>
                <p>{rating!.detail}</p>
              </div>
            </section>
            <section className="metrics">
              <article>
                <span>PB 历史分位 · 3年</span>
                <b>{purePct(result.pb_percentile_3y)}</b>
                <small>越低代表历史估值位置越低</small>
              </article>
              <article>
                <span>PB-ROE 合理价格</span>
                <b>{money(result.pb_roe_fair_price)}</b>
                <small>权益成本 {purePct(result.cost_of_equity)}</small>
              </article>
              <article>
                <span>股息率底部</span>
                <b>{money(result.dividend_floor_price)}</b>
                <small>
                  压力情景 {money(result.dividend_stress_floor_price)}
                </small>
              </article>
              <article>
                <span>剩余收益价格</span>
                <b>{money(result.residual_income_price)}</b>
                <small>基于 5 年预测与终值</small>
              </article>
            </section>
            <DefensiveDecisionPanel result={result} />
            <PriceBand result={result} />
            <section className="lower-grid">
              {monte && <MonteChart data={monte} />}
              <section className="card risks">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">需留意的事</span>
                    <h2>风险提示</h2>
                  </div>
                </div>
                {result.risk_flags.length ? (
                  <ul>
                    {result.risk_flags.map((flag) => (
                      <li key={flag}>{flag}</li>
                    ))}
                  </ul>
                ) : (
                  <p>当前数据没有触发预设风险标签；这不等同于不存在风险。</p>
                )}
                <div className="space-metrics">
                  <span>
                    基准上行 <b>{pct(result.upside_potential)}</b>
                  </span>
                  <span>
                    危机下行 <b>{pct(result.downside_risk)}</b>
                  </span>
                </div>
              </section>
            </section>
          </div>
        )}
        {result && visiblePage === "scenarios" && (
          <div className="fade-in">
            <ScenarioPage result={result} />
            <ScenarioConditions result={result} />
          </div>
        )}
        {result && visiblePage === "details" && (
          <div className="details-with-industry fade-in">
            <RiskInsights result={result} monte={monte} />
            <IndustryBenchmarkCard
              benchmark={benchmark}
              loading={benchmarkLoading}
            />
            <DetailsPage result={result} />
          </div>
        )}
        {visiblePage === "methods" && <MethodPage />}
      </div>
    </main>
  );
}
