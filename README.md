# 银栖 · A股银行估值前端

React + TypeScript + Vite 的 PC 端银行估值看板。以柔和马卡龙配色、轻量动态粒子和原生 SVG 图表呈现后端的单股估值结果。

## 启动

```powershell
.\install.cmd
.\dev.cmd
```

默认打开 `http://127.0.0.1:5173`。开发服务器将 `/api` 自动转发到 `http://127.0.0.1:8000`，因此请先启动后端：

```powershell
uvicorn bank_valuation.app.main:app --reload
```

若前后端分别部署，在前端环境变量中设置：

```powershell
$env:VITE_API_BASE_URL = "https://your-api.example.com"
.\dev.cmd
```

## 使用方式

首页只需填写六位银行代码（如 `601398`）和可选估值日期。界面会并发请求：

- `POST /api/bank/valuation`
- `POST /api/bank/monte-carlo`

并展示当前价格、PB 历史分位、PB-ROE/股息率/剩余收益模型、四情景价格带、风险标签与蒙特卡洛分位结果。

“数据全景”页进一步呈现全历史 PB / PE（如后端提供）/收盘价采样轨迹、3/5/10 年 PB 分位、估值使用的财务与风险输入、权益成本假设，以及 3/5/10 年剩余收益模型结果。

该页还会在主估值完成后后台加载 A 股银行横向基准：PB、PE、年化 ROE 和净利润同比的行业均值、中位数、P25–P75 区间及本行所在百分位。首次按估值日期汇总可能耗时较长，完成后后端按日期写入 CSV，并在 24 小时内优先读取。

页面含“概览”“情景推演”“模型说明”三个视图。所有内容为估值分析和风险提示，不构成投资建议。
