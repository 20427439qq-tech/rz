# 判断系统 APP 壳子

移动端前端项目，基于“总览”里的产品逻辑搭建：观点输入、理解训练、企业扫描、三个池、未来匹配和评分。

这次已经从“每日训练工具”升级为“长期认知系统”的雏形：

- 观点和问题自动匹配
- 观点理解评分
- 企业落地评分
- 本周复盘
- 未来触发提醒

## 技术栈

- Vue 3
- Vite
- TypeScript
- Vue Router
- Pinia
- @lucide/vue

## AI 配置

训练页已接入本地 AI 配置模块。开发服务会优先读取 `app/ai-config.json`；如果不存在，则复用 `C:\Users\20427\Documents\000\xuexi\config.json` 的多模型配置。新保存的配置会写入 `app/ai-config.json`，API Key 按 xuexi 同款 AES-GCM 方式加密。

AI 只负责生成训练草稿，仍然必须遵守产品脚手架：

`观点输入 -> 观点理解 -> 旧模型觉察 -> 企业场景扫描 -> 分流结果`

## 本地运行

```bash
npm run dev
```

## 页面

- `/` 首页
- `/training` 今日训练
- `/pools` 三个池
- `/match` 匹配
- `/score` 复盘
