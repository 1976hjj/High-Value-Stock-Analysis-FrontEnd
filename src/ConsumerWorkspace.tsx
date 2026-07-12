import { useEffect, useMemo, useState } from "react";

import type { LiveQuote } from "./api";
import { findIndustryStock, type IndustryConfig } from "./industryConfig";
import type { IndustryAnalysisResult, IndustryRankingResponse } from "./types";

type ConsumerPage = "overview" | "reversion" | "details" | "scenarios" | "methods";

type ConsumerProfile = {
  category: string;
  demandType: "必选" | "弱周期" | "可选";
  businessModel: string;
  channel: string;
  repeat: "很强" | "强" | "中等";
  pricingPower: number;
  demandSensitivity: number;
  keyVariable: string;
};

const CONSUMER_PROFILES: Record<string, ConsumerProfile> = {
  "600519": { category: "高端白酒", demandType: "弱周期", businessModel: "稀缺品牌 + 配额渠道", channel: "批发代理与直销并行", repeat: "强", pricingPower: 98, demandSensitivity: .46, keyVariable: "批价、直销占比与渠道库存" },
  "000858": { category: "高端白酒", demandType: "弱周期", businessModel: "品牌 + 规模化浓香产能", channel: "经销体系为主", repeat: "强", pricingPower: 90, demandSensitivity: .58, keyVariable: "批价、动销与合同负债" },
  "600887": { category: "乳制品", demandType: "必选", businessModel: "全国品牌 + 冷链供应链", channel: "现代渠道与下沉网络", repeat: "很强", pricingPower: 78, demandSensitivity: .34, keyVariable: "原奶成本、基础白奶量价" },
  "603288": { category: "调味品", demandType: "必选", businessModel: "高频刚需 + 渠道密度", channel: "经销商与餐饮零售", repeat: "很强", pricingPower: 82, demandSensitivity: .31, keyVariable: "渠道库存、餐饮需求与产品结构" },
  "000333": { category: "综合家电", demandType: "可选", businessModel: "规模制造 + 全球品牌 + ToB", channel: "线上线下与海外本地化", repeat: "中等", pricingPower: 84, demandSensitivity: .72, keyVariable: "海外收入、产品结构与资本配置" },
  "600690": { category: "综合家电", demandType: "可选", businessModel: "全球高端品牌 + 本地运营", channel: "全球多品牌零售网络", repeat: "中等", pricingPower: 82, demandSensitivity: .76, keyVariable: "海外利润率与高端份额" },
  "000568": { category: "高端白酒", demandType: "弱周期", businessModel: "老窖池资源 + 品牌升级", channel: "经销体系与数字化终端", repeat: "强", pricingPower: 88, demandSensitivity: .61, keyVariable: "批价、库存与全国化质量" },
  "600600": { category: "啤酒", demandType: "弱周期", businessModel: "基地市场 + 产品高端化", channel: "餐饮、流通与即时零售", repeat: "很强", pricingPower: 80, demandSensitivity: .47, keyVariable: "销量、吨价与高端品占比" },
  "603195": { category: "民用电工", demandType: "弱周期", businessModel: "强品牌 + 密集线下网点", channel: "装饰渠道、电商与专业门店", repeat: "中等", pricingPower: 91, demandSensitivity: .55, keyVariable: "网点动销、地产后周期与新品" },
  "002032": { category: "炊具小家电", demandType: "弱周期", businessModel: "品牌运营 + 全球协同", channel: "零售、电商与出口", repeat: "中等", pricingPower: 83, demandSensitivity: .52, keyVariable: "内需动销、出口与关联销售" },
};

const FALLBACK_PROFILE: ConsumerProfile = {
  category: "消费品",
  demandType: "弱周期",
  businessModel: "品牌 + 渠道",
  channel: "多渠道销售",
  repeat: "中等",
  pricingPower: 75,
  demandSensitivity: .6,
  keyVariable: "终端动销与现金回款",
};

type ConsumerMetric = {
  name: string;
  definition: string;
  preferred: string;
  warning: string;
  frequency: string;
  source: string;
};

const CONSUMER_METRIC_GROUPS: Array<{ id: string; title: string; question: string; metrics: ConsumerMetric[] }> = [
  {
    id: "brand",
    title: "品牌与需求",
    question: "增长来自真实消费，还是渠道补货？",
    metrics: [
      { name: "终端销量 / 动销", definition: "消费者实际购买量，必须与公司出货量分开", preferred: "终端销量与出货同步", warning: "出货增长但终端动销转弱", frequency: "月/季", source: "经营公告、渠道调研" },
      { name: "量价贡献拆分", definition: "收入增速拆成销量、成交价和产品结构三部分", preferred: "量稳、价升、结构改善", warning: "只靠提价且销量明显下滑", frequency: "季/半年", source: "财报、经营数据" },
      { name: "市场份额", definition: "按品类、价格带和渠道计算，避免只看全市场口径", preferred: "核心价格带持续提升", warning: "费用上升但份额下降", frequency: "季/年", source: "公司披露、第三方零售数据" },
      { name: "复购率 / 用户留存", definition: "同一用户在观察期内重复购买或继续使用的比例", preferred: "高频品类稳定、耐用品服务留存提升", warning: "新品拉新无法转化为复购", frequency: "月/季", source: "会员、电商与调研数据" },
      { name: "核心单品集中度", definition: "头部 SKU 收入和利润占比，结合生命周期判断", preferred: "核心单品稳、新品形成第二梯队", warning: "单品老化且新品成功率下降", frequency: "半年/年", source: "年报、产品数据" },
      { name: "品牌搜索与口碑", definition: "品牌主动搜索、净推荐值、投诉和退货趋势", preferred: "自然流量和口碑稳定", warning: "营销投放增加但自然声量下降", frequency: "周/月", source: "平台数据、消费者调研" },
    ],
  },
  {
    id: "channel",
    title: "渠道与库存",
    question: "货卖给渠道以后，是否真的卖给消费者？",
    metrics: [
      { name: "渠道库存天数", definition: "经销商可售库存 ÷ 日均终端销量，统一旺淡季口径", preferred: "处于公司健康区间", warning: "连续两个季度上升", frequency: "月/季", source: "公司交流、渠道样本" },
      { name: "出货与动销差", definition: "Sell-in 增速减 Sell-out 增速", preferred: "差值接近零", warning: "出货持续快于动销", frequency: "月/季", source: "经营数据、渠道调研" },
      { name: "批价 / 零售价折扣", definition: "实际成交价相对建议零售价或出厂价的折溢价", preferred: "价格体系稳定", warning: "折扣扩大或批价倒挂", frequency: "周/月", source: "终端采价、电商平台" },
      { name: "合同负债与预收", definition: "结合发货节奏观察经销商打款意愿，不孤立判断", preferred: "与真实动销匹配", warning: "预收下降且应收上升", frequency: "季", source: "资产负债表附注" },
      { name: "应收账款 / 收入", definition: "识别放宽信用、压货或海外账期变化", preferred: "稳定或下降", warning: "收入放缓同时应收加速", frequency: "季/年", source: "财报计算" },
      { name: "渠道结构与集中度", definition: "直营、经销、电商、海外及大客户占比与利润差异", preferred: "渠道多元且单客不过度集中", warning: "依赖单一平台或大客户", frequency: "半年/年", source: "年报、客户附注" },
    ],
  },
  {
    id: "finance",
    title: "财务与资本回报",
    question: "品牌优势能否转化成高质量自由现金流？",
    metrics: [
      { name: "毛利率桥", definition: "拆分价格、结构、原料、汇率和产能利用率影响", preferred: "结构升级可覆盖成本波动", warning: "提价后毛利率仍持续下降", frequency: "季/半年", source: "利润表、经营说明" },
      { name: "销售费用效率", definition: "增量收入或毛利 ÷ 增量销售费用", preferred: "投放效率稳定或提升", warning: "费用增速长期高于动销", frequency: "季/年", source: "利润表计算" },
      { name: "经营现金流 / 净利润", definition: "检验利润现金含量，结合预收、应收和存货解释", preferred: "多年均值 ≥ 1", warning: "连续低于 0.8", frequency: "季/年", source: "现金流量表" },
      { name: "ROIC", definition: "税后经营利润 ÷ 投入资本，剔除多余现金影响", preferred: "> WACC + 8%", warning: "高增长同时 ROIC 下滑", frequency: "半年/年", source: "财报重构" },
      { name: "增量 ROIC", definition: "新增经营利润 ÷ 新增投入资本，观察再投资质量", preferred: "不低于存量 ROIC 太多", warning: "扩张只增收入不增价值", frequency: "滚动三年", source: "财报计算" },
      { name: "营运资本周转", definition: "存货、应收、应付和合同负债共同形成的现金周期", preferred: "现金周期稳定或缩短", warning: "存货和应收同时抬升", frequency: "季/年", source: "资产负债表" },
      { name: "自由现金流", definition: "经营现金流减维持竞争力所需资本开支", preferred: "持续为正并匹配利润增长", warning: "利润增长但自由现金流下降", frequency: "季/年", source: "财报重构" },
    ],
  },
  {
    id: "value",
    title: "股东回报与估值",
    question: "优秀公司是否已透支未来增长？",
    metrics: [
      { name: "自由现金流收益率", definition: "正常化自由现金流 ÷ 当前市值", preferred: "> 自身历史中位", warning: "低于资金成本且依赖高增长", frequency: "日度/季报后", source: "行情 + 财报" },
      { name: "PE 与增长匹配", definition: "PE 需结合增长持续期、ROIC 和再投资率，而非机械 PEG", preferred: "保守增长下仍可接受", warning: "估值要求长期维持峰值增长", frequency: "日度/季报后", source: "行情 + 模型" },
      { name: "反向 DCF 隐含增长", definition: "由当前价格反推未来现金流增速和持续年限", preferred: "隐含假设低于审慎情景", warning: "需十年以上高增长才能成立", frequency: "估值日", source: "反向 DCF" },
      { name: "现金分红覆盖", definition: "自由现金流 ÷ 现金分红，同时核对回购和债务", preferred: "> 1.2 倍", warning: "靠资产负债表维持高分红", frequency: "年度/滚动", source: "财报、分红公告" },
      { name: "回购与股权激励稀释", definition: "净回购需扣除股权激励新增股份和相关成本", preferred: "回购价格合理且净股本下降", warning: "高估值回购只抵消稀释", frequency: "季/年", source: "公司公告" },
      { name: "估值分位与利率敏感度", definition: "观察 PE/FCF 分位及折现率每上升 50bp 的影响", preferred: "中低分位且压力测试有安全垫", warning: "高分位叠加长久期", frequency: "日度", source: "行情 + 估值模型" },
    ],
  },
];

const profileFor = (code: string) => CONSUMER_PROFILES[code] ?? FALLBACK_PROFILE;
const weightedScore = (stock: IndustryConfig["stocks"][number]) => Math.round(stock.defenseScore * .36 + stock.qualityScore * .42 + stock.incomeScore * .22);
const money = (value: number | null | undefined) => typeof value === "number" ? `¥${value.toFixed(2)}` : "—";
const pct = (value: number | null | undefined, digits = 1) => typeof value === "number" ? `${(value * 100).toFixed(digits)}%` : "—";
const panoramaQualityLabel = { reported: "财报原值", derived: "自动派生", proxy: "行业代理" } as const;
const panoramaStatusLabel = { strong: "强", stable: "稳健", watch: "关注", risk: "风险" } as const;

function ConsumerHeader({ industry, stockCode, quote, analysis, valuationDate }: { industry: IndustryConfig; stockCode: string; quote: LiveQuote | null; analysis: IndustryAnalysisResult | null; valuationDate: string }) {
  const stock = findIndustryStock(industry, stockCode);
  const profile = profileFor(stockCode);
  const score = Math.round(analysis?.scores.overall ?? weightedScore(stock));
  return (
    <section className="consumer-hero">
      <div className="consumer-identity">
        <span className="eyebrow">CONSUMER BRAND CONTROL ROOM · {stock.code}</span>
        <h1><i>◍</i>{stock.name}</h1>
        <p>{profile.category} · {profile.demandType}消费 · {profile.businessModel}</p>
        <div><span>复购 {profile.repeat}</span><span>定价权 {profile.pricingPower}/100</span><span>{profile.channel}</span></div>
      </div>
      <div className="consumer-market-snapshot">
        <span>{quote ? "实时价格" : "估值收盘"}</span>
        <b>{money(quote?.price ?? analysis?.current_price)}</b>
        <small>{quote ? `${quote.quote_date} ${quote.quote_time}` : analysis?.market_date ?? valuationDate}</small>
        <em>{analysis ? `${analysis.valuation_metric.toUpperCase()} 五年分位 ${pct(analysis.valuation_percentile)}` : "分析后显示估值分位"}</em>
      </div>
      <div className="consumer-score-card">
        <span>消费研究框架分</span><b>{score}</b>
        <strong>{score >= 88 ? "核心复利池" : score >= 80 ? "质量观察池" : "谨慎观察"}</strong>
        <small>质量 42% · 防御 36% · 股东回报 22%</small>
      </div>
    </section>
  );
}

function ConsumerOverview({ industry, stockCode, analysis }: { industry: IndustryConfig; stockCode: string; analysis: IndustryAnalysisResult | null }) {
  const stock = findIndustryStock(industry, stockCode);
  const profile = profileFor(stockCode);
  const automatedMetrics = analysis?.panorama?.groups.flatMap((group) => group.metrics) ?? [];
  const byKey = (key: string) => automatedMetrics.find((metric) => metric.key === key);
  const strongest = [...automatedMetrics].sort((a, b) => b.score - a.score)[0];
  const weakest = [...automatedMetrics].sort((a, b) => a.score - b.score)[0];
  const automatedConclusion = !analysis?.panorama
    ? "点击开始分析后，由最新财报、分红和行情自动生成结论。"
    : weakest?.status === "risk"
      ? `当前首要约束是${weakest.label}（${weakest.value}），品牌叙事不能覆盖这项风险。`
      : analysis.scores.overall >= 80 && analysis.valuation_percentile <= .45
        ? "增长质量、现金转换与点时估值同时通过初筛，可进入反向 DCF 检验。"
        : "经营质量未触发硬否决，但当前增长或估值安全垫不足，保持观察。";
  const lenses = [
    { index: "01", title: "需求与利润代理", value: `${byKey("revenue_growth")?.value ?? "—"} / ${byKey("profit_growth")?.value ?? "—"}`, note: "收入同比 / 利润同比，验证增长是否同步", target: `财报 ${analysis?.panorama?.report_date ?? "待分析"}` },
    { index: "02", title: "渠道现金质量", value: `${byKey("inventory_days")?.value ?? "—"} / ${byKey("cfo_to_revenue")?.value ?? "—"}`, note: "存货周转天数 / 经营现金流收入比", target: "财报自动计算" },
    { index: "03", title: "资本回报", value: `${byKey("roe_annualized")?.value ?? "—"} / ${byKey("cfo_to_np")?.value ?? "—"}`, note: "年化 ROE / 经营现金流净利润比", target: "财报自动计算" },
    { index: "04", title: "股息与价格", value: `${byKey("dividend_yield")?.value ?? "—"} / ${byKey("valuation_percentile")?.value ?? "—"}`, note: "实际近12月股息率 / 五年估值分位", target: `行情 ${analysis?.market_date ?? "待分析"}` },
  ];
  return (
    <>
      <section className="automated-industry-conclusion">
        <div><span>自动结论</span><b>{automatedConclusion}</b><small>{analysis?.panorama ? `财报 ${analysis.panorama.report_date} · 行情 ${analysis.market_date}` : "等待数据"}</small></div>
        <div><span>最强指标</span><b>{strongest ? `${strongest.label} ${strongest.value}` : "—"}</b><small>{strongest ? `评分 ${strongest.score.toFixed(0)}` : "等待分析"}</small></div>
        <div><span>最弱指标</span><b>{weakest ? `${weakest.label} ${weakest.value}` : "—"}</b><small>{weakest ? `评分 ${weakest.score.toFixed(0)}` : "等待分析"}</small></div>
      </section>
      <section className="consumer-thesis-chain">
        <div><span>消费者需求</span><b>人群 × 频次 × 客单价</b><small>先验证终端复购</small></div><i>→</i>
        <div><span>渠道兑现</span><b>动销 - 库存 - 折扣</b><small>排除压货式增长</small></div><i>→</i>
        <div><span>财务转换</span><b>毛利 - 获客费用 - 营运资本</b><small>得到真实自由现金流</small></div><i>→</i>
        <div><span>股东回报</span><b>高 ROIC 复利 + 合理价格</b><small>增长与估值同时约束</small></div>
      </section>
      <section className="consumer-lens-grid">
        {lenses.map((lens) => <article key={lens.index}><span>{lens.index} · {lens.title}</span><h2>{lens.value}</h2><p>{lens.note}</p><footer>{lens.target}</footer></article>)}
      </section>
      <section className="consumer-overview-bottom">
        <article>
          <span className="eyebrow">SELECTED BRAND</span><h2>{stock.name}研究定位</h2>
          <dl><div><dt>组合角色</dt><dd>{stock.role}</dd></div><div><dt>竞争壁垒</dt><dd>{stock.moat}</dd></div><div><dt>关键变量</dt><dd>{profile.keyVariable}</dd></div><div><dt>需求敏感度</dt><dd>{profile.demandSensitivity.toFixed(2)} · {profile.demandType}</dd></div></dl>
        </article>
        <article className="consumer-gates">
          <span className="eyebrow">ANTI-TRAP GATES</span><h2>消费股四道否决闸门</h2>
          <ul>
            <li><b>需求</b><span>出货增长但终端动销与复购下降</span></li>
            <li><b>渠道</b><span>库存、折扣、应收同时恶化</span></li>
            <li><b>资本</b><span>增长伴随增量 ROIC 持续下降</span></li>
            <li><b>估值</b><span>价格需要十年以上高增长才能成立</span></li>
          </ul>
          <p>{analysis?.risk_flags.length ? analysis.risk_flags.join("；") : "完成分析后显示行情侧风险信号。"}</p>
        </article>
      </section>
    </>
  );
}

function ConsumerRanking({ industry, stockCode, ranking, loading, error, onSelectStock }: { industry: IndustryConfig; stockCode: string; ranking: IndustryRankingResponse | null; loading: boolean; error: string; onSelectStock: (code: string) => void }) {
  const metricValue = (row: IndustryRankingResponse["results"][number], key: string) => row.key_metrics.find((metric) => metric.key === key)?.value ?? "—";
  return (
    <section className="consumer-page">
      <header className="consumer-page-head"><div><span className="eyebrow">POINT-IN-TIME PEER RANKING</span><h1>优质消费公司筛选</h1><p>使用估值日前已披露财报、实际分红、点时估值和价格风险自动排名；不读取回测结果。</p></div><span>{ranking ? `${ranking.result_count} 家 · ${ranking.valuation_date}` : "自动计算中"}</span></header>
      {loading && !ranking && <div className="industry-ranking-state"><b>正在计算消费同行排名</b><span>逐家公司对齐财报、现金流和估值分位…</span></div>}
      {error && !ranking && <div className="industry-ranking-state error"><b>同行排名暂不可用</b><span>{error}</span></div>}
      {ranking && (
      <div className="consumer-ranking-table" role="table" aria-label="优质消费公司筛选">
        <div className="consumer-ranking-row header automated" role="row"><span>排名 / 公司</span><span>品类 / 需求</span><span>收入 / 利润</span><span>现金 / ROE</span><span>股息 / 估值</span><span>数据综合分</span><span>风险</span><span>操作</span></div>
        {ranking.results.map((row) => {
          const stock = findIndustryStock(industry, row.stock_code);
          const profile = profileFor(row.stock_code);
          return <div className={`consumer-ranking-row automated ${row.stock_code === stockCode ? "active" : ""}`} role="row" key={row.stock_code}>
            <span><b>#{row.rank} {row.stock_name}</b><small>{row.stock_code} · 财报 {row.report_date ?? "—"}</small></span>
            <span><b>{profile.category}</b><small>{profile.demandType} · 敏感度 {profile.demandSensitivity.toFixed(2)}</small></span>
            <span><b>{metricValue(row, "revenue_growth")}</b><small>利润 {metricValue(row, "profit_growth")}</small></span>
            <span><b>{metricValue(row, "cfo_to_np")}</b><small>年化 ROE {metricValue(row, "roe_annualized")}</small></span>
            <span><b>{metricValue(row, "dividend_yield")}</b><small>估值分位 {metricValue(row, "valuation_percentile")}</small></span>
            <span><strong>{row.overall_score.toFixed(1)}</strong><small>质量 {row.quality_score.toFixed(0)} · 回报 {row.income_score.toFixed(0)}</small></span>
            <span><b>{row.risk_score.toFixed(0)}</b><small>{row.risk_flags[0] ?? "未触发硬预警"}</small></span>
            <span><button type="button" onClick={() => onSelectStock(row.stock_code)}>{row.stock_code === stockCode ? "当前" : "查看"}</button></span>
          </div>;
        })}
      </div>
      )}
      <p className="consumer-note">{ranking?.data_note ?? "排名完成后展示每家公司的真实关键指标、风险和点时综合分。"}</p>
    </section>
  );
}

function ConsumerPanorama({ analysis }: { analysis: IndustryAnalysisResult | null }) {
  const [groupId, setGroupId] = useState("brand");
  const active = CONSUMER_METRIC_GROUPS.find((group) => group.id === groupId) ?? CONSUMER_METRIC_GROUPS[0];
  const panorama = analysis?.panorama;
  const automatedGroup = panorama?.groups.find((group) => group.id === groupId);
  const tabGroups = panorama?.groups ?? CONSUMER_METRIC_GROUPS;
  const metricCount = panorama?.groups.reduce((sum, group) => sum + group.metrics.length, 0)
    ?? CONSUMER_METRIC_GROUPS.reduce((sum, group) => sum + group.metrics.length, 0);
  const volatility = analysis?.metrics.find((metric) => metric.key === "volatility");
  const drawdown = analysis?.metrics.find((metric) => metric.key === "drawdown");
  return (
    <section className="consumer-page consumer-panorama">
      <header className="consumer-page-head"><div><span className="eyebrow">AUTOMATED CONSUMER FUNDAMENTALS</span><h1>消费数据全景</h1><p>{panorama ? `已自动计算 ${metricCount} 项指标，财报期 ${panorama.report_date}、披露日 ${panorama.published_date}。` : `品牌、渠道、财务和估值共 ${metricCount} 个核心字段；点击开始分析后自动填入实际值。`}</p></div><span>{panorama ? `自动覆盖 ${(panorama.coverage_ratio * 100).toFixed(0)}%` : "等待自动分析"}</span></header>
      <section className="consumer-live-strip" aria-label="已接入的消费市场数据">
        <div><span>收盘价</span><b>{money(analysis?.current_price)}</b><small>{analysis?.market_date ?? "待分析"}</small></div>
        <div><span>PE / PB</span><b>{analysis ? `${analysis.current_pe?.toFixed(1) ?? "—"} / ${analysis.current_pb?.toFixed(2) ?? "—"}` : "—"}</b><small>点时行情</small></div>
        <div><span>五年 PE 分位</span><b>{pct(analysis?.valuation_percentile)}</b><small>历史交易日分位</small></div>
        <div><span>近一年波动</span><b>{volatility?.value ?? "—"}</b><small>后复权价格</small></div>
        <div><span>近一年回撤</span><b>{drawdown?.value ?? "—"}</b><small>后复权价格</small></div>
      </section>
      <nav className="consumer-data-tabs" aria-label="消费指标分类">
        {tabGroups.map((group) => <button type="button" className={group.id === groupId ? "active" : ""} onClick={() => setGroupId(group.id)} key={group.id}><b>{group.title}</b><small>{group.metrics.length} 项 · {"question" in group ? group.question : "后端自动计算"}</small></button>)}
      </nav>
      <div className={`consumer-data-table ${automatedGroup ? "automated" : ""}`} role="table" aria-label={`${automatedGroup?.title ?? active.title}指标`}>
        <div className="consumer-data-row header" role="row"><span>指标</span><span>{automatedGroup ? "当前值" : "统一口径"}</span><span>{automatedGroup ? "自动评分" : "健康特征"}</span><span>{automatedGroup ? "模型解读" : "预警信号"}</span><span>来源</span></div>
        {automatedGroup ? automatedGroup.metrics.map((metric) => <div className="consumer-data-row automated" role="row" key={metric.key}>
          <span><b>{metric.label}</b><small>{panoramaQualityLabel[metric.quality]}</small></span>
          <span className="actual-value"><b>{metric.value}</b><small>报告期 {panorama?.report_date}</small></span>
          <span><strong className={`panorama-score ${metric.status}`}>{metric.score.toFixed(0)}</strong><small>{panoramaStatusLabel[metric.status]}</small></span>
          <span>{metric.interpretation}</span>
          <span><b>{metric.source}</b><small>披露日 {panorama?.published_date}</small></span>
        </div>) : active.metrics.map((metric) => <div className="consumer-data-row" role="row" key={metric.name}><span><b>{metric.name}</b><small>点击“开始分析”自动取数</small></span><span>{metric.definition}</span><span className="positive">{metric.preferred}</span><span className="warning">{metric.warning}</span><span><b>{metric.frequency}</b><small>{metric.source}</small></span></div>)}
      </div>
      <footer className="consumer-coverage"><b>当前数据边界</b><p>{analysis?.data_note ?? "点击开始分析后，后端会自动读取最新可用财报、分红记录与行情并计算实际值；终端动销和经销商库存无法直接结构化取得时使用明确标注的收入、利润和营运资本代理。"}</p></footer>
    </section>
  );
}

const CONSUMER_PRESETS = {
  steady: { name: "稳定复购", volume: 2, price: 1, cost: 0, inventory: 0 },
  premium: { name: "提价成功", volume: 0, price: 5, cost: 2, inventory: 1 },
  downgrade: { name: "消费降级", volume: -8, price: -4, cost: -1, inventory: 10 },
  stuffing: { name: "渠道压货", volume: 4, price: -2, cost: 1, inventory: 22 },
} as const;

function ConsumerScenarios({ stockCode, analysis }: { stockCode: string; analysis: IndustryAnalysisResult | null }) {
  const profile = profileFor(stockCode);
  const allMetrics = analysis?.panorama?.groups.flatMap((group) => group.metrics) ?? [];
  const raw = (key: string, fallback: number) => allMetrics.find((metric) => metric.key === key)?.raw_value ?? fallback;
  const reportedRevenueGrowth = raw("revenue_growth", 0);
  const reportedProfitGrowth = raw("profit_growth", 0);
  const reportedGrossMargin = raw("gross_margin", .35);
  const reportedInventoryDays = raw("inventory_days", 60);
  const reportedCashConversion = raw("cfo_to_np", 1);
  const operatingLeverage = Math.max(.8, Math.min(2.2, Math.abs(reportedRevenueGrowth) > .01 ? Math.abs(reportedProfitGrowth / reportedRevenueGrowth) : 1.22));
  const [volume, setVolume] = useState(0);
  const [price, setPrice] = useState(0);
  const [cost, setCost] = useState(0);
  const [inventory, setInventory] = useState(0);
  useEffect(() => {
    setVolume(Math.max(-20, Math.min(20, reportedRevenueGrowth * 100)));
    setPrice(0); setCost(0); setInventory(0);
  }, [stockCode, analysis?.panorama?.report_date, reportedRevenueGrowth]);
  const demandVolume = volume * profile.demandSensitivity + volume * (1 - profile.demandSensitivity) * .55;
  const revenue = ((1 + demandVolume / 100) * (1 + price / 100) - 1) * 100;
  const grossMarginBps = price * (35 + reportedGrossMargin * 25) - cost * (20 + (1 - reportedGrossMargin) * 30);
  const operatingProfit = revenue * operatingLeverage + grossMarginBps / 100 * 1.5;
  const fcf = operatingProfit * .88 - Math.max(0, inventory) * .42;
  const cashConversion = Math.max(.35, reportedCashConversion + fcf / 180 - Math.max(0, inventory) * .006);
  const state = inventory >= 18 || fcf <= -15 ? "渠道与现金流承压" : fcf >= 8 && inventory <= 6 ? "增长质量改善" : "基本可控";
  const applyPreset = (preset: typeof CONSUMER_PRESETS[keyof typeof CONSUMER_PRESETS]) => { setVolume(preset.volume); setPrice(preset.price); setCost(preset.cost); setInventory(preset.inventory); };
  return (
    <section className="consumer-page consumer-scenario-lab">
      <header className="consumer-page-head"><div><span className="eyebrow">DATA-CALIBRATED DEMAND MODEL</span><h1>需求、价格与渠道推演</h1><p>销量基线、经营杠杆、毛利率和现金转换由当前财报自动带入；价格、成本和渠道库存用于透明压力测试。</p></div><span>{profile.category} · 需求敏感度 {profile.demandSensitivity.toFixed(2)}</span></header>
      <section className="automated-model-baseline"><div><span>财报基线</span><b>{analysis?.panorama?.report_date ?? "待分析"}</b></div><div><span>收入 / 利润同比</span><b>{(reportedRevenueGrowth * 100).toFixed(1)}% / {(reportedProfitGrowth * 100).toFixed(1)}%</b></div><div><span>自动经营杠杆</span><b>{operatingLeverage.toFixed(2)}×</b></div><div><span>毛利率</span><b>{(reportedGrossMargin * 100).toFixed(1)}%</b></div><div><span>存货天数 / 现金转换</span><b>{reportedInventoryDays.toFixed(1)}天 / {reportedCashConversion.toFixed(2)}×</b></div></section>
      <div className="consumer-preset-row">{Object.values(CONSUMER_PRESETS).map((preset) => <button type="button" onClick={() => applyPreset(preset)} key={preset.name}>{preset.name}</button>)}</div>
      <div className="consumer-scenario-grid">
        <section className="consumer-scenario-controls">
          <label><span>终端销量变化 <b>{volume > 0 ? "+" : ""}{volume}%</b></span><input aria-label="终端销量变化" type="range" min="-20" max="20" value={volume} onChange={(event) => setVolume(Number(event.target.value))} /><small>终端 Sell-out，不是公司向经销商出货。</small></label>
          <label><span>实际成交价变化 <b>{price > 0 ? "+" : ""}{price}%</b></span><input aria-label="实际成交价变化" type="range" min="-12" max="12" value={price} onChange={(event) => setPrice(Number(event.target.value))} /><small>包含促销折扣和产品结构，不用建议零售价。</small></label>
          <label><span>原料与制造成本变化 <b>{cost > 0 ? "+" : ""}{cost}%</b></span><input aria-label="原料与制造成本变化" type="range" min="-12" max="20" value={cost} onChange={(event) => setCost(Number(event.target.value))} /></label>
          <label><span>渠道库存天数变化 <b>{inventory > 0 ? "+" : ""}{inventory} 天</b></span><input aria-label="渠道库存天数变化" type="range" min="-15" max="35" value={inventory} onChange={(event) => setInventory(Number(event.target.value))} /><small>库存上升会先拖累现金流，随后影响折扣与出货。</small></label>
        </section>
        <section className={`consumer-scenario-result ${state.includes("承压") ? "risk" : state.includes("改善") ? "good" : "stable"}`}>
          <span>推演结论</span><b>{state}</b>
          <div><span>收入影响</span><strong>{revenue > 0 ? "+" : ""}{revenue.toFixed(1)}%</strong></div>
          <div><span>毛利率影响</span><strong>{grossMarginBps > 0 ? "+" : ""}{grossMarginBps.toFixed(0)}bp</strong></div>
          <div><span>经营利润影响</span><strong>{operatingProfit > 0 ? "+" : ""}{operatingProfit.toFixed(1)}%</strong></div>
          <div><span>自由现金流影响</span><strong>{fcf > 0 ? "+" : ""}{fcf.toFixed(1)}%</strong></div>
          <footer>现金转换估算 <b>{cashConversion.toFixed(2)}×</b></footer>
        </section>
      </div>
      <section className="consumer-transmission"><div><span>终端量 {demandVolume > 0 ? "+" : ""}{demandVolume.toFixed(1)}%</span><small>按品类敏感度调整</small></div><i>→</i><div><span>收入 {revenue > 0 ? "+" : ""}{revenue.toFixed(1)}%</span><small>叠加成交价 {price > 0 ? "+" : ""}{price}%</small></div><i>→</i><div><span>利润 {operatingProfit > 0 ? "+" : ""}{operatingProfit.toFixed(1)}%</span><small>扣除成本冲击</small></div><i>→</i><div><span>FCF {fcf > 0 ? "+" : ""}{fcf.toFixed(1)}%</span><small>再扣库存占款</small></div></section>
      <p className="consumer-note">该推演不使用出货替代终端需求。实际敏感系数应按公司历史量价、毛利和营运资本数据回归，并在不同消费周期中复核。</p>
    </section>
  );
}

function ConsumerModel({ analysis }: { analysis: IndustryAnalysisResult | null }) {
  const allMetrics = analysis?.panorama?.groups.flatMap((group) => group.metrics) ?? [];
  const raw = (key: string, fallback: number) => allMetrics.find((metric) => metric.key === key)?.raw_value ?? fallback;
  const reportedRevenueGrowth = raw("revenue_growth", .08);
  const reportedProfitGrowth = raw("profit_growth", .08);
  const reportedRoe = raw("roe_annualized", .18);
  const reportedCashConversion = raw("cfo_to_np", 1);
  const [fcf, setFcf] = useState(0);
  const [growth, setGrowth] = useState(8);
  const [wacc, setWacc] = useState(8);
  const [terminal, setTerminal] = useState(2.5);
  const [roic, setRoic] = useState(18);
  const [cashConversion, setCashConversion] = useState(1);
  useEffect(() => {
    setFcf(Math.max(-25, Math.min(25, (reportedProfitGrowth - reportedRevenueGrowth) * 50)));
    setGrowth(Math.max(-2, Math.min(20, reportedRevenueGrowth * 100)));
    setRoic(Math.max(5, Math.min(45, reportedRoe * 100)));
    setCashConversion(Math.max(.4, Math.min(1.5, reportedCashConversion)));
  }, [analysis?.panorama?.report_date, reportedRevenueGrowth, reportedProfitGrowth, reportedRoe, reportedCashConversion]);
  const valueIndex = useMemo(() => {
    const growthFactor = Math.pow((1 + growth / 100) / 1.08, 5);
    const durationFactor = (.08 - .025) / Math.max(.02, wacc / 100 - terminal / 100);
    const qualityFactor = Math.max(.82, Math.min(1.22, 1 + (roic - 18) * .012));
    return Math.max(40, Math.min(190, 100 * (1 + fcf / 100) * growthFactor * durationFactor * qualityFactor * Math.min(1.08, cashConversion)));
  }, [fcf, growth, wacc, terminal, roic, cashConversion]);
  const qualityGate = roic >= wacc + 8 && cashConversion >= .9;
  const valuationGate = (analysis?.valuation_percentile ?? .5) <= .65;
  const impliedBurden = growth >= 12 || terminal >= 3 ? "增长假设偏重" : "增长假设可审查";
  const modelState = !qualityGate ? "质量闸门未通过" : valueIndex >= 110 && valuationGate ? "具备进一步研究条件" : "等待更高安全垫";
  return (
    <section className="consumer-page consumer-model">
      <header className="consumer-page-head"><div><span className="eyebrow">DATA-SEEDED CONSUMER VALUATION</span><h1>消费复利估值模型</h1><p>增长、现金修正、ROE代理和现金转换由当前财报自动带入；WACC与永续增长保留为可审查假设。</p></div><span>输出价值指数，不伪造目标价</span></header>
      <section className="automated-model-baseline"><div><span>财报期</span><b>{analysis?.panorama?.report_date ?? "待分析"}</b></div><div><span>收入同比</span><b>{(reportedRevenueGrowth * 100).toFixed(1)}%</b></div><div><span>利润同比</span><b>{(reportedProfitGrowth * 100).toFixed(1)}%</b></div><div><span>年化 ROE 代理</span><b>{(reportedRoe * 100).toFixed(1)}%</b></div><div><span>现金转换</span><b>{reportedCashConversion.toFixed(2)}×</b></div></section>
      <div className="consumer-model-grid">
        <section className="consumer-model-controls">
          <label><span>正常化自由现金流修正 <b>{fcf > 0 ? "+" : ""}{fcf}%</b></span><input aria-label="消费正常化自由现金流修正" type="range" min="-25" max="25" value={fcf} onChange={(event) => setFcf(Number(event.target.value))} /></label>
          <label><span>未来五年 FCF 增速 <b>{growth.toFixed(1)}%</b></span><input aria-label="未来五年 FCF 增速" type="range" min="-2" max="20" step="0.5" value={growth} onChange={(event) => setGrowth(Number(event.target.value))} /></label>
          <label><span>WACC <b>{wacc.toFixed(1)}%</b></span><input aria-label="消费 WACC" type="range" min="5.5" max="12" step="0.1" value={wacc} onChange={(event) => setWacc(Number(event.target.value))} /></label>
          <label><span>永续增长率 <b>{terminal.toFixed(1)}%</b></span><input aria-label="消费永续增长率" type="range" min="0" max="4" step="0.1" value={terminal} onChange={(event) => setTerminal(Number(event.target.value))} /></label>
          <label><span>ROIC / ROE 代理 <b>{roic.toFixed(0)}%</b></span><input aria-label="消费 ROIC" type="range" min="5" max="45" value={roic} onChange={(event) => setRoic(Number(event.target.value))} /></label>
          <label><span>经营现金流 / 净利润 <b>{cashConversion.toFixed(2)}×</b></span><input aria-label="消费现金转换" type="range" min="0.4" max="1.5" step="0.05" value={cashConversion} onChange={(event) => setCashConversion(Number(event.target.value))} /></label>
        </section>
        <section className="consumer-value-output">
          <span>质量调整价值指数</span><b>{valueIndex.toFixed(0)}</b><small>基准内在价值 = 100</small>
          <strong className={qualityGate && valueIndex >= 110 ? "good" : "watch"}>{modelState}</strong>
          <div><span>质量闸门</span><b>{qualityGate ? "通过" : "未通过"}</b></div><div><span>估值分位闸门</span><b>{valuationGate ? "通过" : "偏贵"}</b></div><div><span>增长负担</span><b>{impliedBurden}</b></div><div><span>当前 PE 分位</span><b>{pct(analysis?.valuation_percentile)}</b></div>
        </section>
      </div>
      <section className="consumer-model-stack">
        <article><span>模型 A</span><h2>质量调整 DCF</h2><p>增长只有在 ROIC 高于资本成本、且现金转换可靠时才增加价值。</p><code>价值 = FCF × 增长持续期 × ROIC 质量系数</code></article>
        <article><span>模型 B</span><h2>自由现金流收益率</h2><p>把正常化 FCF 收益率与资金成本、历史区间和可持续增长比较。</p><code>拒绝用低现金含量利润支撑高倍数</code></article>
        <article><span>模型 C</span><h2>反向 DCF</h2><p>由当前价格反推市场要求的增速和年限，再与品类天花板核对。</p><code>隐含增长越久，估值脆弱性越高</code></article>
      </section>
      <section className="consumer-model-pipeline"><div><b>01 需求正常化</b><span>剔除补库和异常促销</span></div><i>→</i><div><b>02 现金重构</b><span>扣营运资本与必要投入</span></div><i>→</i><div><b>03 ROIC 校验</b><span>判断增长是否创造价值</span></div><i>→</i><div><b>04 反向检验</b><span>核对价格隐含增长</span></div></section>
      <p className="consumer-note">价值指数 100 是标准化模型基准。财务输入已经自动化；终端动销和经销商库存仍使用财务代理，因此模型保留可审查假设，不伪造精确目标价。</p>
    </section>
  );
}

function ConsumerPriceProjection({ analysis }: { analysis: IndustryAnalysisResult | null }) {
  const projection = analysis?.price_projection;
  if (!projection) {
    return <section className="consumer-page"><div className="industry-ranking-state"><b>等待股价情景计算</b><span>点击“开始分析”，后端会使用最新财报、实际分红和点时行情生成四档价格区间。</span></div></section>;
  }
  return (
    <section className="consumer-page industry-price-page">
      <header className="consumer-page-head"><div><span className="eyebrow">BACKEND PRICE SCENARIOS</span><h1>消费股价情景推演</h1><p>由后端使用真实收盘价、当前 PE、收入利润趋势、现金质量、估值分位和实际分红计算，不依赖前端固定参数。</p></div><span>{projection.market_date} · {projection.model_name}</span></header>
      <section className="price-projection-summary">
        <div><span>当前收盘价</span><b>{money(projection.current_price)}</b><small>行情日 {projection.market_date}</small></div>
        <div><span>基准价值中枢</span><b>{money(projection.base_value_mid)}</b><small>{pct(projection.base_value_mid / projection.current_price - 1)} 相对现价</small></div>
        <div><span>防守关注价</span><b>{money(projection.defensive_entry_price)}</b><small>基准下沿折安全垫与悲观上沿取低</small></div>
        <div className="conclusion"><span>模型结论</span><b>{projection.conclusion}</b><small>财报 {projection.report_date}</small></div>
      </section>
      <div className="price-scenario-grid">
        {projection.scenarios.map((scenario) => (
          <article className={`price-scenario-card ${scenario.id}`} key={scenario.id}>
            <header><span>{scenario.name}</span><em>置信度 {(scenario.confidence * 100).toFixed(0)}%</em></header>
            <div className="price-range"><small>模型价格区间</small><b>{money(scenario.price_low)} – {money(scenario.price_high)}</b><strong>中枢 {money(scenario.price_mid)}</strong></div>
            <div className={`scenario-return ${scenario.return_mid >= 0 ? "up" : "down"}`}>{pct(scenario.return_mid)}<small>中枢相对现价</small></div>
            <dl><div><dt>盈利变化</dt><dd>{pct(scenario.earnings_change)}</dd></div><div><dt>目标 PE</dt><dd>{scenario.target_pe.toFixed(1)}×</dd></div><div><dt>股息锚</dt><dd>{scenario.dividend_yield_anchor ? pct(scenario.dividend_yield_anchor) : "不使用"}</dd></div></dl>
            <ul>{scenario.triggers.map((trigger) => <li key={trigger}>{trigger}</li>)}</ul>
            <footer>{scenario.formula}</footer>
          </article>
        ))}
      </div>
      <p className="consumer-note">{projection.data_note}</p>
    </section>
  );
}

function ConsumerModelGuide({ analysis }: { analysis: IndustryAnalysisResult | null }) {
  const projection = analysis?.price_projection;
  const base = projection?.scenarios.find((scenario) => scenario.id === "base");
  const metrics = analysis?.panorama?.groups.flatMap((group) => group.metrics) ?? [];
  const metric = (key: string) => metrics.find((item) => item.key === key)?.value ?? "—";
  const scenarioEps = projection && base ? projection.implied_eps_ttm * (1 + base.earnings_change) : null;
  const dividendPerShare = metrics.find((item) => item.key === "dividend_cash_ttm")?.raw_value ?? null;
  const dividendPrice = dividendPerShare && base?.dividend_yield_anchor ? dividendPerShare / base.dividend_yield_anchor : null;
  return (
    <section className="consumer-page industry-method-guide">
      <header className="consumer-page-head"><div><span className="eyebrow">READING GUIDE & WORKED EXAMPLE</span><h1>消费指标与价格模型说明</h1><p>这一页只解释指标、公式和当前公司的计算例子，不再保留一套难理解的重复估值计算器。</p></div><span>{projection ? `示例数据 · ${projection.market_date}` : "等待分析数据"}</span></header>
      <div className="method-guide-grid">
        <article><b>01</b><h2>从股价反推当前 EPS</h2><p>股价情景从市场实际价格和 PE 开始，而不是任意设一个利润。</p><dl><dt>公式</dt><dd>EPS TTM = 当前股价 ÷ PE TTM</dd><dt>当前股价</dt><dd>{money(projection?.current_price)}</dd><dt>当前 PE</dt><dd>{projection ? `${projection.current_pe.toFixed(2)}×` : "—"}</dd><dt>隐含 EPS</dt><dd>{projection ? `¥${projection.implied_eps_ttm.toFixed(3)}` : "—"}</dd></dl><p className="method-example">例：{projection ? `${money(projection.current_price)} ÷ ${projection.current_pe.toFixed(2)} = ¥${projection.implied_eps_ttm.toFixed(3)}` : "完成分析后显示实际计算"}。</p></article>
        <article><b>02</b><h2>收入与利润如何变成情景 EPS</h2><p>收入同比代理需求，利润同比反映价格、成本和费用的综合结果。</p><dl><dt>收入同比</dt><dd>{metric("revenue_growth")}</dd><dt>利润同比</dt><dd>{metric("profit_growth")}</dd><dt>基准盈利变化</dt><dd>{base ? pct(base.earnings_change) : "—"}</dd><dt>情景 EPS</dt><dd>{scenarioEps ? `¥${scenarioEps.toFixed(3)}` : "—"}</dd></dl><p className="method-example">公式：情景 EPS = 当前 EPS ×（1 + 情景盈利变化）。终端动销缺失时，收入增速只是代理。</p></article>
        <article><b>03</b><h2>目标 PE 不是固定倍数</h2><p>目标 PE 由当前 PE、五年估值分位和自动质量分共同调整。</p><dl><dt>五年估值分位</dt><dd>{metric("valuation_percentile")}</dd><dt>自动质量分</dt><dd>{analysis ? analysis.scores.quality.toFixed(1) : "—"}</dd><dt>基准目标 PE</dt><dd>{base ? `${base.target_pe.toFixed(2)}×` : "—"}</dd><dt>盈利估值价</dt><dd>{scenarioEps && base ? money(scenarioEps * base.target_pe) : "—"}</dd></dl><p className="method-caution">高质量只能支持有限溢价；当估值处于高分位时，目标倍数会自动收缩。</p></article>
        <article><b>04</b><h2>分红是辅助锚，不是唯一价值</h2><p>消费公司的价值主要来自盈利与高 ROE 复利，实际分红仅用于交叉检查价格。</p><dl><dt>每股现金分红</dt><dd>{metric("dividend_cash_ttm")}</dd><dt>基准目标股息率</dt><dd>{base?.dividend_yield_anchor ? pct(base.dividend_yield_anchor) : "—"}</dd><dt>股息锚价格</dt><dd>{money(dividendPrice)}</dd><dt>基准综合中枢</dt><dd>{money(base?.price_mid)}</dd></dl><p className="method-example">模型以 EPS×PE 为主、股息锚为辅，避免把低分红的高质量消费公司机械低估。</p></article>
        <article className="wide"><b>05</b><h2>关键指标怎么读</h2><dl><dt>经营现金流/净利润</dt><dd>{metric("cfo_to_np")}；接近或高于1通常表示利润现金含量较好。</dd><dt>年化 ROE</dt><dd>{metric("roe_annualized")}；需与杠杆一起看，高 ROE 不自动等于高 ROIC。</dd><dt>存货周转天数</dt><dd>{metric("inventory_days")}；白酒、乳品和家电必须按品类解释，不能直接横比。</dd><dt>价格区间</dt><dd>中枢上下加入情景误差带，避免把一个目标价包装成确定预测。</dd></dl><p className="method-caution">终端动销和经销商库存没有统一实时接口，模型明确使用收入、利润和公司营运资本代理，结论需要结合经营公告复核。</p></article>
      </div>
    </section>
  );
}

export function ConsumerWorkspace({ industry, page, stockCode, quote, valuationDate, analysis, ranking, rankingLoading, rankingError, onSelectStock }: { industry: IndustryConfig; page: ConsumerPage; stockCode: string; quote: LiveQuote | null; valuationDate: string; analysis: IndustryAnalysisResult | null; ranking: IndustryRankingResponse | null; rankingLoading: boolean; rankingError: string; onSelectStock: (stockCode: string) => void }) {
  return <div className="consumer-workspace fade-in">
    {page === "overview" && <><ConsumerHeader industry={industry} stockCode={stockCode} quote={quote} analysis={analysis} valuationDate={valuationDate} /><ConsumerOverview industry={industry} stockCode={stockCode} analysis={analysis} /></>}
    {page === "reversion" && <ConsumerRanking industry={industry} stockCode={stockCode} ranking={ranking} loading={rankingLoading} error={rankingError} onSelectStock={onSelectStock} />}
    {page === "details" && <ConsumerPanorama analysis={analysis} />}
    {page === "scenarios" && <ConsumerPriceProjection analysis={analysis} />}
    {page === "methods" && <ConsumerModelGuide analysis={analysis} />}
  </div>;
}
