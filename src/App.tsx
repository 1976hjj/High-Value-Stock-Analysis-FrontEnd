import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  getIndustryBenchmark,
  getMeanReversionOverview,
  getMonteCarlo,
  getValuation,
} from "./api";
import type {
  BankMeanReversionOverview,
  BankMeanReversionRow,
  IndustryBenchmark,
  MonteCarloResult,
  ScenarioName,
  ValuationResult,
} from "./types";

type Page = "overview" | "reversion" | "details" | "scenarios" | "methods";
type UiTheme = "calm" | "fintech" | "terminal" | "research";
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

const formatBankOption = (bankCode: string) => {
  const normalized = bankCode.includes(".") ? bankCode.split(".")[1] : bankCode;
  const option = BANK_OPTIONS.find(([code]) => code === normalized);
  return option ? `${option[0]} · ${option[1]}` : normalized;
};

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
  const partial = BANK_OPTIONS.find(
    ([code, name]) => code.includes(text) || name.includes(text),
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
const pct = (value: number) =>
  `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
const purePct = (value: number) => `${(value * 100).toFixed(1)}%`;
const maybePct = (value: number | null) =>
  value === null ? "—" : purePct(value);
const dayPct = (value: number | null) =>
  value === null ? "—" : `${value >= 0 ? "+" : ""}${(value * 100).toFixed(2)}%`;
const THEME_META: Record<UiTheme, { label: string; title: string }> = {
  calm: { label: "经典", title: "给数字一处安静的栖身地。" },
  fintech: { label: "科技粒子", title: "银行估值与回归信号台" },
  terminal: { label: "量化终端", title: "BANK SIGNAL TERMINAL" },
  research: { label: "投研白板", title: "银行估值工作台" },
};

const initialTheme = (): UiTheme => {
  const saved = localStorage.getItem("bank-valuation-ui-theme");
  return saved === "fintech" || saved === "terminal" || saved === "research"
    ? saved
    : "calm";
};
const localToday = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
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
  const values = [
    result.scenarios.crisis.price_range[0],
    result.scenarios.crisis.price_range[1],
    result.current_price,
    result.scenarios.base.price_range[1],
    result.scenarios.bull.price_range[1],
  ];
  const min = Math.min(...values) * 0.88;
  const max = Math.max(...values) * 1.08;
  const x = (value: number) => `${((value - min) / (max - min)) * 100}%`;
  return (
    <section className="card price-band">
      <div className="section-heading">
        <div>
          <span className="eyebrow">价格坐标</span>
          <h2>估值区间在何处</h2>
        </div>
        <span className="quiet">单位：元 / 股</span>
      </div>
      <div className="axis">
        <span>{money(min)}</span>
        <span>{money(max)}</span>
      </div>
      {(["bull", "base", "bear", "crisis"] as ScenarioName[]).map((name) => {
        const [low, high] = result.scenarios[name].price_range;
        return (
          <div className={`band-row ${name}`} key={name}>
            <div className="band-label">{SCENARIO_META[name].label}</div>
            <div className="band-track">
              <div
                className="band-fill"
                style={{ left: x(low), width: `calc(${x(high)} - ${x(low)})` }}
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
      <div className="current-pin" style={{ left: x(result.current_price) }}>
        <span>当前</span>
        <b>{money(result.current_price)}</b>
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
          <small>距当前 {pct(decision.buy_wait_gap)}</small>
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
        <h1>把复杂模型，放回一句人话。</h1>
        <p>每一项指标都应与数据时点一起看，而不是独自宣告结论。</p>
      </div>
      <div className="method-grid">
        <article>
          <b>01</b>
          <h2>PB-ROE</h2>
          <p>
            将净资产收益能力与权益成本放在同一把尺上，得到合理 PB
            倍数及对应价格。
          </p>
        </article>
        <article>
          <b>02</b>
          <h2>股息底部</h2>
          <p>以目标股息率反推价格，同时展示分红削减 30% 后的压力版本。</p>
        </article>
        <article>
          <b>03</b>
          <h2>剩余收益</h2>
          <p>净资产之上，只有持续超过权益成本的部分才增加内在价值。</p>
        </article>
        <article>
          <b>04</b>
          <h2>风险与情景</h2>
          <p>
            低 PB
            不是自动便宜。盈利、资产质量、资本缓冲和分红稳定性共同影响结果。
          </p>
        </article>
      </div>
      <div className="data-note">
        <span>数据边界</span>
        <p>
          日价格使用 Baostock
          不复权收盘价（除权除息变化在当天自然反映）；财务数据为估值日前可取得的最新披露。后端暂以透明默认值补齐
          Baostock 未稳定提供的银行专属指标。
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
  const priced = points.filter(
    (point): point is { date: string; pb: number; close: number } =>
      point.close !== null,
  );
  if (points.length < 2 || priced.length < 2)
    return <LegacyPbHistoryChart points={points} currentPb={currentPb} />;
  const pbValues = points.map((point) => point.pb);
  const prices = priced.map((point) => point.close);
  const pbMin = Math.min(...pbValues) * 0.92;
  const pbMax = Math.max(...pbValues) * 1.08;
  const priceMin = Math.min(...prices) * 0.92;
  const priceMax = Math.max(...prices) * 1.08;
  const x = (index: number) => 36 + (index / (points.length - 1)) * 388;
  const pbY = (value: number) =>
    145 - ((value - pbMin) / (pbMax - pbMin || 1)) * 112;
  const priceY = (value: number) =>
    145 - ((value - priceMin) / (priceMax - priceMin || 1)) * 112;
  const pbLine = points
    .map((point, index) => `${x(index)},${pbY(point.pb)}`)
    .join(" ");
  const priceLine = points
    .map((point, index) => `${x(index)},${priceY(point.close ?? prices[0])}`)
    .join(" ");
  return (
    <div className="pb-chart dual-chart">
      <div className="chart-labels">
        <span>{points[0].date}</span>
        <b>
          <i className="pb-key" />
          PB {currentPb.toFixed(2)}　<i className="price-key" />
          收盘价 {money(priced[priced.length - 1].close)}
        </b>
        <span>{points[points.length - 1].date}</span>
      </div>
      <svg
        viewBox="0 0 460 170"
        role="img"
        aria-label="历史 PB 和不复权收盘价走势"
      >
        <line x1="30" y1="145" x2="430" y2="145" className="grid" />
        <line x1="30" y1="89" x2="430" y2="89" className="grid" />
        <line x1="30" y1="33" x2="430" y2="33" className="grid" />
        <polyline points={priceLine} className="price-history-line" />
        <polyline points={pbLine} className="pb-line" />
        <circle
          cx={x(points.length - 1)}
          cy={pbY(points[points.length - 1].pb)}
          r="4"
          className="pb-point"
        />
        <circle
          cx={x(points.length - 1)}
          cy={priceY(priced[priced.length - 1].close)}
          r="3.5"
          className="price-history-point"
        />
        <text x="2" y="36">
          PB {pbMax.toFixed(2)}
        </text>
        <text x="2" y="148">
          PB {pbMin.toFixed(2)}
        </text>
        <text x="400" y="36">
          ¥{priceMax.toFixed(2)}
        </text>
        <text x="400" y="148">
          ¥{priceMin.toFixed(2)}
        </text>
      </svg>
      <p className="dual-note">
        绿线为 PB（左轴），紫线为除权除息后自然反映的实际收盘价（右轴）。
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
            <span className="eyebrow">近十年采样</span>
            <h2>历史 PB 轨迹</h2>
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
                  <div className={`bank-logo ${row.bank_profile.logo_tone}`}>
                    {row.bank_profile.logo_text}
                  </div>
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
      <span className="eyebrow">从一只银行开始</span>
      <h1>输入代码，让数据自己长出轮廓。</h1>
      <p>
        只需填写股票代码和一个可选日期。我们会寻找当天或此前最近交易日，并自动整理估值所需的数据。
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
  const keyword = value.trim().toLowerCase().replace(/\s/g, "");
  const matches = useMemo(() => {
    const filtered = keyword
      ? BANK_OPTIONS.filter(([code, name]) =>
          `${code}${name}`.toLowerCase().includes(keyword),
        )
      : BANK_OPTIONS;
    return filtered.slice(0, 10);
  }, [keyword]);
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

export default function App() {
  const [theme, setTheme] = useState<UiTheme>(initialTheme);
  const [page, setPage] = useState<Page>("overview");
  const [code, setCode] = useState("601398");
  const [bankSearch, setBankSearch] = useState(formatBankOption("601398"));
  const [date, setDate] = useState(localToday);
  const [result, setResult] = useState<ValuationResult | null>(null);
  const [monte, setMonte] = useState<MonteCarloResult | null>(null);
  const [benchmark, setBenchmark] = useState<IndustryBenchmark | null>(null);
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);
  const [reversion, setReversion] = useState<BankMeanReversionOverview | null>(null);
  const [reversionLoading, setReversionLoading] = useState(false);
  const [reversionError, setReversionError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const rating = result ? RATING[result.final_rating] : null;
  const marketDateLagged = Boolean(result?.market_date && date && result.market_date < date);
  const visiblePage = useMemo(
    () => (result || page === "reversion" || page === "methods" ? page : "overview"),
    [page, result],
  );

  useEffect(() => {
    if (visiblePage === "reversion" && !reversion && !reversionLoading) {
      void loadMeanReversion(false);
    }
  }, [visiblePage]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("bank-valuation-ui-theme", theme);
  }, [theme]);

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

  async function runAnalysis(forceRefresh = false, targetCode = code) {
    setLoading(true);
    setError("");
    setPage("overview");
    try {
      // Baostock keeps process-global socket state. Request sequentially so a
      // valuation run is not interrupted by Monte Carlo opening another session.
      const valuation = await getValuation(targetCode, date, forceRefresh);
      setResult(valuation);
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
      setResult(null);
      setMonte(null);
      setBenchmark(null);
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
        {result && marketDateLagged && (
          <div className="market-lag">
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
        {!result && !loading && !error && visiblePage !== "reversion" && <EmptyState />}
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
        {result && visiblePage === "overview" && (
          <div className="overview fade-in">
            <section className="hero-card">
              <div>
                <span className="eyebrow">
                  {result.stock_code} · 市场数据 {result.market_date ?? "—"}
                </span>
                <div className="bank-heading">
                  <div className={`bank-logo ${result.bank_profile.logo_tone}`} aria-label={`${result.stock_name} 缩写标识`}>
                    {result.bank_profile.logo_text}
                  </div>
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
                <span>当前收盘价</span>
                <b>{money(result.current_price)}</b>
                <em className={`day-change ${
                  result.daily_change_pct === null
                    ? "flat"
                    : result.daily_change_pct > 0
                      ? "up"
                      : result.daily_change_pct < 0
                        ? "down"
                        : "flat"
                }`}>
                  {result.daily_change_pct === null
                    ? "—"
                    : result.daily_change_pct > 0
                      ? "▲"
                      : result.daily_change_pct < 0
                        ? "▼"
                        : "◆"}{" "}
                  {dayPct(result.daily_change_pct)}
                </em>
                <small>PB {result.current_pb.toFixed(2)}</small>
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
