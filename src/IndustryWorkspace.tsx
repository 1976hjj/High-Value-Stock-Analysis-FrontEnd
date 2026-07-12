import { useEffect, useState } from "react";

import { getIndustryRanking, type LiveQuote } from "./api";
import { ConsumerWorkspace } from "./ConsumerWorkspace";
import { HydroWorkspace } from "./HydroWorkspace";
import { ResourceWorkspace } from "./ResourceWorkspace";
import { OilGasWorkspace } from "./OilGasWorkspace";
import { TollRoadWorkspace } from "./TollRoadWorkspace";
import { NuclearWorkspace } from "./NuclearWorkspace";
import { TelecomWorkspace } from "./TelecomWorkspace";
import {
  ALL_INDUSTRY_IDS,
  INDUSTRIES,
  INDUSTRY_MAP,
  findIndustryStock,
  type IndustryConfig,
  type IndustryId,
} from "./industryConfig";
import type { IndustryAnalysisResult, IndustryRankingResponse, StrategyBacktestQuery } from "./types";

type IndustryPage = "overview" | "reversion" | "details" | "scenarios" | "methods";

const scoreTone = (score: number) => score >= 90 ? "excellent" : score >= 82 ? "good" : score >= 72 ? "watch" : "cyclical";
const scoreLabel = (score: number) => score >= 90 ? "核心防御" : score >= 82 ? "稳健候选" : score >= 72 ? "均衡观察" : "周期卫星";

const quoteMoney = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? `¥${value.toFixed(2)}` : "—";

const quotePercent = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value)
    ? `${value > 0 ? "+" : ""}${(value * 100).toFixed(2)}%`
    : "—";

const weightedScore = (stock: IndustryConfig["stocks"][number]) =>
  Math.round(stock.defenseScore * .42 + stock.incomeScore * .25 + stock.qualityScore * .33);

export function IndustryTabs({
  value,
  onChange,
}: {
  value: IndustryId;
  onChange: (industryId: IndustryId) => void;
}) {
  return (
    <div className="industry-tabs-viewport" aria-label="行业工作台">
      <div className="industry-tabs" role="tablist">
        {INDUSTRIES.map((industry) => (
          <button
            type="button"
            role="tab"
            aria-selected={value === industry.id}
            className={`industry-tab ${value === industry.id ? "active" : ""}`}
            onClick={() => onChange(industry.id)}
            key={industry.id}
          >
            <span>{industry.icon}</span>
            {industry.shortLabel}
          </button>
        ))}
      </div>
    </div>
  );
}

function IndustryHero({
  industry,
  stockCode,
  quote,
  quoteError,
  valuationDate,
  analysis,
}: {
  industry: IndustryConfig;
  stockCode: string;
  quote: LiveQuote | null;
  quoteError: string;
  valuationDate: string;
  analysis: IndustryAnalysisResult | null;
}) {
  const stock = findIndustryStock(industry, stockCode);
  const score = Math.round(analysis?.scores.overall ?? weightedScore(stock));
  const displayedPrice = quote?.price ?? analysis?.current_price;
  const displayedChange = quote?.change_pct ?? analysis?.daily_change_pct;
  return (
    <section className="industry-workspace-hero">
      <div className="industry-company-main">
        <span className="eyebrow">{industry.english} · {stock.code}</span>
        <div className="industry-company-title">
          <i aria-hidden="true">{industry.icon}</i>
          <div>
            <h1>{stock.name}</h1>
            <p>{stock.role} · {stock.moat}</p>
          </div>
        </div>
        <div className="industry-tags">
          <span>业务抗危机 {industry.resilience}</span>
          <span>分红 {industry.dividend}</span>
          <span>稳定性 {industry.stability}</span>
        </div>
      </div>
      <div className="industry-live-quote">
        <span>{quote ? "实时行情" : "行情状态"}</span>
        <b>{quoteMoney(displayedPrice)}</b>
        <strong className={(displayedChange ?? 0) >= 0 ? "up" : "down"}>{quotePercent(displayedChange)}</strong>
        <small>
          {quote
            ? `${quote.quote_date} ${quote.quote_time} · ${quote.source}`
            : analysis
              ? `估值收盘 ${analysis.market_date} · ${analysis.valuation_metric.toUpperCase()} 分位 ${(analysis.valuation_percentile * 100).toFixed(1)}%`
              : quoteError || `估值观察日 ${valuationDate}`}
        </small>
      </div>
      <div className={`industry-score ${scoreTone(score)}`}>
        <span>行业内框架分</span>
        <b>{score}</b>
        <strong>{scoreLabel(score)}</strong>
        <small>{analysis ? "后端点时行情 + 行业研究先验" : "防御 42% · 质量 33% · 股息 25%"}</small>
      </div>
    </section>
  );
}

function IndustryOverview({ industry, stockCode, analysis }: { industry: IndustryConfig; stockCode: string; analysis: IndustryAnalysisResult | null }) {
  const stock = findIndustryStock(industry, stockCode);
  const metricScore = (index: number) => {
    const backendScore = analysis?.metrics[index]?.score;
    if (typeof backendScore === "number") return backendScore;
    const base = [stock.defenseScore, stock.incomeScore, stock.qualityScore, weightedScore(stock)][index] ?? 80;
    return Math.max(55, Math.min(98, base - index * 2));
  };
  return (
    <>
      <section className="industry-score-grid" aria-label={`${industry.label}核心指标`}>
        {industry.metrics.map((metric, index) => (
          <article key={metric.label}>
            <div className="metric-card-top">
              <span>{metric.shortLabel}</span>
              <em>{metric.weight}%</em>
            </div>
            <b>{metric.target}</b>
            <div className="metric-progress"><i style={{ width: `${metricScore(index)}%` }} /></div>
            <p>{analysis?.metrics[index] ? `${analysis.metrics[index].label}：${analysis.metrics[index].value} · ${analysis.metrics[index].source}` : metric.rationale}</p>
          </article>
        ))}
      </section>
      <section className="industry-overview-grid">
        <article className="industry-thesis-panel">
          <div className="section-heading">
            <div><span className="eyebrow">PORTFOLIO ROLE</span><h2>为什么放进防御组合</h2></div>
            <span className="resilience-badge">韧性 {industry.defensiveScore}/100</span>
          </div>
          <p>{industry.summary}</p>
          <dl>
            <div><dt>组合角色</dt><dd>{industry.portfolioRole}</dd></div>
            <div><dt>估值锚</dt><dd>{industry.valuationAnchor}</dd></div>
            <div><dt>对冲通道</dt><dd>{industry.hedgeChannel}</dd></div>
          </dl>
        </article>
        <article className="industry-watch-panel">
          <div className="section-heading"><div><span className="eyebrow">RISK GATE</span><h2>先看风险，再看股息</h2></div></div>
          <div className="risk-gate-main"><span>最大风险</span><b>{industry.primaryRisk}</b></div>
          <ul>
            {analysis?.risk_flags.slice(0, 2).map((flag) => <li key={flag}><span>后端风险信号</span><b>{flag}</b></li>)}
            <li><span>当前公司观察点</span><b>{stock.watch}</b></li>
            <li><span>建议行业风险预算</span><b>{industry.riskBudget}%</b></li>
            <li><span>行业止损层级</span><b>单股 → 行业 → 组合</b></li>
          </ul>
        </article>
      </section>
      <section className="industry-scenario-preview">
        <div className="section-heading">
          <div><span className="eyebrow">STRESS TRANSMISSION</span><h2>最关键的一条危机传导链</h2></div>
        </div>
        <div className="stress-chain">
          <span>{industry.scenarios[3].shock}</span><i>→</i><span>{industry.scenarios[3].transmission.split("→")[0]}</span><i>→</i><span>{industry.scenarios[3].action}</span>
        </div>
      </section>
    </>
  );
}

function IndustryRanking({
  industry,
  stockCode,
  onSelectStock,
}: {
  industry: IndustryConfig;
  stockCode: string;
  onSelectStock: (stockCode: string) => void;
}) {
  const sorted = [...industry.stocks].sort((a, b) => weightedScore(b) - weightedScore(a));
  return (
    <section className="industry-ranking-page">
      <div className="industry-page-head">
        <div>
          <span className="eyebrow">INTRA-INDUSTRY NORMALIZATION</span>
          <h1>{industry.nav.ranking}</h1>
          <p>先按 {industry.metrics.map((metric) => metric.shortLabel).join("、")} 做行业内比较，再映射为统一防御分；不跨行业硬比原始指标。</p>
        </div>
        <span className="framework-badge">核心龙头池 · {sorted.length} 家</span>
      </div>
      <div className="industry-ranking-table" role="table" aria-label={`${industry.label}龙头框架排序`}>
        <div className="industry-ranking-row header" role="row">
          <span>排名 / 公司</span><span>组合角色</span><span>防御</span><span>股息</span><span>质量</span><span>综合</span><span>操作</span>
        </div>
        {sorted.map((stock, index) => {
          const total = weightedScore(stock);
          return (
            <div className={`industry-ranking-row ${stock.code === stockCode ? "active" : ""}`} role="row" key={stock.code}>
              <span className="rank-company"><i>{index + 1}</i><b>{stock.name}<small>{stock.code}</small></b></span>
              <span><b>{stock.role}</b><small>{stock.moat}</small></span>
              <span><b>{stock.defenseScore}</b><small>抗危机</small></span>
              <span><b>{stock.incomeScore}</b><small>股东回报</small></span>
              <span><b>{stock.qualityScore}</b><small>经营质量</small></span>
              <span><strong className={scoreTone(total)}>{total}</strong><small>{scoreLabel(total)}</small></span>
              <span><button type="button" onClick={() => onSelectStock(stock.code)}>{stock.code === stockCode ? "当前" : "查看"}</button></span>
            </div>
          );
        })}
      </div>
      <p className="framework-note">框架分用于确定优先研究顺序，不是当前价格下的买入建议；精确分数应由对应报告期的财务、运营与估值数据计算。</p>
    </section>
  );
}

function IndustryDetails({ industry, analysis }: { industry: IndustryConfig; analysis: IndustryAnalysisResult | null }) {
  return (
    <section className="industry-details-page">
      <div className="industry-page-head">
        <div><span className="eyebrow">INDUSTRY DATA PANORAMA</span><h1>{industry.nav.details}</h1><p>{industry.label}使用独立的数据字典与阈值，缺失关键指标时不输出“低估”结论。</p></div>
        <span className="framework-badge">{industry.valuationAnchor}</span>
      </div>
      <div className="industry-detail-grid">
        {industry.metrics.map((metric, index) => (
          <article key={metric.label}>
            <span className="detail-index">0{index + 1}</span>
            <h2>{metric.label}</h2>
            <strong>{metric.target}</strong>
            <p>{metric.rationale}</p>
            <div><span>模型权重</span><b>{metric.weight}%</b></div>
          </article>
        ))}
      </div>
      <section className="model-pipeline">
        <div><span>01</span><b>原始行业指标</b><small>按实际披露日对齐</small></div><i>→</i>
        <div><span>02</span><b>行业内标准化</b><small>去极值与分位评分</small></div><i>→</i>
        <div><span>03</span><b>质量与风险闸门</b><small>先排除收益陷阱</small></div><i>→</i>
        <div><span>04</span><b>跨行业统一六维</b><small>用于组合配置</small></div>
      </section>
      <div className="industry-data-disclaimer"><b>数据边界</b><p>{analysis?.data_note ?? "当前页面提供行业专属模型结构、龙头池与判定阈值；点击开始分析后，通用行业接口会按估值日返回点时行情、估值、波动和回撤，不会用银行字段冒充非银行结论。"}</p></div>
    </section>
  );
}

function IndustryScenarios({ industry }: { industry: IndustryConfig }) {
  return (
    <section className="industry-scenarios-page">
      <div className="industry-page-head">
        <div><span className="eyebrow">INDUSTRY STRESS TEST</span><h1>{industry.nav.scenarios}</h1><p>每个情景都给出冲击、传导、验证信号和组合动作，避免只给一个看似精确的目标价。</p></div>
        <span className="framework-badge">主风险 · {industry.primaryRisk}</span>
      </div>
      <div className="industry-scenarios-grid">
        {industry.scenarios.map((scenario, index) => (
          <article className={scenario.tone} key={scenario.name}>
            <div><span>情景 0{index + 1}</span><em>{scenario.name}</em></div>
            <h2>{scenario.shock}</h2>
            <p>{scenario.transmission}</p>
            <ul>{scenario.signals.map((signal) => <li key={signal}>{signal}</li>)}</ul>
            <footer><span>组合动作</span><b>{scenario.action}</b></footer>
          </article>
        ))}
      </div>
    </section>
  );
}

function IndustryMethods({ industry }: { industry: IndustryConfig }) {
  return (
    <section className="industry-methods-page">
      <div className="industry-page-head">
        <div><span className="eyebrow">MODEL & DISCIPLINE</span><h1>{industry.nav.methods}</h1><p>行业专属原始指标只在行业内部排序；跨行业配置只使用含义一致的统一维度。</p></div>
        <span className="framework-badge">估值锚 · {industry.valuationAnchor}</span>
      </div>
      <div className="industry-method-grid">
        <article><span>01</span><h2>行业内选股</h2><p>围绕 {industry.metrics.map((metric) => metric.shortLabel).join("、")} 标准化，先过质量和尾部风险硬门槛，再比较估值。</p></article>
        <article><span>02</span><h2>统一六维映射</h2><p>业务抗危机、分红质量、资产负债安全、现金流可见度、估值安全垫、尾部风险控制统一为 0–100 分。</p></article>
        <article><span>03</span><h2>行业风险预算</h2><p>{industry.label}的建议初始风险预算为 {industry.riskBudget}%，主要风险源是“{industry.primaryRisk}”，不能用行业内多持几只替代跨行业分散。</p></article>
        <article><span>04</span><h2>样本外纪律</h2><p>回测按财报实际披露日使用数据，处理分红再投、停牌和交易成本，并用滚动样本外区间验证，防止参数寻优过拟合。</p></article>
      </div>
      <section className="unified-dimensions">
        <h2>跨行业只比较这六个维度</h2>
        <div>{["业务抗危机", "分红质量", "财务安全", "现金流可见", "估值安全垫", "尾部风险控制"].map((item, index) => <span key={item}><i>{index + 1}</i>{item}</span>)}</div>
      </section>
    </section>
  );
}

export function IndustryWorkspace({
  industry,
  page,
  stockCode,
  quote,
  quoteError,
  valuationDate,
  analysis,
  onSelectStock,
}: {
  industry: IndustryConfig;
  page: IndustryPage;
  stockCode: string;
  quote: LiveQuote | null;
  quoteError: string;
  valuationDate: string;
  analysis: IndustryAnalysisResult | null;
  onSelectStock: (stockCode: string) => void;
}) {
  const [ranking, setRanking] = useState<IndustryRankingResponse | null>(null);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [rankingError, setRankingError] = useState("");

  useEffect(() => {
    if (page !== "reversion" || !["hydro", "consumer", "resources", "oilgas", "tollroad", "nuclear", "telecom"].includes(industry.id)) return;
    let cancelled = false;
    setRankingLoading(true);
    setRankingError("");
    getIndustryRanking(industry.id as "hydro" | "consumer" | "resources" | "oilgas" | "tollroad" | "nuclear" | "telecom", valuationDate)
      .then((result) => {
        if (!cancelled) setRanking(result);
      })
      .catch((error) => {
        if (!cancelled) setRankingError(error instanceof Error ? error.message : "同行排名加载失败");
      })
      .finally(() => {
        if (!cancelled) setRankingLoading(false);
      });
    return () => { cancelled = true; };
  }, [industry.id, page, valuationDate]);

  if (industry.id === "hydro") {
    return (
      <HydroWorkspace
        industry={industry}
        page={page}
        stockCode={stockCode}
        quote={quote}
        valuationDate={valuationDate}
        analysis={analysis}
        ranking={ranking}
        rankingLoading={rankingLoading}
        rankingError={rankingError}
        onSelectStock={onSelectStock}
      />
    );
  }
  if (industry.id === "consumer") {
    return (
      <ConsumerWorkspace
        industry={industry}
        page={page}
        stockCode={stockCode}
        quote={quote}
        valuationDate={valuationDate}
        analysis={analysis}
        ranking={ranking}
        rankingLoading={rankingLoading}
        rankingError={rankingError}
        onSelectStock={onSelectStock}
      />
    );
  }
  if (industry.id === "resources") {
    return (
      <ResourceWorkspace
        industry={industry}
        page={page}
        stockCode={stockCode}
        quote={quote}
        valuationDate={valuationDate}
        analysis={analysis}
        ranking={ranking}
        rankingLoading={rankingLoading}
        rankingError={rankingError}
        onSelectStock={onSelectStock}
      />
    );
  }
  if (industry.id === "oilgas") {
    return (
      <OilGasWorkspace
        industry={industry}
        page={page}
        stockCode={stockCode}
        quote={quote}
        valuationDate={valuationDate}
        analysis={analysis}
        ranking={ranking}
        rankingLoading={rankingLoading}
        rankingError={rankingError}
        onSelectStock={onSelectStock}
      />
    );
  }
  if (industry.id === "tollroad") {
    return (
      <TollRoadWorkspace
        industry={industry}
        page={page}
        stockCode={stockCode}
        quote={quote}
        valuationDate={valuationDate}
        analysis={analysis}
        ranking={ranking}
        rankingLoading={rankingLoading}
        rankingError={rankingError}
        onSelectStock={onSelectStock}
      />
    );
  }
  if (industry.id === "nuclear") {
    return (
      <NuclearWorkspace
        industry={industry}
        page={page}
        stockCode={stockCode}
        quote={quote}
        valuationDate={valuationDate}
        analysis={analysis}
        ranking={ranking}
        rankingLoading={rankingLoading}
        rankingError={rankingError}
        onSelectStock={onSelectStock}
      />
    );
  }
  if (industry.id === "telecom") {
    return (
      <TelecomWorkspace
        industry={industry}
        page={page}
        stockCode={stockCode}
        quote={quote}
        valuationDate={valuationDate}
        analysis={analysis}
        ranking={ranking}
        rankingLoading={rankingLoading}
        rankingError={rankingError}
        onSelectStock={onSelectStock}
      />
    );
  }
  return (
    <div className="industry-workspace fade-in">
      {page === "overview" && (
        <>
          <IndustryHero industry={industry} stockCode={stockCode} quote={quote} quoteError={quoteError} valuationDate={valuationDate} analysis={analysis} />
          <IndustryOverview industry={industry} stockCode={stockCode} analysis={analysis} />
        </>
      )}
      {page === "reversion" && <IndustryRanking industry={industry} stockCode={stockCode} onSelectStock={onSelectStock} />}
      {page === "details" && <IndustryDetails industry={industry} analysis={analysis} />}
      {page === "scenarios" && <IndustryScenarios industry={industry} />}
      {page === "methods" && <IndustryMethods industry={industry} />}
    </div>
  );
}

const uniqueIndustryIds = (ids: string[] | undefined): IndustryId[] => {
  const valid = new Set<IndustryId>(ALL_INDUSTRY_IDS);
  return [...new Set((ids ?? []).filter((id): id is IndustryId => valid.has(id as IndustryId)))];
};

export function IndustryUniverseBuilder({
  query,
  activeIndustryId,
  disabled,
  onChange,
}: {
  query: StrategyBacktestQuery;
  activeIndustryId: IndustryId;
  disabled?: boolean;
  onChange: (query: StrategyBacktestQuery) => void;
}) {
  const mode = query.universe_mode ?? "single";
  const selected = uniqueIndustryIds(query.industry_ids);
  const effectiveSelected = selected.length ? selected : [activeIndustryId];
  const stockCount = effectiveSelected.reduce((total, id) => total + INDUSTRY_MAP[id].stocks.length, 0);
  const universePatch = (industryIds: IndustryId[]) => {
    const minimumCap = industryIds.length > 1
      ? (1 - (query.crisis_cash_buffer ?? .1)) / industryIds.length
      : query.max_industry_weight;
    return {
      industry_ids: industryIds,
      max_industry_weight: Math.max(query.max_industry_weight, minimumCap),
      holding_count: industryIds.length === 1 && industryIds[0] === "bank"
        ? Math.min(query.holding_count, 20)
        : Math.max(query.holding_count, industryIds.length),
    };
  };
  const setMode = (nextMode: StrategyBacktestQuery["universe_mode"]) => {
    const industryIds = nextMode === "all"
      ? [...ALL_INDUSTRY_IDS]
      : nextMode === "single"
        ? [activeIndustryId]
        : effectiveSelected;
    onChange({ ...query, universe_mode: nextMode, ...universePatch(industryIds) });
  };
  const toggleIndustry = (industryId: IndustryId) => {
    if (mode === "single") {
      onChange({ ...query, ...universePatch([industryId]) });
      return;
    }
    const next = effectiveSelected.includes(industryId)
      ? effectiveSelected.filter((id) => id !== industryId)
      : [...effectiveSelected, industryId];
    if (!next.length) return;
    onChange({ ...query, universe_mode: "selected", ...universePatch(next) });
  };
  return (
    <fieldset className="industry-universe-builder" disabled={disabled}>
      <legend>回测股票池</legend>
      <div className="universe-mode-switch" aria-label="行业范围模式">
        {([ ["single", "单行业"], ["selected", "多行业"], ["all", "全行业"] ] as const).map(([value, label]) => (
          <button type="button" className={mode === value ? "active" : ""} onClick={() => setMode(value)} key={value}>{label}</button>
        ))}
      </div>
      <div className="industry-universe-chips">
        {INDUSTRIES.map((industry) => {
          const checked = effectiveSelected.includes(industry.id);
          return (
            <label className={checked ? "active" : ""} key={industry.id}>
              <input
                type={mode === "single" ? "radio" : "checkbox"}
                name="backtest-industry"
                checked={checked}
                onChange={() => toggleIndustry(industry.id)}
                disabled={disabled || mode === "all"}
              />
              <i>{industry.icon}</i>
              <span><b>{industry.shortLabel}</b><small>韧性 {industry.defensiveScore}</small></span>
              <em>{checked ? "✓" : "+"}</em>
            </label>
          );
        })}
      </div>
      <div className="universe-summary">
        <span>已选 <b>{effectiveSelected.length}</b> 个行业 · 核心池 <b>{stockCount}</b> 只</span>
        <small>{mode === "all" ? "全行业防御池" : effectiveSelected.map((id) => INDUSTRY_MAP[id].shortLabel).join(" / ")}</small>
      </div>
    </fieldset>
  );
}

const suggestedWeights = (ids: IndustryId[], cashBuffer: number, maxWeight: number) => {
  const investable = Math.max(0, 1 - cashBuffer);
  if (!ids.length) return [];
  if (ids.length === 1) return [{ id: ids[0], weight: investable }];
  const raw = ids.map((id) => ({ id, value: INDUSTRY_MAP[id].defensiveScore / Math.max(INDUSTRY_MAP[id].riskBudget, 1) }));
  const rawTotal = raw.reduce((sum, item) => sum + item.value, 0);
  const cap = Math.max(investable / ids.length, maxWeight);
  let weights = raw.map((item) => ({ id: item.id, weight: Math.min(cap, investable * item.value / rawTotal) }));
  for (let pass = 0; pass < 6; pass += 1) {
    const used = weights.reduce((sum, item) => sum + item.weight, 0);
    const remainder = investable - used;
    if (remainder <= .0001) break;
    const open = weights.filter((item) => item.weight < cap - .0001);
    if (!open.length) break;
    const addition = remainder / open.length;
    weights = weights.map((item) => item.weight < cap - .0001 ? { ...item, weight: Math.min(cap, item.weight + addition) } : item);
  }
  return weights.sort((a, b) => b.weight - a.weight);
};

export function DiversificationBlueprint({ query }: { query: StrategyBacktestQuery }) {
  const ids = uniqueIndustryIds(query.industry_ids);
  if (!ids.length) return null;
  const cashBuffer = query.crisis_cash_buffer ?? .1;
  const maxWeight = query.max_industry_weight ?? .3;
  const allocation = suggestedWeights(ids, cashBuffer, maxWeight);
  const vulnerabilities = new Map<string, number>();
  ids.forEach((id) => INDUSTRY_MAP[id].vulnerabilities.forEach((risk) => vulnerabilities.set(risk, (vulnerabilities.get(risk) ?? 0) + 1)));
  const concentratedRisk = [...vulnerabilities.entries()].sort((a, b) => b[1] - a[1])[0];
  return (
    <section className="diversification-blueprint">
      <div className="section-heading">
        <div><span className="eyebrow">CRISIS DIVERSIFICATION MAP</span><h2>组合行业风险预算</h2></div>
        <span className="coverage-pill">{ids.length} 行业 · {new Set(ids.map((id) => INDUSTRY_MAP[id].hedgeChannel)).size} 条对冲通道</span>
      </div>
      <div className="allocation-bars">
        {allocation.map(({ id, weight }) => (
          <div key={id}><span>{INDUSTRY_MAP[id].shortLabel}<small>{INDUSTRY_MAP[id].hedgeChannel}</small></span><i><b style={{ width: `${Math.min(100, weight * 100)}%` }} /></i><strong>{(weight * 100).toFixed(1)}%</strong></div>
        ))}
        {cashBuffer > 0 && <div className="cash"><span>危机缓冲仓<small>现金 / 短债</small></span><i><b style={{ width: `${cashBuffer * 100}%` }} /></i><strong>{(cashBuffer * 100).toFixed(1)}%</strong></div>}
      </div>
      <footer>
        <span><b>分配方式</b>{query.industry_weighting === "equal" ? "行业等权" : query.industry_weighting === "score" ? "综合评分加权" : "防御风险预算"}</span>
        <span><b>单行业上限</b>{ids.length === 1 ? "单行业模式不限制" : `${(maxWeight * 100).toFixed(0)}%`}</span>
        <span><b>集中风险</b>{concentratedRisk ? `${concentratedRisk[0]} · ${concentratedRisk[1]} 行业相关` : "未识别"}</span>
      </footer>
    </section>
  );
}
