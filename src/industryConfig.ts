export type IndustryId =
  | "telecom"
  | "hydro"
  | "bank"
  | "tollroad"
  | "nuclear"
  | "oilgas"
  | "resources"
  | "consumer";

export type IndustryStock = {
  code: string;
  name: string;
  role: string;
  moat: string;
  watch: string;
  defenseScore: number;
  incomeScore: number;
  qualityScore: number;
};

export type IndustryMetric = {
  label: string;
  shortLabel: string;
  target: string;
  rationale: string;
  weight: number;
  direction: "higher" | "lower" | "stable";
};

export type IndustryScenario = {
  name: string;
  tone: "mint" | "lavender" | "peach" | "rose";
  shock: string;
  transmission: string;
  signals: string[];
  action: string;
};

export type IndustryConfig = {
  id: IndustryId;
  label: string;
  shortLabel: string;
  english: string;
  icon: string;
  resilience: "很强" | "较强" | "中等";
  dividend: string;
  stability: "很强" | "较强" | "中等" | "较弱";
  primaryRisk: string;
  summary: string;
  portfolioRole: string;
  valuationAnchor: string;
  defensiveScore: number;
  riskBudget: number;
  hedgeChannel: string;
  vulnerabilities: string[];
  nav: {
    overview: string;
    ranking: string;
    details: string;
    scenarios: string;
    methods: string;
  };
  metrics: IndustryMetric[];
  scenarios: IndustryScenario[];
  stocks: IndustryStock[];
};

export const INDUSTRIES: IndustryConfig[] = [
  {
    id: "telecom",
    label: "电信运营商",
    shortLabel: "电信",
    english: "TELECOM OPERATORS",
    icon: "⌁",
    resilience: "很强",
    dividend: "中高",
    stability: "很强",
    primaryRisk: "政策、资本开支",
    summary: "订阅型现金流、刚性通信需求和高进入壁垒，使运营商适合作为危机组合的现金流底仓。",
    portfolioRole: "低波动现金流锚；与资源品和可选消费形成需求周期对冲。",
    valuationAnchor: "EV/EBITDA + 自由现金流收益率 + 可持续股息率",
    defensiveScore: 94,
    riskBudget: 18,
    hedgeChannel: "刚性通信需求",
    vulnerabilities: ["policy", "capex", "technology"],
    nav: { overview: "运营现金总览", ranking: "运营商自动筛选", details: "用户与网络全景", scenarios: "股价情景推演", methods: "指标与模型说明" },
    metrics: [
      { label: "自由现金流覆盖股息", shortLabel: "股息覆盖", target: "> 1.3 倍", rationale: "先确认分红来自真实现金，而不是加杠杆。", weight: 28, direction: "higher" },
      { label: "资本开支 / 营收", shortLabel: "资本开支", target: "稳定或下降", rationale: "5G 建设高峰后，资本开支回落才会释放股东回报。", weight: 24, direction: "lower" },
      { label: "移动 ARPU 趋势", shortLabel: "ARPU", target: "同比非负", rationale: "资费与用户结构决定收入质量，避免只看用户数。", weight: 22, direction: "higher" },
      { label: "云与产业数字化增速", shortLabel: "第二曲线", target: "> GDP 增速", rationale: "第二增长曲线用于抵消传统通信业务成熟。", weight: 26, direction: "higher" },
    ],
    scenarios: [
      { name: "现金流释放", tone: "mint", shock: "资本开支继续回落，ARPU 稳中有升", transmission: "自由现金流改善 → 分红能力增强 → 估值中枢抬升", signals: ["资本开支强度连续下降", "派息率承诺未弱化", "产业数字化保持增长"], action: "允许提高底仓权重，但仍限制单一运营商集中度。" },
      { name: "基准稳定", tone: "lavender", shock: "通信主业平稳，第二曲线温和增长", transmission: "盈利低波动 → 股息累积成为主要收益来源", signals: ["ARPU 大致稳定", "自由现金流覆盖股息", "竞争格局没有恶化"], action: "按股息安全与估值分位再平衡。" },
      { name: "价格与开支压力", tone: "peach", shock: "资费竞争重启或新一轮网络投资", transmission: "收入承压 + 资本开支上升 → 自由现金流收缩", signals: ["ARPU 连续下滑", "资本开支预算上调", "派息率高于现金流承载"], action: "下调收益权重，保留现金流覆盖最强的标的。" },
      { name: "政策黑天鹅", tone: "rose", shock: "资费政策收紧、重大技术替代或强制投资", transmission: "盈利预期下修 → 股息承诺承压 → 防御属性失效", signals: ["监管口径突变", "净债务显著上升", "股息覆盖跌破 1 倍"], action: "触发行业止损线，资金转向水电、核电等不同风险源。" },
    ],
    stocks: [
      { code: "600941", name: "中国移动", role: "现金流核心", moat: "规模、网络与客户基础", watch: "资本开支与派息率", defenseScore: 95, incomeScore: 92, qualityScore: 94 },
      { code: "601728", name: "中国电信", role: "云网成长", moat: "云网融合与政企客户", watch: "云业务回报率", defenseScore: 90, incomeScore: 84, qualityScore: 88 },
      { code: "600050", name: "中国联通", role: "改革弹性", moat: "网络共建共享", watch: "盈利兑现与派息", defenseScore: 84, incomeScore: 78, qualityScore: 82 },
    ],
  },
  {
    id: "hydro",
    label: "大型水电",
    shortLabel: "水电",
    english: "LARGE HYDROPOWER",
    icon: "≈",
    resilience: "很强",
    dividend: "中低",
    stability: "很强",
    primaryRisk: "来水、电价、估值",
    summary: "长寿命稀缺水电资产具有低燃料成本和强现金流可见性，但必须把来水周期与估值溢价分开判断。",
    portfolioRole: "低成本公用事业底仓；对冲通胀之外的盈利衰退。",
    valuationAnchor: "DCF + EV/EBITDA + 股息率历史分位",
    defensiveScore: 96,
    riskBudget: 16,
    hedgeChannel: "低燃料成本",
    vulnerabilities: ["climate", "policy", "valuation"],
    nav: { overview: "水电资产总览", ranking: "优质公司筛选", details: "数据全景", scenarios: "股价情景推演", methods: "指标与模型说明" },
    metrics: [
      { label: "利用小时与来水偏差", shortLabel: "来水", target: "多周期均值附近", rationale: "单季丰枯水会扭曲利润，至少观察完整水文周期。", weight: 30, direction: "stable" },
      { label: "市场化电价折溢价", shortLabel: "电价", target: "折价可控", rationale: "电量稳定并不代表收入稳定，电价机制是第二变量。", weight: 24, direction: "higher" },
      { label: "净债务 / EBITDA", shortLabel: "杠杆", target: "持续下降", rationale: "成熟资产降杠杆后，现金流才更容易转化为分红。", weight: 22, direction: "lower" },
      { label: "自由现金流收益率", shortLabel: "现金回报", target: "> 无风险利率 + 2%", rationale: "优质资产也可能因估值过高而失去防御性。", weight: 24, direction: "higher" },
    ],
    scenarios: [
      { name: "丰水提价", tone: "mint", shock: "来水偏丰且电价稳定", transmission: "发电量增加 → 经营杠杆释放 → 自由现金流超预期", signals: ["主要流域来水偏丰", "市场化电价折价收窄", "负债率继续下降"], action: "盈利上修时不追高，按自由现金流收益率控制买点。" },
      { name: "正常水文", tone: "lavender", shock: "来水回归多年均值", transmission: "电量稳定 → 现金流与分红按既定节奏累积", signals: ["利用小时接近均值", "电价机制稳定", "重大资本开支可控"], action: "作为组合压舱石，季度检查估值溢价。" },
      { name: "枯水承压", tone: "peach", shock: "连续枯水或电价折让扩大", transmission: "发电量下降 → 利润下修，但成本端仍有缓冲", signals: ["跨季度来水偏枯", "蓄水位弱于季节性", "分红覆盖收窄"], action: "用正常水文利润估值，避免把短期低利润永久化。" },
      { name: "监管重定价", tone: "rose", shock: "上网电价或流域政策发生不利调整", transmission: "资产回报率下修 → 长久期估值压缩", signals: ["电价规则改变", "新增强制投资", "折现率显著上升"], action: "降低长久期暴露，并与短久期资源现金流搭配。" },
    ],
    stocks: [
      { code: "600900", name: "长江电力", role: "流域核心", moat: "梯级调度与稀缺资产", watch: "估值与来水", defenseScore: 97, incomeScore: 86, qualityScore: 97 },
      { code: "600025", name: "华能水电", role: "成长水电", moat: "澜沧江流域开发权", watch: "新增项目回报", defenseScore: 92, incomeScore: 78, qualityScore: 91 },
      { code: "600674", name: "川投能源", role: "参股现金流", moat: "雅砻江优质权益", watch: "投资收益依赖", defenseScore: 90, incomeScore: 84, qualityScore: 90 },
      { code: "600886", name: "国投电力", role: "水火互补", moat: "雅砻江与综合电源", watch: "火电成本扰动", defenseScore: 86, incomeScore: 79, qualityScore: 87 },
      { code: "600236", name: "桂冠电力", role: "红水河收益", moat: "龙滩与红水河梯级资产", watch: "来水弹性与业务混合", defenseScore: 84, incomeScore: 88, qualityScore: 85 },
      { code: "002039", name: "黔源电力", role: "区域高弹性", moat: "贵州两江一河梯级水电", watch: "水文波动与杠杆", defenseScore: 80, incomeScore: 82, qualityScore: 82 },
    ],
  },
  {
    id: "bank",
    label: "优质银行",
    shortLabel: "银行",
    english: "QUALITY BANKS",
    icon: "▦",
    resilience: "较强",
    dividend: "高",
    stability: "较强",
    primaryRisk: "信用风险、息差",
    summary: "高股息与低估值提供缓冲，但银行的防御性必须建立在资产质量、资本充足和可持续盈利之上。",
    portfolioRole: "高股息价值核心；承担利率与信用周期暴露。",
    valuationAnchor: "PB-ROE + 剩余收益 + 股息率底部",
    defensiveScore: 86,
    riskBudget: 20,
    hedgeChannel: "资本与拨备缓冲",
    vulnerabilities: ["credit", "rates", "property"],
    nav: { overview: "估值概览", ranking: "银行排序", details: "数据全景", scenarios: "信用情景推演", methods: "银行模型" },
    metrics: [
      { label: "核心一级资本充足率", shortLabel: "核心资本", target: "> 监管线 + 3%", rationale: "资本是吸收信用损失与维持分红的第一道缓冲。", weight: 26, direction: "higher" },
      { label: "不良与关注类迁徙", shortLabel: "资产质量", target: "稳定或改善", rationale: "只看不良率会滞后，需要同时看关注类和生成率。", weight: 30, direction: "lower" },
      { label: "净息差与 ROE 趋势", shortLabel: "盈利质量", target: "降幅收窄", rationale: "估值回归最终需要可持续 ROE，而不是单纯低 PB。", weight: 24, direction: "higher" },
      { label: "股息覆盖与派息率", shortLabel: "分红安全", target: "派息率可持续", rationale: "高股息若侵蚀资本，就可能是收益陷阱。", weight: 20, direction: "stable" },
    ],
    scenarios: [
      { name: "信用修复", tone: "mint", shock: "不良生成下降、息差企稳", transmission: "ROE 预期上修 → PB 中枢回归 → 股息与估值双收益", signals: ["关注类贷款下降", "净息差降幅收窄", "核心资本保持充裕"], action: "提高质量与低估同时满足的银行权重。" },
      { name: "温和承压", tone: "lavender", shock: "息差继续小幅收窄", transmission: "利润低增长 → 股息成为主要回报", signals: ["资产质量稳定", "拨备覆盖充足", "派息率没有激进上升"], action: "保留高股息核心，降低同质化区域暴露。" },
      { name: "信用下行", tone: "peach", shock: "地产与地方信用成本抬升", transmission: "拨备增加 → ROE 下滑 → 低 PB 可能继续折价", signals: ["不良生成上升", "关注类迁徙恶化", "资本补充压力增加"], action: "按风险灯剔除收益陷阱，而非机械抄底。" },
      { name: "系统性压力", tone: "rose", shock: "流动性、信用与资产价格共振", transmission: "资产负债表收缩 → 分红受限 → 估值深度折价", signals: ["信用利差急升", "资本充足率承压", "监管限制分红"], action: "压低行业总权重并提高现金、水电和电信配置。" },
    ],
    stocks: [
      { code: "600036", name: "招商银行", role: "零售质量", moat: "客户与财富管理", watch: "零售信用与息差", defenseScore: 91, incomeScore: 83, qualityScore: 94 },
      { code: "601398", name: "工商银行", role: "大行底仓", moat: "负债成本与规模", watch: "息差与资本回报", defenseScore: 90, incomeScore: 91, qualityScore: 90 },
      { code: "601939", name: "建设银行", role: "基建金融", moat: "低成本负债", watch: "地产链信用", defenseScore: 89, incomeScore: 90, qualityScore: 89 },
      { code: "601288", name: "农业银行", role: "县域负债", moat: "存款基础与网点", watch: "净息差", defenseScore: 91, incomeScore: 92, qualityScore: 89 },
      { code: "601658", name: "邮储银行", role: "零售负债", moat: "低成本存款网络", watch: "代理费与成长兑现", defenseScore: 88, incomeScore: 83, qualityScore: 88 },
      { code: "601169", name: "北京银行", role: "区域股息", moat: "首都区位与客户", watch: "区域集中度", defenseScore: 80, incomeScore: 87, qualityScore: 80 },
    ],
  },
  {
    id: "tollroad",
    label: "成熟收费公路",
    shortLabel: "公路",
    english: "MATURE TOLL ROADS",
    icon: "⇢",
    resilience: "较强",
    dividend: "中高",
    stability: "较强",
    primaryRisk: "收费期限、车流",
    summary: "成熟路产能产生可预测现金流，核心不是短期车流增速，而是剩余收费年限与再投资纪律。",
    portfolioRole: "类债现金流；对冲高波动成长资产。",
    valuationAnchor: "剩余收费期 DCF + 股息率 + 净债务偿付",
    defensiveScore: 87,
    riskBudget: 12,
    hedgeChannel: "通行现金流",
    vulnerabilities: ["policy", "traffic", "duration"],
    nav: { overview: "路产现金总览", ranking: "优质路产筛选", details: "车流与债务全景", scenarios: "股价情景推演", methods: "指标与模型说明" },
    metrics: [
      { label: "剩余加权收费年限", shortLabel: "收费期限", target: "> 12 年", rationale: "收费权有期限，传统永续估值会系统性高估。", weight: 30, direction: "higher" },
      { label: "同口径车流增速", shortLabel: "车流", target: "> 0", rationale: "区分自然增长、新并表与分流影响。", weight: 24, direction: "higher" },
      { label: "路产自由现金流率", shortLabel: "现金流", target: "> 股息率", rationale: "检验分红能否由成熟资产覆盖。", weight: 26, direction: "higher" },
      { label: "新增项目资本回报", shortLabel: "再投资", target: "> 资本成本", rationale: "成熟现金牛最常见风险是低回报扩张。", weight: 20, direction: "higher" },
    ],
    scenarios: [
      { name: "车流复苏", tone: "mint", shock: "客货车流同步改善", transmission: "通行费增长 → 经营杠杆释放 → 分红覆盖提升", signals: ["同口径车流转正", "货车占比稳定", "没有激进收购"], action: "优先剩余期限长、负债下降的路产。" },
      { name: "成熟稳态", tone: "lavender", shock: "车流随名义经济温和增长", transmission: "稳定现金流 → 债务下降 → 股息累积", signals: ["费率政策稳定", "维护开支可控", "自由现金流覆盖分红"], action: "以股息率和剩余收费期约束估值。" },
      { name: "需求走弱", tone: "peach", shock: "制造业与出行需求下行", transmission: "车流下降 → 通行费承压，但成本弹性有限", signals: ["货车流量连续下滑", "分流道路开通", "债务成本抬升"], action: "降低短期限与高杠杆路产权重。" },
      { name: "收费政策变化", tone: "rose", shock: "收费期限、费率或免费政策调整", transmission: "可收费现金流缩短 → DCF 价值直接下降", signals: ["政策征求意见变化", "免费天数扩大", "补偿机制不清晰"], action: "将收费权按有限期限重估，触发政策风险上限。" },
    ],
    stocks: [
      { code: "600377", name: "宁沪高速", role: "核心路产", moat: "长三角优质区位", watch: "扩张与收费期限", defenseScore: 91, incomeScore: 90, qualityScore: 92 },
      { code: "600350", name: "山东高速", role: "高息路网", moat: "区域干线网络", watch: "关联投资与杠杆", defenseScore: 86, incomeScore: 91, qualityScore: 84 },
      { code: "001965", name: "招商公路", role: "分散路产", moat: "全国化权益路网", watch: "投资收益透明度", defenseScore: 87, incomeScore: 85, qualityScore: 87 },
      { code: "600012", name: "皖通高速", role: "稳健股息", moat: "安徽主干路产", watch: "项目期限与成长", defenseScore: 84, incomeScore: 89, qualityScore: 84 },
      { code: "600548", name: "深高速", role: "湾区资产", moat: "区位与综合运营", watch: "环保业务与负债", defenseScore: 82, incomeScore: 83, qualityScore: 82 },
    ],
  },
  {
    id: "nuclear",
    label: "核电",
    shortLabel: "核电",
    english: "NUCLEAR POWER",
    icon: "◎",
    resilience: "较强",
    dividend: "中等",
    stability: "较强",
    primaryRisk: "高负债、资本开支",
    summary: "高利用小时和长资产寿命带来稳定收入，但在建机组、融资成本与核安全约束决定股东回报兑现速度。",
    portfolioRole: "基荷电源成长防御；平衡纯高股息资产的增长不足。",
    valuationAnchor: "分部 DCF + 在运/在建机组价值 + 净债务",
    defensiveScore: 88,
    riskBudget: 13,
    hedgeChannel: "基荷电力需求",
    vulnerabilities: ["capex", "safety", "rates"],
    nav: { overview: "核电运营总览", ranking: "核电运营商筛选", details: "机组与债务全景", scenarios: "股价情景推演", methods: "指标与模型说明" },
    metrics: [
      { label: "在运机组利用小时", shortLabel: "利用小时", target: "高位稳定", rationale: "基荷属性能否兑现，首先反映在利用率。", weight: 25, direction: "stable" },
      { label: "在建资本开支峰值", shortLabel: "资本开支", target: "资金覆盖清晰", rationale: "成长会吞噬短期现金流，需要区分在运现金牛与在建投入。", weight: 28, direction: "lower" },
      { label: "净债务 / EBITDA", shortLabel: "杠杆", target: "不过度抬升", rationale: "利率变化会通过庞大债务放大股东回报波动。", weight: 24, direction: "lower" },
      { label: "核准与投产兑现率", shortLabel: "项目兑现", target: "按计划投产", rationale: "延期会同时影响收入、折旧和融资成本。", weight: 23, direction: "higher" },
    ],
    scenarios: [
      { name: "投产兑现", tone: "mint", shock: "新机组按期商运且利用率高", transmission: "装机增长 → EBITDA 扩张 → 杠杆逐步消化", signals: ["商运节点按计划", "利用小时稳定", "融资成本下降"], action: "提高在运贡献清晰、投产节奏可见的标的。" },
      { name: "基准运营", tone: "lavender", shock: "存量机组稳定、新建按计划推进", transmission: "在运现金流覆盖在建投入，分红温和增长", signals: ["大修影响正常", "电价机制稳定", "资本开支未超预算"], action: "在股息与成长之间保持中性权重。" },
      { name: "延期与高利率", tone: "peach", shock: "项目延期且融资成本上升", transmission: "利息资本化增加 → 自由现金流推迟 → 估值受压", signals: ["工程节点延后", "净债务快速上升", "分红覆盖下降"], action: "限制高在建占比与高杠杆公司的仓位。" },
      { name: "安全事件", tone: "rose", shock: "行业发生重大安全或监管事件", transmission: "停机检查 + 核准延迟 → 全行业风险溢价上升", signals: ["非计划停机", "监管审查升级", "新项目核准暂停"], action: "执行行业级止损，不用单一公司分散替代行业分散。" },
    ],
    stocks: [
      { code: "601985", name: "中国核电", role: "核电成长", moat: "在运规模与项目储备", watch: "资本开支和杠杆", defenseScore: 89, incomeScore: 77, qualityScore: 90 },
      { code: "003816", name: "中国广核", role: "成熟运营", moat: "机组运营与湾区负荷", watch: "利用小时与项目节奏", defenseScore: 91, incomeScore: 84, qualityScore: 91 },
    ],
  },
  {
    id: "oilgas",
    label: "综合油气",
    shortLabel: "油气",
    english: "INTEGRATED OIL & GAS",
    icon: "◆",
    resilience: "中等",
    dividend: "中高",
    stability: "中等",
    primaryRisk: "油价周期",
    summary: "上游资源可以对冲通胀与地缘冲突，下游炼化又能部分平滑油价，组合价值来自周期互补而非永久高油价。",
    portfolioRole: "通胀和地缘风险对冲；与水电、电信的稳定现金流配对。",
    valuationAnchor: "中周期油价 NAV + EV/EBITDA + 股息压力测试",
    defensiveScore: 72,
    riskBudget: 10,
    hedgeChannel: "能源通胀",
    vulnerabilities: ["commodity", "policy", "capex"],
    nav: { overview: "油气周期总览", ranking: "油气龙头筛选", details: "上游与炼化全景", scenarios: "股价情景推演", methods: "指标与模型说明" },
    metrics: [
      { label: "中周期油价自由现金流", shortLabel: "中周期现金流", target: "覆盖股息与资本开支", rationale: "不要用景气高点现金流外推永续价值。", weight: 30, direction: "higher" },
      { label: "桶油完全成本", shortLabel: "成本曲线", target: "位于行业低分位", rationale: "低成本资源在油价下跌时拥有更厚安全垫。", weight: 26, direction: "lower" },
      { label: "储量替代率", shortLabel: "资源续航", target: "> 100%", rationale: "分红不能以资源基础持续萎缩为代价。", weight: 20, direction: "higher" },
      { label: "炼化与销售对冲", shortLabel: "业务平衡", target: "周期互补", rationale: "综合化结构可降低单一油价暴露，但也要防低效资本。", weight: 24, direction: "stable" },
    ],
    scenarios: [
      { name: "供给冲击", tone: "mint", shock: "地缘扰动推升油气价格", transmission: "上游利润扩张 → 自由现金流与特别分红增加", signals: ["库存低位", "资本纪律稳定", "桶油成本未上升"], action: "作为对冲获利，不把短期高油价当作长期基准。" },
      { name: "中周期平衡", tone: "lavender", shock: "油价处于完全成本上方", transmission: "上游现金流稳定，下游贡献平滑波动", signals: ["储量替代充分", "资本开支有纪律", "基础分红可覆盖"], action: "以中周期现金流收益率决定仓位。" },
      { name: "需求衰退", tone: "peach", shock: "全球需求下降导致油价下行", transmission: "上游利润收缩 → 炼化可能部分缓冲", signals: ["库存累积", "裂解价差收窄", "自由现金流跌破分红需求"], action: "优先低成本、低杠杆与综合化标的。" },
      { name: "能源转型重估", tone: "rose", shock: "碳政策与需求峰值预期提前", transmission: "长期价格假设下修 → 储量资产折价", signals: ["碳成本上升", "高成本项目继续扩张", "资产减值增加"], action: "缩短估值久期，严控高成本资源敞口。" },
    ],
    stocks: [
      { code: "600938", name: "中国海油", role: "低成本上游", moat: "海上资源与成本优势", watch: "油价与资本开支", defenseScore: 79, incomeScore: 89, qualityScore: 90 },
      { code: "601857", name: "中国石油", role: "综合能源", moat: "资源、管网客户与一体化", watch: "资本效率与政策", defenseScore: 76, incomeScore: 88, qualityScore: 84 },
      { code: "600028", name: "中国石化", role: "炼化平衡", moat: "炼化销售网络", watch: "炼化价差", defenseScore: 73, incomeScore: 86, qualityScore: 80 },
    ],
  },
  {
    id: "resources",
    label: "煤炭金属资源",
    shortLabel: "资源",
    english: "COAL & METALS",
    icon: "⬡",
    resilience: "中等",
    dividend: "高但波动",
    stability: "较弱",
    primaryRisk: "商品价格、政策",
    summary: "资源股能对冲通胀与供给冲击，但股息高度依赖商品周期；策略必须使用中周期价格与资本纪律过滤。",
    portfolioRole: "通胀和供给黑天鹅对冲；仓位上限低于稳定现金流行业。",
    valuationAnchor: "中周期商品价 NAV + 现金成本曲线 + 净现金分红",
    defensiveScore: 64,
    riskBudget: 8,
    hedgeChannel: "商品供给冲击",
    vulnerabilities: ["commodity", "policy", "capex"],
    nav: { overview: "资源周期总览", ranking: "资源龙头筛选", details: "周期与现金全景", scenarios: "股价情景推演", methods: "指标与模型说明" },
    metrics: [
      { label: "现金成本分位", shortLabel: "成本曲线", target: "行业前 30%", rationale: "商品价格不可控，成本位置决定下行生存能力。", weight: 30, direction: "lower" },
      { label: "中周期自由现金流", shortLabel: "穿越周期", target: "> 0 且覆盖基础分红", rationale: "用五至十年中枢价格，避免高点利润制造假低估。", weight: 28, direction: "higher" },
      { label: "净现金 / 净负债", shortLabel: "资产负债表", target: "净现金优先", rationale: "周期底部时资产负债表比当期股息更重要。", weight: 24, direction: "higher" },
      { label: "扩产资本纪律", shortLabel: "资本纪律", target: "逆周期克制", rationale: "景气顶点大扩产往往破坏下一周期回报。", weight: 18, direction: "lower" },
    ],
    scenarios: [
      { name: "供给受限", tone: "mint", shock: "供给扰动、库存低位", transmission: "商品价格上升 → 经营杠杆释放 → 分红弹性增大", signals: ["库存持续下降", "供给增量受限", "公司不追涨扩产"], action: "将超额现金视为周期收益，分批兑现。" },
      { name: "中枢盈利", tone: "lavender", shock: "商品价格回到中周期均衡", transmission: "低成本龙头保持正现金流，高成本产能出清", signals: ["成本优势稳定", "资产负债表健康", "基础分红可覆盖"], action: "只保留成本曲线前端与净现金公司。" },
      { name: "需求下行", tone: "peach", shock: "地产、制造业或全球需求收缩", transmission: "价格下跌 → 利润与股息快速回落", signals: ["库存累积", "现货升水消失", "单位成本上升"], action: "降低行业权重，不用历史高股息率抄底。" },
      { name: "政策与事故", tone: "rose", shock: "安全、环保、出口或价格政策突变", transmission: "停产或限价 → 量价同时不确定", signals: ["监管措施升级", "重大安全事件", "资本开支被迫增加"], action: "执行行业风险预算，并分散煤、油、铜、金等风险源。" },
    ],
    stocks: [
      { code: "601088", name: "中国神华", role: "一体化现金牛", moat: "煤电运一体化与低成本", watch: "煤价与资本配置", defenseScore: 82, incomeScore: 95, qualityScore: 92 },
      { code: "601225", name: "陕西煤业", role: "低成本煤炭", moat: "资源禀赋与成本", watch: "煤价和投资收益", defenseScore: 74, incomeScore: 91, qualityScore: 86 },
      { code: "600188", name: "兖矿能源", role: "高弹性煤炭", moat: "海内外资源", watch: "高杠杆扩张", defenseScore: 65, incomeScore: 87, qualityScore: 76 },
      { code: "601899", name: "紫金矿业", role: "铜金成长", moat: "全球资源运营能力", watch: "项目执行与金属价格", defenseScore: 68, incomeScore: 66, qualityScore: 88 },
      { code: "600547", name: "山东黄金", role: "黄金对冲", moat: "黄金资源与产能", watch: "金价和成本", defenseScore: 70, incomeScore: 58, qualityScore: 78 },
      { code: "603993", name: "洛阳钼业", role: "多金属弹性", moat: "铜钴资源与运营", watch: "地缘与价格波动", defenseScore: 61, incomeScore: 62, qualityScore: 82 },
    ],
  },
  {
    id: "consumer",
    label: "消费龙头",
    shortLabel: "消费",
    english: "CONSUMER LEADERS",
    icon: "◍",
    resilience: "较强",
    dividend: "通常偏低",
    stability: "较强",
    primaryRisk: "品牌、需求与估值",
    summary: "真正的消费防御来自品牌定价权、渠道现金流和复购，而不是行业标签；估值过高会抵消业务稳定性。",
    portfolioRole: "长期复利与需求修复暴露；补足纯高股息组合的增长。",
    valuationAnchor: "FCF 收益率 + 品牌 ROIC + 合理增长 PEG",
    defensiveScore: 82,
    riskBudget: 15,
    hedgeChannel: "品牌定价权",
    vulnerabilities: ["demand", "valuation", "channel"],
    nav: { overview: "消费资产总览", ranking: "优质公司筛选", details: "数据全景", scenarios: "股价情景推演", methods: "指标与模型说明" },
    metrics: [
      { label: "经营现金流 / 净利润", shortLabel: "现金含量", target: "> 1 倍", rationale: "渠道压货能制造利润，现金回款更难伪装。", weight: 27, direction: "higher" },
      { label: "ROIC 与增量回报", shortLabel: "资本回报", target: "> 资本成本 + 8%", rationale: "高质量增长需要新增投入仍能获得高回报。", weight: 26, direction: "higher" },
      { label: "价量与渠道库存", shortLabel: "品牌动销", target: "量稳、库存健康", rationale: "提价若牺牲销量和渠道健康，定价权可能是假象。", weight: 27, direction: "stable" },
      { label: "自由现金流收益率", shortLabel: "估值安全", target: "> 历史中位", rationale: "好公司也需要买入价格，避免长久期估值压缩。", weight: 20, direction: "higher" },
    ],
    scenarios: [
      { name: "需求复苏", tone: "mint", shock: "量价改善且渠道库存健康", transmission: "收入恢复 → 利润率扩张 → 估值与盈利共振", signals: ["终端动销快于出货", "现金回款改善", "营销效率提升"], action: "优先现金流确认的增长，不追渠道补库造成的脉冲。" },
      { name: "稳定复购", tone: "lavender", shock: "需求平稳、品牌份额稳定", transmission: "ROIC 与现金流复利成为主要回报", signals: ["核心品类份额稳定", "库存周转正常", "自由现金流匹配利润"], action: "按 FCF 收益率和增长质量再平衡。" },
      { name: "消费降级", tone: "peach", shock: "需求走弱、价格带下移", transmission: "量价承压 → 费用刚性 → 利润降幅放大", signals: ["渠道库存上升", "折扣率扩大", "应收与返利增加"], action: "降低高估值与弱现金流标的，保留强复购龙头。" },
      { name: "品牌事件", tone: "rose", shock: "食品安全、产品质量或品牌信任受损", transmission: "复购下降 → 渠道退货 → 长期品牌资产减值", signals: ["舆情与退货率异常", "经销商库存激增", "公司治理信号恶化"], action: "品牌风险按单公司止损，不用估值便宜替代信任修复。" },
    ],
    stocks: [
      { code: "600519", name: "贵州茅台", role: "品牌现金流", moat: "品牌、稀缺性与渠道", watch: "批价与估值", defenseScore: 90, incomeScore: 73, qualityScore: 98 },
      { code: "000858", name: "五粮液", role: "高端白酒", moat: "品牌与浓香产能", watch: "渠道库存和批价", defenseScore: 84, incomeScore: 72, qualityScore: 91 },
      { code: "600887", name: "伊利股份", role: "大众必选", moat: "渠道、供应链与规模", watch: "原奶周期和需求", defenseScore: 87, incomeScore: 82, qualityScore: 89 },
      { code: "603288", name: "海天味业", role: "调味品龙头", moat: "品牌与渠道密度", watch: "需求修复与估值", defenseScore: 84, incomeScore: 62, qualityScore: 90 },
      { code: "000333", name: "美的集团", role: "全球家电", moat: "供应链、品牌与效率", watch: "海外需求与地产链", defenseScore: 83, incomeScore: 78, qualityScore: 93 },
      { code: "600690", name: "海尔智家", role: "高端家电", moat: "全球品牌与场景渠道", watch: "海外利润率", defenseScore: 80, incomeScore: 72, qualityScore: 90 },
      { code: "000568", name: "泸州老窖", role: "高端白酒", moat: "窖池资源、品牌与渠道", watch: "批价和渠道库存", defenseScore: 82, incomeScore: 75, qualityScore: 92 },
      { code: "600600", name: "青岛啤酒", role: "大众升级", moat: "品牌、基地市场与产品结构", watch: "销量与高端化兑现", defenseScore: 85, incomeScore: 73, qualityScore: 90 },
      { code: "603195", name: "公牛集团", role: "耐用消费品牌", moat: "品牌、线下网点与产品延伸", watch: "地产后周期与估值", defenseScore: 86, incomeScore: 65, qualityScore: 94 },
      { code: "002032", name: "苏泊尔", role: "小家电现金流", moat: "品牌、渠道与全球协同", watch: "内需和关联销售", defenseScore: 84, incomeScore: 85, qualityScore: 91 },
    ],
  },
];

export const INDUSTRY_MAP = Object.fromEntries(
  INDUSTRIES.map((industry) => [industry.id, industry]),
) as Record<IndustryId, IndustryConfig>;

export const ALL_INDUSTRY_IDS = INDUSTRIES.map((industry) => industry.id);

export const normalizeStockCode = (value: string) => value.match(/\d{6}/)?.[0] ?? value;

export const stockOptionsForIndustry = (industry: IndustryConfig) =>
  industry.stocks.map(({ code, name }) => [code, name] as const);

export const findIndustryStock = (industry: IndustryConfig, stockCode: string) => {
  const normalized = normalizeStockCode(stockCode);
  return industry.stocks.find((stock) => stock.code === normalized) ?? industry.stocks[0];
};
