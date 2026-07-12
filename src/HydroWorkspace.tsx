import { useEffect, useMemo, useState } from "react";

import type { LiveQuote } from "./api";
import { findIndustryStock, type IndustryConfig } from "./industryConfig";
import type { IndustryAnalysisResult, IndustryRankingResponse } from "./types";

type HydroPage = "overview" | "reversion" | "details" | "scenarios" | "methods";

type HydroCompanyProfile = {
  basin: string;
  archetype: string;
  assetMix: string;
  regulation: string;
  cashFlow: string;
  hydrologySensitivity: number;
  purity: "高" | "中高" | "中";
};

const HYDRO_PROFILES: Record<string, HydroCompanyProfile> = {
  "600900": { basin: "长江干流", archetype: "跨库梯级调度", assetMix: "大型水电为主", regulation: "多年/季调节组合", cashFlow: "成熟资产现金流核心", hydrologySensitivity: .44, purity: "高" },
  "600025": { basin: "澜沧江", archetype: "流域开发运营", assetMix: "水电 + 新能源成长", regulation: "梯级联合调度", cashFlow: "投产成长与去杠杆并行", hydrologySensitivity: .58, purity: "高" },
  "600674": { basin: "雅砻江", archetype: "参股权益平台", assetMix: "水电权益收益为主", regulation: "流域梯级调节", cashFlow: "投资收益转化为分红", hydrologySensitivity: .62, purity: "高" },
  "600886": { basin: "雅砻江为核心", archetype: "综合电源运营", assetMix: "水电 + 火电 + 新能源", regulation: "流域梯级调节", cashFlow: "多电源互补但口径更复杂", hydrologySensitivity: .56, purity: "中" },
  "600236": { basin: "红水河等流域", archetype: "区域梯级水电", assetMix: "水电为主、风光火补充", regulation: "龙头水库 + 梯级电站", cashFlow: "股息较强、来水弹性较高", hydrologySensitivity: .82, purity: "中高" },
  "002039": { basin: "北盘江/芙蓉江/三岔河", archetype: "区域高弹性水电", assetMix: "水电 + 少量光伏", regulation: "区域梯级调度", cashFlow: "丰枯水年利润差异明显", hydrologySensitivity: .92, purity: "中高" },
};

const FALLBACK_PROFILE: HydroCompanyProfile = {
  basin: "主要流域",
  archetype: "水电运营",
  assetMix: "水电资产",
  regulation: "以公司披露为准",
  cashFlow: "需按正常水文核验",
  hydrologySensitivity: .7,
  purity: "中",
};

type HydroMetric = {
  name: string;
  definition: string;
  preferred: string;
  warning: string;
  frequency: string;
  source: string;
};

const HYDRO_METRIC_GROUPS: Array<{
  id: string;
  title: string;
  question: string;
  metrics: HydroMetric[];
}> = [
  {
    id: "asset",
    title: "水文与资产",
    question: "能发多少电，波动能否被水库调节？",
    metrics: [
      { name: "控股水电装机", definition: "按权益与控股口径分开统计，不把参股装机当作并表装机", preferred: "核心流域规模大且梯级协同", warning: "新增装机依赖高造价远期项目", frequency: "半年/年度", source: "年报、项目公告" },
      { name: "水库调节性能", definition: "多年、年、季、日调节能力及库容结构", preferred: "龙头水库可平滑季节来水", warning: "径流式电站占比过高", frequency: "年度/项目变更", source: "年报、环评与项目资料" },
      { name: "来水偏差", definition: "主要控制断面来水相对多年均值与同期均值的偏差", preferred: "滚动 12–36 月回归均值", warning: "连续两个汛期显著偏枯", frequency: "月度/季度", source: "公司公告、水文机构" },
      { name: "蓄水位与可用水能", definition: "关键水库水位、有效库容和期末蓄能值", preferred: "汛末蓄水接近目标水位", warning: "旺季前水位低于季节区间", frequency: "旬/月", source: "流域调度、水利信息" },
      { name: "利用小时", definition: "发电量 ÷ 平均装机，需剔除新投产爬坡影响", preferred: "完整水文周期稳定", warning: "低于同流域且无法由来水解释", frequency: "月/季/年", source: "经营公告、年报" },
      { name: "弃水率/水能利用率", definition: "可利用水能未转化为上网电量的比例", preferred: "长期低位或持续改善", warning: "送出受限导致结构性弃水", frequency: "季/年", source: "公司经营数据" },
    ],
  },
  {
    id: "operation",
    title: "电量与电价",
    question: "发出的电能以什么价格、什么合同卖出去？",
    metrics: [
      { name: "水电发电量", definition: "分流域、分电站拆分同比变化，区分来水与新增机组", preferred: "正常水文下稳定增长", warning: "来水正常但发电量持续下降", frequency: "月/季", source: "月度经营公告" },
      { name: "平均上网电价", definition: "水电收入 ÷ 上网电量，剔除税费和补偿口径差异", preferred: "稳定或结构性提升", warning: "电量增长但收入不增", frequency: "季/半年", source: "财报、投资者交流" },
      { name: "市场化电量占比", definition: "中长期、现货和协议电量占总上网电量比例", preferred: "价格风险与消纳改善平衡", warning: "折价市场电量快速上升", frequency: "季/年", source: "年报、电力交易规则" },
      { name: "外送与本地消纳结构", definition: "跨区协议、落地省份与本地市场的电量结构", preferred: "合同期限长、受端需求稳", warning: "单一受端或单一合同高度集中", frequency: "年度", source: "年报、输电协议" },
      { name: "容量/辅助服务收入", definition: "调峰、调频、备用等非电量收入贡献", preferred: "调节价值逐步货币化", warning: "收入高度依赖未落地政策", frequency: "半年/年度", source: "财报、市场规则" },
    ],
  },
  {
    id: "finance",
    title: "财务与现金流",
    question: "会计利润能否变成可分配现金？",
    metrics: [
      { name: "EBITDA 利润率", definition: "剔除折旧和融资结构后比较水电资产经营效率", preferred: "同资产口径稳定", warning: "来水正常但利润率下滑", frequency: "季/年", source: "财务报表计算" },
      { name: "经营现金流/净利润", definition: "检验利润的现金含量，关注应收电费与税费扰动", preferred: "多年均值 ≥ 1", warning: "连续低于 0.8", frequency: "季/年", source: "现金流量表" },
      { name: "维护性资本开支", definition: "维持现有机组安全运行所需开支，与成长性项目分开", preferred: "成熟资产可预测", warning: "大修与安全整改集中抬升", frequency: "半年/年度", source: "年报、在建工程附注" },
      { name: "自由现金流", definition: "经营现金流 - 维护性资本开支 - 必要利息支出", preferred: "正常水文为正且覆盖分红", warning: "依靠新增借款维持分红", frequency: "季/年", source: "财报重构" },
      { name: "净债务/EBITDA", definition: "净有息负债相对正常水文 EBITDA，而非丰水年 EBITDA", preferred: "成熟平台 < 4 倍且下降", warning: "> 5 倍或利率上行期反升", frequency: "季/年", source: "资产负债表、利润表" },
      { name: "利息保障倍数", definition: "EBIT ÷ 利息费用，压力情景使用枯水年 EBIT", preferred: "> 3 倍", warning: "枯水年接近 1.5 倍", frequency: "季/年", source: "财报计算" },
      { name: "在建工程/总资产", definition: "识别未来折旧、融资与自由现金流压力", preferred: "投产节奏和回报可验证", warning: "在建规模上升但回报假设模糊", frequency: "季/年", source: "财报附注、项目公告" },
    ],
  },
  {
    id: "return",
    title: "分红与估值",
    question: "好资产是否已经被价格透支？",
    metrics: [
      { name: "自由现金流分红覆盖", definition: "自由现金流 ÷ 现金分红，优先于只看派息率", preferred: "> 1.2 倍", warning: "< 1 倍且靠融资补足", frequency: "年度/滚动", source: "财报与分红公告" },
      { name: "派息率与分红承诺", definition: "现金分红/归母净利润，并核对承诺期限与口径", preferred: "承诺与现金流匹配", warning: "高派息挤压偿债和必要投资", frequency: "年度", source: "分红规划、股东大会公告" },
      { name: "股息增长率", definition: "至少观察完整水文周期，避免用丰水年同比", preferred: "三至五年平滑正增长", warning: "股息对单年来水高度敏感", frequency: "年度", source: "历史分红" },
      { name: "EV/EBITDA", definition: "企业价值相对正常水文 EBITDA，统一债务与少数股东口径", preferred: "低于自身周期中枢", warning: "高溢价建立在丰水 EBITDA 上", frequency: "日度/季报后", source: "行情 + 财报" },
      { name: "自由现金流收益率", definition: "正常水文自由现金流 ÷ 企业价值或市值", preferred: "> 无风险利率 + 2%", warning: "收益率低于资金成本", frequency: "日度/季报后", source: "行情 + 财报重构" },
      { name: "DCF 折现率敏感度", definition: "WACC 每变化 50bp 对内在价值的影响", preferred: "保守 WACC 下仍有安全垫", warning: "结论依赖极低折现率", frequency: "估值日", source: "水电 DCF 模型" },
    ],
  },
];

const money = (value: number | null | undefined) => typeof value === "number" ? `¥${value.toFixed(2)}` : "—";
const pct = (value: number | null | undefined, digits = 1) => typeof value === "number" ? `${(value * 100).toFixed(digits)}%` : "—";
const profileFor = (stockCode: string) => HYDRO_PROFILES[stockCode] ?? FALLBACK_PROFILE;
const weightedScore = (stock: IndustryConfig["stocks"][number]) => Math.round(stock.defenseScore * .42 + stock.incomeScore * .25 + stock.qualityScore * .33);
const panoramaQualityLabel = { reported: "财报原值", derived: "自动派生", proxy: "行业代理" } as const;
const panoramaStatusLabel = { strong: "强", stable: "稳健", watch: "关注", risk: "风险" } as const;

function HydroHeader({ industry, stockCode, quote, analysis, valuationDate }: {
  industry: IndustryConfig;
  stockCode: string;
  quote: LiveQuote | null;
  analysis: IndustryAnalysisResult | null;
  valuationDate: string;
}) {
  const stock = findIndustryStock(industry, stockCode);
  const profile = profileFor(stockCode);
  const score = Math.round(analysis?.scores.overall ?? weightedScore(stock));
  const price = quote?.price ?? analysis?.current_price;
  return (
    <section className="hydro-hero">
      <div className="hydro-identity">
        <span className="eyebrow">HYDRO ASSET CONTROL ROOM · {stock.code}</span>
        <h1><i>≈</i>{stock.name}</h1>
        <p>{profile.basin} · {profile.archetype} · {profile.assetMix}</p>
        <div><span>水电纯度 {profile.purity}</span><span>{profile.regulation}</span><span>{stock.role}</span></div>
      </div>
      <div className="hydro-market-snapshot">
        <span>{quote ? "实时价格" : "估值收盘"}</span>
        <b>{money(price)}</b>
        <small>{quote ? `${quote.quote_date} ${quote.quote_time}` : analysis?.market_date ?? valuationDate}</small>
        <em>{analysis ? `${analysis.valuation_metric.toUpperCase()} 五年分位 ${pct(analysis.valuation_percentile)}` : "分析后显示估值分位"}</em>
      </div>
      <div className="hydro-score-card">
        <span>水电研究框架分</span>
        <b>{score}</b>
        <strong>{score >= 88 ? "核心研究池" : score >= 80 ? "质量观察池" : "谨慎观察"}</strong>
        <small>先正常化来水，再判断现金流与价格</small>
      </div>
    </section>
  );
}

function HydroOverview({ industry, stockCode, analysis }: { industry: IndustryConfig; stockCode: string; analysis: IndustryAnalysisResult | null }) {
  const stock = findIndustryStock(industry, stockCode);
  const profile = profileFor(stockCode);
  const automatedMetrics = analysis?.panorama?.groups.flatMap((group) => group.metrics) ?? [];
  const byKey = (key: string) => automatedMetrics.find((metric) => metric.key === key);
  const strongest = [...automatedMetrics].sort((a, b) => b.score - a.score)[0];
  const weakest = [...automatedMetrics].sort((a, b) => a.score - b.score)[0];
  const automatedConclusion = !analysis?.panorama
    ? "点击开始分析后，由最新财报、分红和行情自动生成结论。"
    : weakest?.status === "risk"
      ? `当前首要约束是${weakest.label}（${weakest.value}），暂不能只凭资产稀缺性得出防御结论。`
      : analysis.scores.overall >= 80 && analysis.valuation_percentile <= .45
        ? "财务质量与点时估值同时通过初筛，可进入正常水文估值与压力测试。"
        : "基本面未触发硬否决，但当前综合分或估值安全垫不足，保持观察。";
  const lenses = [
    { index: "01", title: "量价景气代理", value: `${byKey("profit_growth_proxy")?.value ?? "—"} / ${byKey("revenue_growth_proxy")?.value ?? "—"}`, note: "利润同比 / 收入同比，作为来水与电价的财务代理", target: `财报 ${analysis?.panorama?.report_date ?? "待分析"}` },
    { index: "02", title: "经营结果", value: `${byKey("gross_margin")?.value ?? "—"} / ${byKey("net_margin")?.value ?? "—"}`, note: "毛利率 / 净利率，验证电量最终利润转化", target: "财报自动计算" },
    { index: "03", title: "现金与杠杆", value: `${byKey("cfo_to_np")?.value ?? "—"} / ${byKey("liability_ratio")?.value ?? "—"}`, note: "经营现金流/净利润 / 资产负债率", target: "财报自动计算" },
    { index: "04", title: "股息与价格", value: `${byKey("dividend_yield")?.value ?? "—"} / ${byKey("valuation_percentile")?.value ?? "—"}`, note: "实际近12月股息率 / 五年估值分位", target: `行情 ${analysis?.market_date ?? "待分析"}` },
  ];
  return (
    <>
      <section className="automated-industry-conclusion">
        <div><span>自动结论</span><b>{automatedConclusion}</b><small>{analysis?.panorama ? `财报 ${analysis.panorama.report_date} · 行情 ${analysis.market_date}` : "等待数据"}</small></div>
        <div><span>最强指标</span><b>{strongest ? `${strongest.label} ${strongest.value}` : "—"}</b><small>{strongest ? `评分 ${strongest.score.toFixed(0)}` : "等待分析"}</small></div>
        <div><span>最弱指标</span><b>{weakest ? `${weakest.label} ${weakest.value}` : "—"}</b><small>{weakest ? `评分 ${weakest.score.toFixed(0)}` : "等待分析"}</small></div>
      </section>
      <section className="hydro-thesis-chain">
        <div><span>自然输入</span><b>来水 / 水位</b><small>不可控，但可被水库调节</small></div><i>→</i>
        <div><span>经营输出</span><b>上网电量 × 电价</b><small>分流域、分合同拆解</small></div><i>→</i>
        <div><span>财务转换</span><b>EBITDA - 利息 - 资本开支</b><small>得到真实自由现金流</small></div><i>→</i>
        <div><span>股东回报</span><b>可持续分红 + 估值回归</b><small>不为稀缺性支付无限溢价</small></div>
      </section>
      <section className="hydro-lens-grid">
        {lenses.map((lens) => (
          <article key={lens.index}>
            <span>{lens.index} · {lens.title}</span>
            <h2>{lens.value}</h2>
            <p>{lens.note}</p>
            <footer>{lens.target}</footer>
          </article>
        ))}
      </section>
      <section className="hydro-overview-bottom">
        <article>
          <span className="eyebrow">SELECTED ASSET</span>
          <h2>{stock.name}研究定位</h2>
          <dl>
            <div><dt>组合角色</dt><dd>{stock.role}</dd></div>
            <div><dt>核心壁垒</dt><dd>{stock.moat}</dd></div>
            <div><dt>首要核验</dt><dd>{stock.watch}</dd></div>
            <div><dt>资产结构</dt><dd>{profile.assetMix}</dd></div>
          </dl>
        </article>
        <article className="hydro-gate-list">
          <span className="eyebrow">NO SHORTCUTS</span>
          <h2>三道否决闸门</h2>
          <ul>
            <li><b>水文闸门</b><span>不能用单个丰水年利润外推长期现金流</span></li>
            <li><b>财务闸门</b><span>分红覆盖不足或杠杆上升时，高股息无效</span></li>
            <li><b>估值闸门</b><span>业务很稳不等于股价不会因折现率上升而下跌</span></li>
          </ul>
          {analysis?.risk_flags.length ? <p>{analysis.risk_flags.join("；")}</p> : <p>完成分析后，这里显示行情侧风险信号。</p>}
        </article>
      </section>
    </>
  );
}

function HydroRanking({ industry, stockCode, ranking, loading, error, onSelectStock }: { industry: IndustryConfig; stockCode: string; ranking: IndustryRankingResponse | null; loading: boolean; error: string; onSelectStock: (code: string) => void }) {
  const metricValue = (row: IndustryRankingResponse["results"][number], key: string) => row.key_metrics.find((metric) => metric.key === key)?.value ?? "—";
  return (
    <section className="hydro-page hydro-ranking">
      <header className="hydro-page-head">
        <div><span className="eyebrow">POINT-IN-TIME PEER RANKING</span><h1>优质水电公司筛选</h1><p>使用估值日前已披露财报、实际分红、点时估值和后复权风险数据自动排名；不读取回测结果。</p></div>
        <span>{ranking ? `${ranking.result_count} 家 · ${ranking.valuation_date}` : "自动计算中"}</span>
      </header>
      {loading && !ranking && <div className="industry-ranking-state"><b>正在计算水电同行排名</b><span>逐家公司对齐财报期、行情日和估值分位…</span></div>}
      {error && !ranking && <div className="industry-ranking-state error"><b>同行排名暂不可用</b><span>{error}</span></div>}
      {ranking && (
      <div className="hydro-ranking-table" role="table" aria-label="优质水电公司筛选">
        <div className="hydro-ranking-row header automated" role="row"><span>排名 / 公司</span><span>流域 / 类型</span><span>盈利代理</span><span>现金 / 杠杆</span><span>股息 / 估值</span><span>数据综合分</span><span>风险</span><span>操作</span></div>
        {ranking.results.map((row) => {
          const stock = findIndustryStock(industry, row.stock_code);
          const profile = profileFor(row.stock_code);
          return (
            <div className={`hydro-ranking-row automated ${row.stock_code === stockCode ? "active" : ""}`} role="row" key={row.stock_code}>
              <span><b>#{row.rank} {row.stock_name}</b><small>{row.stock_code} · 财报 {row.report_date ?? "—"}</small></span>
              <span><b>{profile.basin}</b><small>{profile.archetype}</small></span>
              <span><b>{metricValue(row, "profit_growth_proxy")}</b><small>收入代理 {metricValue(row, "revenue_growth_proxy")}</small></span>
              <span><b>{metricValue(row, "cfo_to_np")}</b><small>负债率 {metricValue(row, "liability_ratio")}</small></span>
              <span><b>{metricValue(row, "dividend_yield")}</b><small>估值分位 {metricValue(row, "valuation_percentile")}</small></span>
              <span><strong>{row.overall_score.toFixed(1)}</strong><small>质量 {row.quality_score.toFixed(0)} · 回报 {row.income_score.toFixed(0)}</small></span>
              <span><b>{row.risk_score.toFixed(0)}</b><small>{row.risk_flags[0] ?? "未触发硬预警"}</small></span>
              <span><button type="button" onClick={() => onSelectStock(row.stock_code)}>{row.stock_code === stockCode ? "当前" : "查看"}</button></span>
            </div>
          );
        })}
      </div>
      )}
      <p className="hydro-note">{ranking?.data_note ?? "排名完成后展示每家公司的真实关键指标、风险和点时综合分。"}</p>
    </section>
  );
}

function HydroDataPanorama({ analysis }: { analysis: IndustryAnalysisResult | null }) {
  const [groupId, setGroupId] = useState("asset");
  const active = HYDRO_METRIC_GROUPS.find((group) => group.id === groupId) ?? HYDRO_METRIC_GROUPS[0];
  const panorama = analysis?.panorama;
  const automatedGroup = panorama?.groups.find((group) => group.id === groupId);
  const tabGroups = panorama?.groups ?? HYDRO_METRIC_GROUPS;
  const metricCount = panorama?.groups.reduce((sum, group) => sum + group.metrics.length, 0)
    ?? HYDRO_METRIC_GROUPS.reduce((sum, group) => sum + group.metrics.length, 0);
  const volatility = analysis?.metrics.find((metric) => metric.key === "volatility");
  const drawdown = analysis?.metrics.find((metric) => metric.key === "drawdown");
  return (
    <section className="hydro-page hydro-panorama">
      <header className="hydro-page-head">
        <div><span className="eyebrow">AUTOMATED HYDRO FUNDAMENTALS</span><h1>水电数据全景</h1><p>{panorama ? `已自动计算 ${metricCount} 项指标，财报期 ${panorama.report_date}、披露日 ${panorama.published_date}。` : `运营、财务和估值共 ${metricCount} 个核心字段；点击开始分析后自动填入实际值。`}</p></div>
        <span>{panorama ? `自动覆盖 ${(panorama.coverage_ratio * 100).toFixed(0)}%` : "等待自动分析"}</span>
      </header>
      <section className="hydro-live-strip" aria-label="已接入的市场数据">
        <div><span>收盘价</span><b>{money(analysis?.current_price)}</b><small>{analysis?.market_date ?? "待分析"}</small></div>
        <div><span>PE / PB</span><b>{analysis ? `${analysis.current_pe?.toFixed(1) ?? "—"} / ${analysis.current_pb?.toFixed(2) ?? "—"}` : "—"}</b><small>Baostock 点时行情</small></div>
        <div><span>五年估值分位</span><b>{pct(analysis?.valuation_percentile)}</b><small>{analysis?.valuation_metric.toUpperCase() ?? "PE"} 口径</small></div>
        <div><span>近一年波动</span><b>{volatility?.value ?? "—"}</b><small>后复权价格序列</small></div>
        <div><span>近一年回撤</span><b>{drawdown?.value ?? "—"}</b><small>后复权价格序列</small></div>
      </section>
      <nav className="hydro-data-tabs" aria-label="水电指标分类">
        {tabGroups.map((group) => <button type="button" className={group.id === groupId ? "active" : ""} onClick={() => setGroupId(group.id)} key={group.id}><b>{group.title}</b><small>{group.metrics.length} 项 · {"question" in group ? group.question : "后端自动计算"}</small></button>)}
      </nav>
      <div className={`hydro-data-table ${automatedGroup ? "automated" : ""}`} role="table" aria-label={`${automatedGroup?.title ?? active.title}指标`}>
        <div className="hydro-data-row header" role="row"><span>指标</span><span>{automatedGroup ? "当前值" : "统一口径"}</span><span>{automatedGroup ? "自动评分" : "健康特征"}</span><span>{automatedGroup ? "模型解读" : "预警信号"}</span><span>来源</span></div>
        {automatedGroup ? automatedGroup.metrics.map((metric) => (
          <div className="hydro-data-row automated" role="row" key={metric.key}>
            <span><b>{metric.label}</b><small>{panoramaQualityLabel[metric.quality]}</small></span>
            <span className="actual-value"><b>{metric.value}</b><small>报告期 {panorama?.report_date}</small></span>
            <span><strong className={`panorama-score ${metric.status}`}>{metric.score.toFixed(0)}</strong><small>{panoramaStatusLabel[metric.status]}</small></span>
            <span>{metric.interpretation}</span>
            <span><b>{metric.source}</b><small>披露日 {panorama?.published_date}</small></span>
          </div>
        )) : active.metrics.map((metric) => (
          <div className="hydro-data-row" role="row" key={metric.name}>
            <span><b>{metric.name}</b><small>点击“开始分析”自动取数</small></span>
            <span>{metric.definition}</span><span className="positive">{metric.preferred}</span><span className="warning">{metric.warning}</span><span><b>{metric.frequency}</b><small>{metric.source}</small></span>
          </div>
        ))}
      </div>
      <footer className="hydro-coverage-footer">
        <b>当前数据边界</b>
        <p>{analysis?.data_note ?? "点击开始分析后，后端会自动读取最新可用财报、分红记录与行情并计算实际值；无法直接结构化取得的来水使用明确标注的收入/盈利代理，不冒充水文实测。"}</p>
      </footer>
    </section>
  );
}

const HYDRO_PRESETS = {
  normal: { name: "正常水文", water: 0, tariff: 0, capex: 0 },
  wet: { name: "丰水但不追价", water: 14, tariff: -1, capex: 2 },
  dry: { name: "连续枯水", water: -22, tariff: 0, capex: 4 },
  repricing: { name: "电价重定价", water: 2, tariff: -8, capex: 6 },
} as const;

function HydroScenarios({ stockCode, analysis }: { stockCode: string; analysis: IndustryAnalysisResult | null }) {
  const profile = profileFor(stockCode);
  const allMetrics = analysis?.panorama?.groups.flatMap((group) => group.metrics) ?? [];
  const raw = (key: string, fallback: number) => allMetrics.find((metric) => metric.key === key)?.raw_value ?? fallback;
  const reportedRevenueGrowth = raw("revenue_growth_proxy", 0);
  const reportedProfitGrowth = raw("profit_growth_proxy", 0);
  const cfoToProfit = raw("cfo_to_np", 1.1);
  const liabilityRatio = raw("liability_ratio", .55);
  const interestCover = raw("interest_cover", 3);
  const operatingLeverage = Math.max(.8, Math.min(2.2, Math.abs(reportedRevenueGrowth) > .01 ? Math.abs(reportedProfitGrowth / reportedRevenueGrowth) : 1.28));
  const baseCashBuffer = Math.max(.4, Math.min(1.8, cfoToProfit * (1 - Math.max(0, liabilityRatio - .55) * .7)));
  const [water, setWater] = useState(0);
  const [tariff, setTariff] = useState(0);
  const [capex, setCapex] = useState(0);
  useEffect(() => { setWater(0); setTariff(0); setCapex(0); }, [stockCode, analysis?.panorama?.report_date]);
  const generationImpact = water * profile.hydrologySensitivity;
  const revenueImpact = ((1 + generationImpact / 100) * (1 + tariff / 100) - 1) * 100;
  const ebitdaImpact = revenueImpact * operatingLeverage;
  const fcfImpact = ebitdaImpact - capex * .65;
  const cashBuffer = Math.max(.2, baseCashBuffer * (1 + fcfImpact / 100));
  const state = fcfImpact >= 8 && cashBuffer >= 1 ? "改善" : fcfImpact <= -18 || cashBuffer < .85 ? "承压" : "可控";
  const applyPreset = (preset: typeof HYDRO_PRESETS[keyof typeof HYDRO_PRESETS]) => { setWater(preset.water); setTariff(preset.tariff); setCapex(preset.capex); };
  return (
    <section className="hydro-page hydro-scenario-lab">
      <header className="hydro-page-head">
        <div><span className="eyebrow">DATA-CALIBRATED STRESS MODEL</span><h1>水文、电价与现金流推演</h1><p>经营杠杆与现金缓冲由当前财报自动校准；来水、电价和资本开支仍作为透明压力变量。</p></div>
        <span>{profile.basin} · 水文敏感系数 {profile.hydrologySensitivity.toFixed(2)}</span>
      </header>
      <section className="automated-model-baseline">
        <div><span>财报基线</span><b>{analysis?.panorama?.report_date ?? "待分析"}</b></div>
        <div><span>收入 / 利润同比</span><b>{(reportedRevenueGrowth * 100).toFixed(1)}% / {(reportedProfitGrowth * 100).toFixed(1)}%</b></div>
        <div><span>自动经营杠杆</span><b>{operatingLeverage.toFixed(2)}×</b></div>
        <div><span>现金含量 / 负债率</span><b>{cfoToProfit.toFixed(2)}× / {(liabilityRatio * 100).toFixed(1)}%</b></div>
        <div><span>利息保障</span><b>{interestCover.toFixed(2)}×</b></div>
      </section>
      <div className="hydro-preset-row">
        {Object.values(HYDRO_PRESETS).map((preset) => <button type="button" onClick={() => applyPreset(preset)} key={preset.name}>{preset.name}</button>)}
      </div>
      <div className="hydro-scenario-grid">
        <section className="hydro-scenario-controls">
          <label><span>来水偏差 <b>{water > 0 ? "+" : ""}{water}%</b></span><input aria-label="来水偏差" type="range" min="-35" max="30" step="1" value={water} onChange={(event) => setWater(Number(event.target.value))} /><small>相对多年正常来水；调节水库会降低发电量敏感度。</small></label>
          <label><span>平均上网电价变化 <b>{tariff > 0 ? "+" : ""}{tariff}%</b></span><input aria-label="平均上网电价变化" type="range" min="-15" max="10" step="1" value={tariff} onChange={(event) => setTariff(Number(event.target.value))} /><small>包含市场化折溢价和电量结构变化。</small></label>
          <label><span>资本开支偏离计划 <b>{capex > 0 ? "+" : ""}{capex}%</b></span><input aria-label="资本开支偏离计划" type="range" min="-10" max="25" step="1" value={capex} onChange={(event) => setCapex(Number(event.target.value))} /><small>只影响自由现金流，不直接改变 EBITDA。</small></label>
        </section>
        <section className={`hydro-scenario-result ${state === "承压" ? "risk" : state === "改善" ? "good" : "stable"}`}>
          <span>压力传导结果</span>
          <b>{state}</b>
          <div><span>发电量影响</span><strong>{generationImpact > 0 ? "+" : ""}{generationImpact.toFixed(1)}%</strong></div>
          <div><span>收入影响</span><strong>{revenueImpact > 0 ? "+" : ""}{revenueImpact.toFixed(1)}%</strong></div>
          <div><span>EBITDA 影响</span><strong>{ebitdaImpact > 0 ? "+" : ""}{ebitdaImpact.toFixed(1)}%</strong></div>
          <div><span>自由现金流影响</span><strong>{fcfImpact > 0 ? "+" : ""}{fcfImpact.toFixed(1)}%</strong></div>
          <footer>现金缓冲代理 <b>{cashBuffer.toFixed(2)}×</b></footer>
        </section>
      </div>
      <section className="hydro-transmission-line">
        <div><span>来水 {water > 0 ? "+" : ""}{water}%</span><small>× 调节系数 {profile.hydrologySensitivity.toFixed(2)}</small></div><i>→</i>
        <div><span>电量 {generationImpact > 0 ? "+" : ""}{generationImpact.toFixed(1)}%</span><small>再叠加电价 {tariff > 0 ? "+" : ""}{tariff}%</small></div><i>→</i>
        <div><span>EBITDA {ebitdaImpact > 0 ? "+" : ""}{ebitdaImpact.toFixed(1)}%</span><small>财报校准杠杆 {operatingLeverage.toFixed(2)}×</small></div><i>→</i>
        <div><span>FCF {fcfImpact > 0 ? "+" : ""}{fcfImpact.toFixed(1)}%</span><small>扣除资本开支偏差</small></div>
      </section>
      <p className="hydro-note">这是透明的敏感度推演，不是盈利预测。实际系数应按公司历史“来水—电量—利润”回归结果更新，并做滚动样本外检验。</p>
    </section>
  );
}

function HydroModel({ analysis }: { analysis: IndustryAnalysisResult | null }) {
  const allMetrics = analysis?.panorama?.groups.flatMap((group) => group.metrics) ?? [];
  const raw = (key: string, fallback: number) => allMetrics.find((metric) => metric.key === key)?.raw_value ?? fallback;
  const reportedRevenueGrowth = raw("revenue_growth_proxy", 0);
  const reportedProfitGrowth = raw("profit_growth_proxy", 0);
  const reportedLiability = raw("liability_ratio", .55);
  const reportedCashConversion = raw("cfo_to_np", 1.1);
  const [cashFlow, setCashFlow] = useState(0);
  const [wacc, setWacc] = useState(6.5);
  const [growth, setGrowth] = useState(1.5);
  const [debt, setDebt] = useState(55);
  const [cover, setCover] = useState(1.1);
  useEffect(() => {
    setCashFlow(Math.max(-25, Math.min(25, (reportedRevenueGrowth + reportedProfitGrowth) * 50)));
    setGrowth(Math.max(0, Math.min(3, reportedRevenueGrowth * 25)));
    setDebt(Math.max(0, Math.min(85, reportedLiability * 100)));
    setCover(Math.max(.5, Math.min(2, reportedCashConversion)));
  }, [analysis?.panorama?.report_date, reportedRevenueGrowth, reportedProfitGrowth, reportedLiability, reportedCashConversion]);
  const valueIndex = useMemo(() => {
    const durationFactor = (.065 - .015) / Math.max(.015, wacc / 100 - growth / 100);
    const debtFactor = 1 - Math.max(0, debt - 45) * .006;
    return Math.max(45, Math.min(180, 100 * (1 + cashFlow / 100) * durationFactor * debtFactor));
  }, [cashFlow, wacc, growth, debt]);
  const qualityGate = debt <= 65 && cover >= 1;
  const valuationGate = (analysis?.valuation_percentile ?? .5) <= .65;
  const modelState = !qualityGate ? "质量闸门未通过" : valueIndex >= 110 && valuationGate ? "具备进一步研究条件" : "等待更高安全垫";
  return (
    <section className="hydro-page hydro-model">
      <header className="hydro-page-head">
        <div><span className="eyebrow">DATA-SEEDED HYDRO VALUATION</span><h1>正常水文水电估值模型</h1><p>现金流修正、增长、负债率和现金转换由当前财报自动带入；WACC与永续增长保留为可审查假设。</p></div>
        <span>输出为价值指数，不伪造目标价</span>
      </header>
      <section className="automated-model-baseline"><div><span>财报期</span><b>{analysis?.panorama?.report_date ?? "待分析"}</b></div><div><span>收入同比</span><b>{(reportedRevenueGrowth * 100).toFixed(1)}%</b></div><div><span>利润同比</span><b>{(reportedProfitGrowth * 100).toFixed(1)}%</b></div><div><span>实际负债率</span><b>{(reportedLiability * 100).toFixed(1)}%</b></div><div><span>现金转换</span><b>{reportedCashConversion.toFixed(2)}×</b></div></section>
      <div className="hydro-model-grid">
        <section className="hydro-model-controls">
          <label><span>正常水文自由现金流修正 <b>{cashFlow > 0 ? "+" : ""}{cashFlow}%</b></span><input aria-label="正常水文自由现金流修正" type="range" min="-25" max="25" value={cashFlow} onChange={(event) => setCashFlow(Number(event.target.value))} /></label>
          <label><span>WACC <b>{wacc.toFixed(1)}%</b></span><input aria-label="WACC" type="range" min="4.5" max="9" step="0.1" value={wacc} onChange={(event) => setWacc(Number(event.target.value))} /></label>
          <label><span>永续增长率 <b>{growth.toFixed(1)}%</b></span><input aria-label="永续增长率" type="range" min="0" max="3" step="0.1" value={growth} onChange={(event) => setGrowth(Number(event.target.value))} /></label>
          <label><span>资产负债率 <b>{debt.toFixed(1)}%</b></span><input aria-label="水电资产负债率" type="range" min="0" max="85" step="1" value={debt} onChange={(event) => setDebt(Number(event.target.value))} /></label>
          <label><span>经营现金流 / 净利润 <b>{cover.toFixed(2)}×</b></span><input aria-label="水电现金转换" type="range" min="0.5" max="2" step="0.05" value={cover} onChange={(event) => setCover(Number(event.target.value))} /></label>
        </section>
        <section className="hydro-value-output">
          <span>正常化价值指数</span>
          <b>{valueIndex.toFixed(0)}</b>
          <small>基准内在价值 = 100</small>
          <strong className={qualityGate && valueIndex >= 110 ? "good" : "watch"}>{modelState}</strong>
          <div><span>质量闸门</span><b>{qualityGate ? "通过" : "未通过"}</b></div>
          <div><span>市场估值闸门</span><b>{valuationGate ? "通过" : "偏贵"}</b></div>
          <div><span>当前估值分位</span><b>{pct(analysis?.valuation_percentile)}</b></div>
        </section>
      </div>
      <section className="hydro-model-stack">
        <article><span>模型 A</span><h2>正常水文 DCF</h2><p>以 5–10 年水文中枢重构自由现金流，显式输入 WACC 与永续增长。</p><code>价值 ∝ 正常 FCF ÷ (WACC - g)</code></article>
        <article><span>模型 B</span><h2>EV / EBITDA 交叉验证</h2><p>使用正常水文 EBITDA，统一净债务、少数股东与参股权益口径。</p><code>拒绝用丰水 EBITDA 制造低倍数</code></article>
        <article><span>模型 C</span><h2>股息现金流底线</h2><p>先检验自由现金流覆盖，再把可持续股息率与无风险利率比较。</p><code>FCF 覆盖 ≥ 1.2× 才认可股息锚</code></article>
      </section>
      <section className="hydro-model-pipeline">
        <div><b>01 正常化</b><span>按完整水文周期重构电量</span></div><i>→</i><div><b>02 去杠杆</b><span>扣利息与维护资本开支</span></div><i>→</i><div><b>03 三模型交叉</b><span>DCF / 倍数 / 股息</span></div><i>→</i><div><b>04 安全垫</b><span>质量和估值闸门同时通过</span></div>
      </section>
      <p className="hydro-note">指数 100 是模型基准，不代表当前股价合理值。财务输入已自动化；来水中枢和维护资本开支仍需经营数据复核，因此模型保持价值指数而不伪造精确目标价。</p>
    </section>
  );
}

function HydroPriceProjection({ analysis }: { analysis: IndustryAnalysisResult | null }) {
  const projection = analysis?.price_projection;
  if (!projection) {
    return <section className="hydro-page"><div className="industry-ranking-state"><b>等待股价情景计算</b><span>点击“开始分析”，后端会用最新财报、实际分红和点时行情生成四档价格区间。</span></div></section>;
  }
  return (
    <section className="hydro-page industry-price-page">
      <header className="hydro-page-head"><div><span className="eyebrow">BACKEND PRICE SCENARIOS</span><h1>水电股价情景推演</h1><p>由后端使用真实收盘价、当前 PE、最新财报盈利趋势、估值分位与实际分红计算；不再使用前端手动默认参数。</p></div><span>{projection.market_date} · {projection.model_name}</span></header>
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
      <p className="hydro-note">{projection.data_note}</p>
    </section>
  );
}

function HydroModelGuide({ analysis }: { analysis: IndustryAnalysisResult | null }) {
  const projection = analysis?.price_projection;
  const base = projection?.scenarios.find((scenario) => scenario.id === "base");
  const metrics = analysis?.panorama?.groups.flatMap((group) => group.metrics) ?? [];
  const metric = (key: string) => metrics.find((item) => item.key === key)?.value ?? "—";
  const scenarioEps = projection && base ? projection.implied_eps_ttm * (1 + base.earnings_change) : null;
  const dividendPerShare = metrics.find((item) => item.key === "dividend_cash_ttm")?.raw_value ?? null;
  const dividendPrice = dividendPerShare && base?.dividend_yield_anchor ? dividendPerShare / base.dividend_yield_anchor : null;
  return (
    <section className="hydro-page industry-method-guide">
      <header className="hydro-page-head"><div><span className="eyebrow">READING GUIDE & WORKED EXAMPLE</span><h1>水电指标与价格模型说明</h1><p>这一页只解释指标、公式和当前公司的计算例子，不再放第二套重复估值工具。</p></div><span>{projection ? `示例数据 · ${projection.market_date}` : "等待分析数据"}</span></header>
      <div className="method-guide-grid">
        <article><b>01</b><h2>从股价反推当前 EPS</h2><p>情景模型首先把市场价格换算成当前盈利基准。</p><dl><dt>公式</dt><dd>EPS TTM = 当前股价 ÷ PE TTM</dd><dt>当前股价</dt><dd>{money(projection?.current_price)}</dd><dt>当前 PE</dt><dd>{projection ? `${projection.current_pe.toFixed(2)}×` : "—"}</dd><dt>隐含 EPS</dt><dd>{projection ? `¥${projection.implied_eps_ttm.toFixed(3)}` : "—"}</dd></dl><p className="method-example">例：{projection ? `${money(projection.current_price)} ÷ ${projection.current_pe.toFixed(2)} = ¥${projection.implied_eps_ttm.toFixed(3)}` : "完成分析后显示实际计算"}。</p></article>
        <article><b>02</b><h2>正常水文盈利情景</h2><p>收入和利润同比是来水、电量、电价的财务代理；基准情景不会把丰水高增长永久化。</p><dl><dt>收入景气代理</dt><dd>{metric("revenue_growth_proxy")}</dd><dt>盈利景气代理</dt><dd>{metric("profit_growth_proxy")}</dd><dt>基准盈利变化</dt><dd>{base ? pct(base.earnings_change) : "—"}</dd><dt>情景 EPS</dt><dd>{scenarioEps ? `¥${scenarioEps.toFixed(3)}` : "—"}</dd></dl><p className="method-example">公式：情景 EPS = 当前 EPS ×（1 + 情景盈利变化）。</p></article>
        <article><b>03</b><h2>目标 PE 与估值分位</h2><p>目标 PE 不是拍脑袋固定值，而是由当前 PE、五年分位和自动质量分调整。</p><dl><dt>五年估值分位</dt><dd>{metric("valuation_percentile")}</dd><dt>自动质量分</dt><dd>{analysis ? analysis.scores.quality.toFixed(1) : "—"}</dd><dt>基准目标 PE</dt><dd>{base ? `${base.target_pe.toFixed(2)}×` : "—"}</dd><dt>盈利估值价</dt><dd>{scenarioEps && base ? money(scenarioEps * base.target_pe) : "—"}</dd></dl><p className="method-caution">分位高时目标倍数下调；质量高只能提供有限溢价，不能抵消极端高估。</p></article>
        <article><b>04</b><h2>实际分红形成第二价格锚</h2><p>水电现金流较稳定，因此用近12月实际分红和目标股息率交叉验证 PE 估值。</p><dl><dt>每股现金分红</dt><dd>{metric("dividend_cash_ttm")}</dd><dt>基准目标股息率</dt><dd>{base?.dividend_yield_anchor ? pct(base.dividend_yield_anchor) : "—"}</dd><dt>股息锚价格</dt><dd>{money(dividendPrice)}</dd><dt>基准综合中枢</dt><dd>{money(base?.price_mid)}</dd></dl><p className="method-example">公式：股息锚价格 = 近12月每股现金分红 ÷ 目标股息率，再与 EPS×PE 价格按权重合成。</p></article>
        <article className="wide"><b>05</b><h2>关键指标怎么读</h2><dl><dt>经营现金流/净利润</dt><dd>{metric("cfo_to_np")}；高于1通常表示利润现金含量较好。</dd><dt>资产负债率</dt><dd>{metric("liability_ratio")}；越高，枯水与利率冲击越容易放大。</dd><dt>利息保障倍数</dt><dd>{metric("interest_cover")}；用于判断枯水年是否仍能覆盖利息。</dd><dt>价格区间</dt><dd>中枢上下加入模型误差带，避免把单点目标价伪装成确定答案。</dd></dl><p className="method-caution">来水仍缺统一结构化实测接口，所以“来水景气”明确使用收入/利润代理；看到代理指标时必须结合公司发电量公告复核。</p></article>
      </div>
    </section>
  );
}

export function HydroWorkspace({ industry, page, stockCode, quote, valuationDate, analysis, ranking, rankingLoading, rankingError, onSelectStock }: {
  industry: IndustryConfig;
  page: HydroPage;
  stockCode: string;
  quote: LiveQuote | null;
  valuationDate: string;
  analysis: IndustryAnalysisResult | null;
  ranking: IndustryRankingResponse | null;
  rankingLoading: boolean;
  rankingError: string;
  onSelectStock: (stockCode: string) => void;
}) {
  return (
    <div className="hydro-workspace fade-in">
      {page === "overview" && <><HydroHeader industry={industry} stockCode={stockCode} quote={quote} analysis={analysis} valuationDate={valuationDate} /><HydroOverview industry={industry} stockCode={stockCode} analysis={analysis} /></>}
      {page === "reversion" && <HydroRanking industry={industry} stockCode={stockCode} ranking={ranking} loading={rankingLoading} error={rankingError} onSelectStock={onSelectStock} />}
      {page === "details" && <HydroDataPanorama analysis={analysis} />}
      {page === "scenarios" && <HydroPriceProjection analysis={analysis} />}
      {page === "methods" && <HydroModelGuide analysis={analysis} />}
    </div>
  );
}
