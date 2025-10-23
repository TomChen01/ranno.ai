---
title: Project Overview
author: Hongyi Chen
date: 2025/10/22
---

# 48小时时间表

## 第一天 (0 - 24 小时): 攻克核心通路与安全特性

### [0-3H] 准备 (Setup)
* 创建 GitHub 仓库，连接 Vercel/Firebase。
* 完成所有 API 密钥注册: Google Maps Platform, data.sfgov.org (Socrata Open Data)。
* 确保 Chrome Built-in AI (Early Preview) 可用。

### [3-8H] 前端基础 (Map Load)
* Vite + React 启动项目。
* 成功加载 Google Map (Demo 地点设为旧金山)。
* 搭建好基本的输入框 UI。

### [8-16H] AI 核心 - 攻坚
* **[挑战 A]** 全力进行 Prompt Engineering。
* 目标：能稳定解析 V2 JSON (包含 safety 字段)。

### [16-24H] 安全核心 - 攻坚
* **[挑战 B - MVP]** 成功获取旧金山犯罪数据，并在地图上渲染 HeatmapLayer。
* 打通 Tier 1 (MVP) 路线生成。
* 实现 "Generate-and-Test" 的“警告”功能。

**DAY 1 结束目标:** 拥有一个可演示的核心产品：输入安全需求 -> 地图显示热力图 -> 生成路线 -> 弹出安全警告。

---

## 第二天 (24 - 48 小时): 丰富功能与打磨提交

### [24-32H] 功能冲刺 (Feature)
* 实现 Tier 2 的剩余功能 (**incline 坡度检查**)。
* 实现 Tier 3 的 **Multimodal (图片输入)** 功能。

### [32-38H] 润色与缓冲 (Polish)
* 打磨 UI/UX，添加“隐私保护”标识。
* (若有余力) 尝试实现 [挑战 B] 的**“自动重规划”**。
* 修复 Bug。

### [38-44H] 关键交付物 (Delivery)
* **录制 3 分钟演示视频 (英文): 这是重中之重。**
    * 脚本: 0:00-0:30 (痛点) -> 0:30-1:00 (方案) -> 1:00-2:00 (核心演示) -> 2:00-2:30 (亮点) -> 2:30-3:00 (总结)。
* 撰写文档 (英文): `README.md` 和 Devpost 提交描述。

### [44-48H] 提交 (Submission)
* 上传视频到 YouTube/Vimeo (设为公开)。
* 在 Devpost 提交所有材料。
* 交叉检查所有链接 (GitHub, Demo URL, 视频 URL) 是否公开且有效。
* 点击“提交”。