import type { LiveQuote } from "./api";
import { findIndustryStock, type IndustryConfig } from "./industryConfig";
import type { IndustryAnalysisResult, IndustryRankingResponse, IndustryPriceScenario } from "./types";

type ResourcePage = "overview" | "reversion" | "details" | "scenarios" | "methods";

type ResourceProfile = {
  commodity: string;
  structure: string;
  hedgeRole: string;
  cycleSensitivity: number;
  costMoat: string;
  keyVariable: string;
};

const PROFILES: Record<string, ResourceProfile> = {
  "601088": { commodity: "动力煤 + 电力 + 运输", structure: "煤电运一体化", hedgeRole: "通胀现金流与高股息", cycleSensitivity: .62, costMoat: "自产煤低成本、长协和一体化平滑", keyVariable: "煤价中枢、自产煤成本与资本配置" },
  "601225": { commodity: "动力煤", structure: "低成本纯煤炭", hedgeRole: "高股息周期收益", cycleSensitivity: .82, costMoat: "优质矿区与现金成本优势", keyVariable: "长协现货结构、单位成本与投资收益" },
  "600188": { commodity: "煤炭 + 化工", structure: "海内外资源组合", hedgeRole: "高弹性周期收益", cycleSensitivity: .92, costMoat: "海外矿山与多品种资源", keyVariable: "澳洲煤价、负债和扩张纪律" },
  "601899": { commodity: "铜 + 金", structure: "全球矿山成长", hedgeRole: "铜周期与黄金对冲", cycleSensitivity: .88, costMoat: "全球项目获取和低成本运营", keyVariable: "铜金价格、产量爬坡与项目执行" },
  "600547": { commodity: "黄金", structure: "黄金采选冶", hedgeRole: "货币与地缘风险对冲", cycleSensitivity: .76, costMoat: "黄金资源储量和产能扩张", keyVariable: "金价、克金成本与产量兑现" },
  "603993": { commodity: "铜 + 钴 + 钼", structure: "全球多金属", hedgeRole: "能源转型金属弹性", cycleSensitivity: .95, costMoat: "世界级铜钴矿与运营改善", keyVariable: "铜钴价格、地缘税费与资本开支" },
};

const FALLBACK: ResourceProfile = { commodity: "煤炭与金属", structure: "上游资源", hedgeRole: "供给冲击对冲", cycleSensitivity: .85, costMoat: "资源禀赋与成本曲线", keyVariable: "商品价格、单位成本和资本纪律" };
const profileFor = (code: string) => PROFILES[code] ?? FALLBACK;
const money = (value: number | null | undefined) => typeof value === "number" ? `¥${value.toFixed(2)}` : "—";
const pct = (value: number | null | undefined, digits = 1) => typeof value === "number" ? `${(value * 100).toFixed(digits)}%` : "—";
const qualityLabel = { reported: "财报原值", derived: "自动派生", proxy: "行业代理" } as const;
const statusLabel = { strong: "强", stable: "稳健", watch: "关注", risk: "风险" } as const;

function ResourceHeader({ industry, stockCode, quote, analysis, valuationDate }: { industry: IndustryConfig; stockCode: string; quote: LiveQuote | null; analysis: IndustryAnalysisResult | null; valuationDate: string }) {
  const stock = findIndustryStock(industry, stockCode);
  const profile = profileFor(stockCode);
  const score = Math.round(analysis?.scores.overall ?? stock.qualityScore * .38 + stock.incomeScore * .30 + stock.defenseScore * .32);
  return <section className="resource-hero">
    <div><span className="eyebrow">RESOURCE CYCLE CONTROL ROOM · {stock.code}</span><h1><i>◆</i>{stock.name}</h1><p>{profile.commodity} · {profile.structure}</p><footer><span>{profile.hedgeRole}</span><span>周期敏感度 {profile.cycleSensitivity.toFixed(2)}</span><span>{profile.costMoat}</span></footer></div>
    <div className="resource-market"><span>{quote ? "实时价格" : "估值收盘"}</span><b>{money(quote?.price ?? analysis?.current_price)}</b><small>{quote ? `${quote.quote_date} ${quote.quote_time}` : analysis?.market_date ?? valuationDate}</small><em>{analysis ? `PB 五年分位 ${pct(analysis.valuation_percentile)}` : "分析后显示周期估值"}</em></div>
    <div className="resource-score"><span>资源周期质量分</span><b>{score}</b><strong>{score >= 82 ? "低成本核心池" : score >= 72 ? "周期观察池" : "高波动卫星仓"}</strong><small>成本与现金优先，不追逐峰值利润</small></div>
  </section>;
}

function ResourceOverview({ industry, stockCode, analysis }: { industry: IndustryConfig; stockCode: string; analysis: IndustryAnalysisResult | null }) {
  const stock = findIndustryStock(industry, stockCode);
  const profile = profileFor(stockCode);
  const metrics = analysis?.panorama?.groups.flatMap((group) => group.metrics) ?? [];
  const byKey = (key: string) => metrics.find((metric) => metric.key === key);
  const strongest = [...metrics].sort((a, b) => b.score - a.score)[0];
  const weakest = [...metrics].sort((a, b) => a.score - b.score)[0];
  const conclusion = !analysis?.panorama ? "点击开始分析后，由点时行情、最新财报和实际分红自动生成。" : weakest?.status === "risk" ? `首要约束是${weakest.label}（${weakest.value}），不能用高股息掩盖周期风险。` : analysis.scores.quality >= 75 && analysis.valuation_percentile <= .55 ? "成本现金代理、资产负债表和估值共同通过初筛，可进入中周期价格情景检验。" : "尚未触发硬否决，但周期位置或估值安全垫不足，保持观察。";
  const lenses = [
    ["01", "商品景气代理", `${byKey("commodity_revenue_proxy")?.value ?? "—"} / ${byKey("commodity_profit_proxy")?.value ?? "—"}`, "收入同比 / 利润同比，识别周期方向"],
    ["02", "成本与库存", `${byKey("gross_margin")?.value ?? "—"} / ${byKey("inventory_days")?.value ?? "—"}`, "毛利率 / 存货天数，观察成本吸收"],
    ["03", "现金与负债", `${byKey("cfo_to_np")?.value ?? "—"} / ${byKey("liability_ratio")?.value ?? "—"}`, "现金转换 / 资产负债率，判断下行生存力"],
    ["04", "股息与估值", `${byKey("dividend_yield")?.value ?? "—"} / ${byKey("valuation_percentile")?.value ?? "—"}`, "实际股息率 / 五年PB分位"],
  ];
  return <>
    <section className="automated-industry-conclusion"><div><span>自动结论</span><b>{conclusion}</b><small>{analysis?.panorama ? `财报 ${analysis.panorama.report_date} · 行情 ${analysis.market_date}` : "等待数据"}</small></div><div><span>最强指标</span><b>{strongest ? `${strongest.label} ${strongest.value}` : "—"}</b><small>{strongest ? `评分 ${strongest.score.toFixed(0)}` : "等待分析"}</small></div><div><span>最弱指标</span><b>{weakest ? `${weakest.label} ${weakest.value}` : "—"}</b><small>{weakest ? `评分 ${weakest.score.toFixed(0)}` : "等待分析"}</small></div></section>
    <section className="resource-cycle-chain"><div><span>商品价格</span><b>供需 × 库存 × 政策</b><small>决定收入景气</small></div><i>→</i><div><span>成本曲线</span><b>售价 - 单位现金成本</b><small>决定利润弹性</small></div><i>→</i><div><span>现金分配</span><b>经营现金 - 维持性资本开支</b><small>决定可持续分红</small></div><i>→</i><div><span>股价重估</span><b>中周期 EPS × 倍数 + 股息锚</b><small>拒绝峰值利润外推</small></div></section>
    <section className="resource-lens-grid">{lenses.map(([id, title, value, note]) => <article key={id}><span>{id} · {title}</span><h2>{value}</h2><p>{note}</p><footer>{analysis?.panorama?.report_date ?? "待分析"}</footer></article>)}</section>
    <section className="resource-overview-bottom"><article><span className="eyebrow">SELECTED ASSET</span><h2>{stock.name}研究定位</h2><dl><div><dt>组合角色</dt><dd>{stock.role}</dd></div><div><dt>资源结构</dt><dd>{profile.commodity}</dd></div><div><dt>成本壁垒</dt><dd>{profile.costMoat}</dd></div><div><dt>关键变量</dt><dd>{profile.keyVariable}</dd></div></dl></article><article><span className="eyebrow">ANTI-CYCLE GATES</span><h2>资源股四道否决闸门</h2><ul><li><b>成本</b><span>毛利率下滑且单位成本代理恶化</span></li><li><b>现金</b><span>峰值利润未转成经营现金</span></li><li><b>扩张</b><span>景气高位举债并大幅扩产</span></li><li><b>分红</b><span>用历史高股息率外推未来回报</span></li></ul></article></section>
  </>;
}

function ResourceRanking({ industry, stockCode, ranking, loading, error, onSelectStock }: { industry: IndustryConfig; stockCode: string; ranking: IndustryRankingResponse | null; loading: boolean; error: string; onSelectStock: (code: string) => void }) {
  const metric = (row: IndustryRankingResponse["results"][number], key: string) => row.key_metrics.find((item) => item.key === key)?.value ?? "—";
  return <section className="resource-page"><header className="resource-page-head"><div><span className="eyebrow">POINT-IN-TIME RESOURCE PEERS</span><h1>资源龙头自动筛选</h1><p>按同一估值日对齐财报、商品景气代理、现金质量、负债、实际股息和PB分位。</p></div><span>{ranking ? `${ranking.result_count} 家 · ${ranking.valuation_date}` : "自动计算中"}</span></header>
    {loading && !ranking && <div className="industry-ranking-state"><b>正在计算资源同行排名</b><span>逐家公司对齐周期代理、资产负债表和估值…</span></div>}
    {error && !ranking && <div className="industry-ranking-state error"><b>同行排名暂不可用</b><span>{error}</span></div>}
    {ranking && <div className="resource-ranking-table" role="table"><div className="resource-ranking-row header"><span>排名 / 公司</span><span>资源结构</span><span>收入 / 利润代理</span><span>现金 / 负债</span><span>股息 / PB分位</span><span>综合分</span><span>操作</span></div>{ranking.results.map((row) => { const p = profileFor(row.stock_code); return <div className={`resource-ranking-row ${row.stock_code === stockCode ? "active" : ""}`} key={row.stock_code}><span><b>#{row.rank} {row.stock_name}</b><small>{row.stock_code} · {row.report_date ?? "财报待取"}</small></span><span><b>{p.commodity}</b><small>{p.structure}</small></span><span><b>{metric(row, "commodity_revenue_proxy")} / {metric(row, "commodity_profit_proxy")}</b><small>财务景气代理</small></span><span><b>{metric(row, "cfo_to_np")} / {metric(row, "liability_ratio")}</b><small>现金转换 / 负债率</small></span><span><b>{metric(row, "dividend_yield")} / {pct(row.valuation_percentile)}</b><small>实际股息 / 五年分位</small></span><span><strong>{row.overall_score.toFixed(1)}</strong><small>{row.risk_flags[0] ?? "无硬风险"}</small></span><span><button type="button" onClick={() => onSelectStock(row.stock_code)}>{row.stock_code === stockCode ? "当前" : "查看"}</button></span></div>; })}</div>}
  </section>;
}

function ResourcePanorama({ analysis }: { analysis: IndustryAnalysisResult | null }) {
  const panorama = analysis?.panorama;
  return <section className="resource-page"><header className="resource-page-head"><div><span className="eyebrow">AUTOMATED RESOURCE PANORAMA</span><h1>周期、成本、现金与估值全景</h1><p>所有有值指标来自后端财报、分红和行情；商品价格与单位成本无法直接取得时明确标为行业代理。</p></div><span>{panorama ? `覆盖 ${(panorama.coverage_ratio * 100).toFixed(0)}% · ${panorama.report_date}` : "等待开始分析"}</span></header>
    {!panorama ? <div className="industry-ranking-state"><b>尚未生成资源数据全景</b><span>点击“开始分析”读取最新可用财报和点时行情。</span></div> : <div className="resource-panorama-groups">{panorama.groups.map((group) => <section key={group.id}><header><h2>{group.title}</h2><span>{group.metrics.length} 项</span></header><div className="resource-data-head"><span>指标</span><span>真实值</span><span>状态</span><span>口径与来源</span></div>{group.metrics.map((metric) => <div className="resource-data-row" key={metric.key}><span><b>{metric.label}</b><small>{qualityLabel[metric.quality]}</small></span><span><b>{metric.value}</b><small>评分 {metric.score.toFixed(0)}</small></span><span className={metric.status}>{statusLabel[metric.status]}</span><span><b>{metric.interpretation}</b><small>{metric.source}</small></span></div>)}</section>)}</div>}
    <p className="resource-note">{analysis?.data_note ?? "分析后显示数据日期和代理指标边界。"}</p>
  </section>;
}

function ScenarioCard({ scenario }: { scenario: IndustryPriceScenario }) {
  return <article className={`price-scenario-card ${scenario.id}`}><header><span>{scenario.name}</span><em>置信度 {(scenario.confidence * 100).toFixed(0)}%</em></header><div className="price-range"><small>模型价格区间</small><b>{money(scenario.price_low)} – {money(scenario.price_high)}</b><strong>中枢 {money(scenario.price_mid)}</strong></div><div className={`scenario-return ${scenario.return_mid >= 0 ? "up" : "down"}`}>{pct(scenario.return_mid)}<small>中枢相对现价</small></div><dl><div><dt>中周期盈利变化</dt><dd>{pct(scenario.earnings_change)}</dd></div><div><dt>目标 PE</dt><dd>{scenario.target_pe.toFixed(1)}×</dd></div><div><dt>可持续股息锚</dt><dd>{scenario.dividend_yield_anchor ? pct(scenario.dividend_yield_anchor) : "不使用"}</dd></div></dl><ul>{scenario.triggers.map((trigger) => <li key={trigger}>{trigger}</li>)}</ul><footer>{scenario.formula}</footer></article>;
}

function ResourcePriceProjection({ analysis }: { analysis: IndustryAnalysisResult | null }) {
  const projection = analysis?.price_projection;
  if (!projection) return <section className="resource-page"><div className="industry-ranking-state"><b>等待资源股价情景计算</b><span>点击“开始分析”，后端会使用真实行情、财报、分红和周期代理生成四档价格区间。</span></div></section>;
  return <section className="resource-page industry-price-page"><header className="resource-page-head"><div><span className="eyebrow">MID-CYCLE PRICE SCENARIOS</span><h1>资源股价情景推演</h1><p>不把当前高利润永久化：后端把商品景气代理向中周期收敛，再叠加成本现金质量、负债、估值分位和可持续股息锚。</p></div><span>{projection.market_date} · {projection.model_name}</span></header><section className="price-projection-summary"><div><span>当前收盘价</span><b>{money(projection.current_price)}</b><small>行情日 {projection.market_date}</small></div><div><span>基准价值中枢</span><b>{money(projection.base_value_mid)}</b><small>{pct(projection.base_value_mid / projection.current_price - 1)} 相对现价</small></div><div><span>防守关注价</span><b>{money(projection.defensive_entry_price)}</b><small>基准下沿折安全垫与悲观上沿取低</small></div><div className="conclusion"><span>模型结论</span><b>{projection.conclusion}</b><small>财报 {projection.report_date}</small></div></section><div className="price-scenario-grid">{projection.scenarios.map((scenario) => <ScenarioCard scenario={scenario} key={scenario.id} />)}</div><p className="resource-note">{projection.data_note}</p></section>;
}

function ResourceModelGuide({ analysis }: { analysis: IndustryAnalysisResult | null }) {
  const projection = analysis?.price_projection;
  const base = projection?.scenarios.find((item) => item.id === "base");
  const metrics = analysis?.panorama?.groups.flatMap((group) => group.metrics) ?? [];
  const value = (key: string) => metrics.find((item) => item.key === key)?.value ?? "—";
  const scenarioEps = projection && base ? projection.implied_eps_ttm * (1 + base.earnings_change) : null;
  const dividend = metrics.find((item) => item.key === "dividend_cash_ttm")?.raw_value;
  const dividendAnchor = dividend && base?.dividend_yield_anchor ? dividend / base.dividend_yield_anchor : null;
  return <section className="resource-page industry-method-guide"><header className="resource-page-head"><div><span className="eyebrow">RESOURCE MODEL GUIDE</span><h1>资源指标与价格模型说明</h1><p>用当前公司的真实数值解释中周期归一、成本现金闸门、可持续股息锚和股价区间。</p></div><span>{projection ? `示例数据 · ${projection.market_date}` : "等待分析数据"}</span></header><div className="method-guide-grid">
    <article><b>01</b><h2>为什么不能直接使用峰值 PE</h2><p>资源股盈利随商品价格均值回归，低 PE 可能只是利润处于高点。</p><dl><dt>当前价格</dt><dd>{money(projection?.current_price)}</dd><dt>当前 PE</dt><dd>{projection ? `${projection.current_pe.toFixed(2)}×` : "—"}</dd><dt>隐含 EPS TTM</dt><dd>{projection ? `¥${projection.implied_eps_ttm.toFixed(3)}` : "—"}</dd><dt>PB 五年分位</dt><dd>{value("valuation_percentile")}</dd></dl><p className="method-example">先用价格÷PE得到当前EPS，再把增长向中周期收敛，而不是永久外推。</p></article>
    <article><b>02</b><h2>商品价格与成本如何进入模型</h2><p>统一现货和单位成本源缺失时，用财报结果做代理且明确标注。</p><dl><dt>收入景气代理</dt><dd>{value("commodity_revenue_proxy")}</dd><dt>利润景气代理</dt><dd>{value("commodity_profit_proxy")}</dd><dt>毛利率</dt><dd>{value("gross_margin")}</dd><dt>基准中周期变化</dt><dd>{base ? pct(base.earnings_change) : "—"}</dd></dl><p className="method-example">情景 EPS = 当前 EPS ×（1 + 中周期盈利变化）= {scenarioEps ? `¥${scenarioEps.toFixed(3)}` : "—"}。</p></article>
    <article><b>03</b><h2>资产负债表是周期生存闸门</h2><p>商品价格下跌时，低杠杆和现金转换比当期高ROE更重要。</p><dl><dt>现金转换</dt><dd>{value("cfo_to_np")}</dd><dt>资产负债率</dt><dd>{value("liability_ratio")}</dd><dt>资产增速</dt><dd>{value("asset_growth")}</dd><dt>基准目标 PE</dt><dd>{base ? `${base.target_pe.toFixed(2)}×` : "—"}</dd></dl><p className="method-caution">高负债或景气高位快速扩张会自动压低归一化估值倍数。</p></article>
    <article><b>04</b><h2>高股息必须通过可持续性检验</h2><p>历史分红不是承诺，模型用更高目标股息率对应资源股的不确定性。</p><dl><dt>近12月每股分红</dt><dd>{value("dividend_cash_ttm")}</dd><dt>当前实际股息率</dt><dd>{value("dividend_yield")}</dd><dt>基准目标股息率</dt><dd>{base?.dividend_yield_anchor ? pct(base.dividend_yield_anchor) : "—"}</dd><dt>股息锚价格</dt><dd>{money(dividendAnchor)}</dd></dl><p className="method-example">股息锚 = 实际每股分红 ÷ 目标股息率；再与中周期EPS×目标PE加权。</p></article>
    <article className="wide"><b>05</b><h2>四种资源情景怎么读</h2><dl><dt>供给约束</dt><dd>商品上行、利润弹性释放，但仍检查是否追涨扩产。</dd><dt>中周期基准</dt><dd>只保留部分当期增长，用现金、负债和估值分位修正。</dd><dt>需求收缩</dt><dd>利润降幅大于收入，股息同步下修，区间扩大。</dd><dt>危机情景</dt><dd>模拟价格跌破现金成本、事故停产或政策冲击。</dd></dl><p className="method-caution">价格区间是可复算的压力测试，不是未来股价保证。煤价、铜价、金价和产量公告仍需结合公司经营披露复核。</p></article>
  </div></section>;
}

export function ResourceWorkspace({ industry, page, stockCode, quote, valuationDate, analysis, ranking, rankingLoading, rankingError, onSelectStock }: { industry: IndustryConfig; page: ResourcePage; stockCode: string; quote: LiveQuote | null; valuationDate: string; analysis: IndustryAnalysisResult | null; ranking: IndustryRankingResponse | null; rankingLoading: boolean; rankingError: string; onSelectStock: (stockCode: string) => void }) {
  return <div className="resource-workspace fade-in">{page === "overview" && <><ResourceHeader industry={industry} stockCode={stockCode} quote={quote} analysis={analysis} valuationDate={valuationDate} /><ResourceOverview industry={industry} stockCode={stockCode} analysis={analysis} /></>}{page === "reversion" && <ResourceRanking industry={industry} stockCode={stockCode} ranking={ranking} loading={rankingLoading} error={rankingError} onSelectStock={onSelectStock} />}{page === "details" && <ResourcePanorama analysis={analysis} />}{page === "scenarios" && <ResourcePriceProjection analysis={analysis} />}{page === "methods" && <ResourceModelGuide analysis={analysis} />}</div>;
}
