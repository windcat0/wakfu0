# Wakfu 攻略站 · 万象之扉 — 功能文档

> 版本：基于源码逐文件核实（2026-07 修订）
> 源码地址：静态站点，部署于 GitHub Pages / Cloudflare Pages
> 站点：https://windcat0.github.io · https://wakfu0.pages.dev

---

## 目录

1. [项目概述](#1-项目概述)
2. [技术栈](#2-技术栈)
3. [项目结构](#3-项目结构)
4. [功能模块详解](#4-功能模块详解)
5. [核心功能：战斗日志分析](#5-核心功能战斗日志分析-analysishtml-)
6. [副本攻略](#6-副本攻略-dungeonhtml)
7. [职业攻略](#7-职业攻略-classhtml)
8. [其余内容页面](#8-其余内容页面)
9. [主题系统](#9-主题系统)
10. [全局样式与共享组件](#10-全局样式与共享组件)
11. [数据结构参考](#11-数据结构参考)
12. [已知问题与待优化项](#12-已知问题与待优化项)
13. [部署与运行](#13-部署与运行)

---

## 1. 项目概述

### 1.1 项目简介
Wakfu 攻略站（万象之扉）是一个面向 **Wakfu（沃土）** MMORPG 玩家的**非官方中文资料站**。纯前端静态站点，无后端服务，主要提供：

- **战斗日志分析工具**（核心功能，本地解析 wakfu.log）
- 副本攻略、职业指南、任务/生活/图鉴/装备等游戏资料
- 多套主题切换（暗夜 + 春夏秋冬）

### 1.2 页面导航结构
```
首页 index.html
├── 新手入门 beginner.html
├── 战斗日志分析 analysis.html  ⭐ 核心功能
├── 副本攻略 dungeon.html
├── 职业攻略 class.html
│   └── 职业详情 #/classes/{slug}（hash 路由）
├── 任务攻略 quest.html
├── 生活攻略 crafting.html
├── 图鉴与收藏 collection.html
└── 装备搭配 equipment.html
```

### 1.3 全局布局
所有内容页面共享一致的视觉骨架（由 `theme.css` 提供）：

| 区域 | 说明 |
|------|------|
| `.bg-glow` / `.bg-glow.bottom` | 两个固定的模糊径向渐变光斑（左上蓝、右下粉），纯装饰 |
| `.navbar` | sticky 顶部导航，毛玻璃 `backdrop-filter: blur(20px)`，含 Logo + 5 个导航链接 |
| `.hero` | 页面标题区，楷体渐变文字 + 装饰横线 |
| `.main-content` / `.container` | 主体内容容器，max-width 1300px |
| `.footer` | 统一页脚 `© 2026 Wakfu Guide · 万象之扉 — 为冒险者而生` |
| `.theme-switcher` | 左下角浮动主题切换器（由 `theme.js` 动态创建） |

**全局导航链接**（5 项）：首页、新手入门、战斗分析、副本攻略、职业攻略。注意：任务/生活/图鉴/装备页**不在导航栏**，仅通过首页卡片进入。

---

## 2. 技术栈

| 分类 | 技术 / 库 | 版本 | 用途 | 加载方式 |
|------|-----------|------|------|----------|
| 前端框架 | 原生 HTML/CSS/JS（ES6+） | — | 全站基础 | 本地 |
| 图表库 | Chart.js | 4.4.0 (UMD) | 玩家详情图表（技能/目标伤害柱状图） | jsDelivr CDN |
| 图表库 | ECharts | 5.4.3 | 排行榜横向柱状图、堆叠汇总图 | jsDelivr CDN |
| UI 框架 | Bootstrap | 5.3.0 (bundle, 含 Popper) | Tooltip、栅格、基础样式 | jsDelivr CDN |
| 部署 | GitHub Pages / Cloudflare Pages | — | 静态托管 | — |

> ⚠️ Bootstrap 仅用于 `analysis.html` 的 tooltip 与少量基础类；可见 UI 全部由自定义 CSS 实现，并通过 `analysis_fix.css` 将 Bootstrap 组件重新着色为暗色玻璃风格。
> ⚠️ CDN 资源均**未设置 SRI 完整性校验**（`integrity`/`crossorigin`）。

---

## 3. 项目结构

```
wakfu/
├── index.html              # 首页（4×2 卡片导航）
├── beginner.html           # 新手入门
├── analysis.html           # 战斗日志分析（核心，~118KB / 2914 行）
├── analysis_fix.css        # 分析页 Bootstrap 样式覆盖层
├── dungeon.html            # 副本攻略（8 等级档 / 42 副本）
├── class.html              # 职业攻略（15 职业 + hash 路由 SPA）
├── quest.html              # 任务攻略
├── crafting.html           # 生活攻略（11 技能）
├── collection.html         # 图鉴与收藏（12 卡片）
├── equipment.html          # 装备搭配（外部工具导航）
├── theme.css               # 全局样式 + 5 套主题变量（577 行）
├── theme.js                # 主题切换逻辑（动态注入切换器）
├── logo.webp               # 站点 Logo
├── favicon.ico             # 站点图标
├── asset/
│   └── breed/              # 职业图标 0.png ~ 19.png（analysis.html 使用）
├── data/                   # 示例日志 / 截图 HTML / PDF
├── logs/, wakfu.log*       # 运行日志（调试用）
├── README.md / README.en.md
├── LICENSE
└── 副本攻略.txt             # 副本攻略原始文本
```

---

## 4. 功能模块详解

### 4.1 首页 (index.html)

**定位**：站点入口，8 个功能卡片导航。

**特性**：
- 4×2 响应式卡片网格（≤900px 变 2 列，≤500px 变 1 列）
- 卡片悬停：`translateY(-12px) scale(1.02)` 上浮 + 边框高亮 + 光泽扫过动画（`.card::before` 斜向渐变 0.7s 滑动）
- 图标采用内联 SVG + emoji（不依赖图片资源）
- 左下角主题切换器（页面内联脚本，非引用 theme.js）

**8 张功能卡片**：

| 卡片 | 目标 | 图标风格 | 副标题 |
|------|------|----------|--------|
| 新手入门 | beginner.html | SVG 指南针 | 阵营、界面与操作指南 |
| 战斗日志分析 | analysis.html | ⚔️ emoji | 伤害拆解与行动轴优化 |
| 副本攻略 | dungeon.html | SVG 怪物脸 | 全地下城机制与站位 |
| 任务攻略 | quest.html | SVG 文档 | 主线支线及隐藏成就 |
| 职业攻略 | class.html | SVG 弓 | 18职业构筑与强度解析 |
| 生活攻略 | crafting.html | 🌱 emoji | 14种专业技能与配方大全 |
| 图鉴与收藏 | collection.html | SVG 背包 | 宠物坐骑时装全收录 |
| 装备数据库 | equipment.html | SVG 盾 | 全装备筛选与配装模拟 |

> 注：卡片副标题中的"18职业""14种"为宣传文案，与实际页面数据不完全一致（详见对应章节）。

---

### 4.2 新手入门 (beginner.html)

**定位**：新玩家快速上手资源汇总。**纯静态 HTML**，无外部 JS 库，仅引用 `theme.css` + `theme.js`。

**内容模块**：

| 模块 | 内容 |
|------|------|
| 官网入口 | https://www.wakfu.com/（新窗口打开） |
| 社区交流 | **QQ 群：663439038**；微信公众号「**Wakfu 真好玩**」 |
| 游戏汉化 | 从 QQ 群空间下载汉化器 |
| 服务器选择 | **单人服**：只控 1 个角色、需组队、账号须绑手机；**多人服**：可双开 6 个角色、适合单人玩家 |
| 日志配置 | 修改 `log4j.properties`，将 `log4j.appender.mainLog.MaxFileSize=1MB` 改为 **`=5MB`** |

**日志路径提示**：默认 `%APPDATA%\zaap\gamesLogs\wakfu\logs`（在 analysis 页有复制按钮）。

---

## 5. 核心功能：战斗日志分析 (analysis.html)

> 单页应用，~118KB / 2914 行，标题「**汪汪队出击 - Wakfu Combat Logs Analysis**」。这是整个站点最有技术含量的功能。

### 5.1 总览

| 项 | 说明 |
|----|------|
| 输入 | Wakfu 客户端生成的战斗日志（`.log` / `.log.1` / `.log.2` / `.log.3` / `.txt`） |
| 处理 | 纯前端 JS 解析，支持**多文件上传**，自动按轮转后缀排序保证时间顺序 |
| 输出 | 6 个分析标签页 + ECharts/Chart.js 可视化 |
| 容量 | 最多保留最近 **10 场**战斗（`MAX_COMBATS = 10`） |
| 隐私 | 全部本地解析，不上传服务器 |

### 5.2 外部依赖（精确 CDN）
```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"></script>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
<link rel="stylesheet" href="theme.css">
<link rel="stylesheet" href="analysis_fix.css">
<script src="theme.js"></script>
```

### 5.3 页面布局
- **左侧栏**：文件上传区（`#fileInput`，`multiple`）+ 日志路径复制提示 + 战斗列表
- **右侧主区**：6 个标签页（`.tab`），默认显示「总览」
- 战斗列表条目带渐入动画（每项错开 100ms），新条目有 `highlight-fade` 高亮

### 5.4 上传与解析流程
```
用户选择文件
  → change 事件自动启用并触发"分析"按钮
  → 过滤合法扩展名 (.log / .log.1~3 / .txt)
  → 按文件名轮转后缀降序排序（.log.3 先读，保证时间顺序）
  → FileReader 以 UTF-8 逐个读取
  → 内容以 \n 拼接 → parseCombatData(fullText)
  → 提取多场战斗 → filterRecentCombats(保留最新 10 场)
  → 渲染战斗列表
```

**接受扩展名**：`.log`、`.log.1`、`.log.2`、`.log.3`、`.txt`（无 `accept` 属性，纯 JS 校验）。

### 5.5 日志解析逻辑（`parseCombatData`）

入口函数 `parseCombatData(fullText)`（第 1381 行），采用**基于 `isCreating` 状态机**的逐行扫描。

**战斗生命周期标记**：
```js
line.includes('CREATION DU COMBAT')   // 战斗开始
line.includes('[_FL_]')               // 战斗者花名册行
line.includes('End fight with id')    // 战斗结束
```

**关键正则**：

| 用途 | 正则 |
|------|------|
| 战斗者花名册 | `/fightId=([0-9]+) ([^:]+) breed : ([0-9]+) .+ isControlledByAI=(true\|false) .+ join the fight at \{Point3 : \(([^,]+), ([^,]+), ([^,]+)\)\}/` |
| 战斗结束 | `/End fight with id ([0-9]+)/` |
| 战斗日志行 | `/.*\[战斗日志\]\s+(.+)/` |
| 施法动作 | `/(.+)(casts\|施放)(.+)/` |
| 行为冒号分隔 | `/([^:]+):(.+)/` |
| 伤害/治疗数值 | `/(-?[0-9,]+).*(HP\|生命\|Armor\|护甲\|護甲)/` |
| 括号修饰词 | `/[（(]([^()（）]+)[）)]/`（提取如 `(火系)`、`(Critical)`） |
| 召唤者剥离 | `caster.match(/\(([^)]+)\)$/)`（提取 `(Owner)`） |

**符号约定（重要）**：
- 伤害存为**负数**，治疗/护盾存为**正数**
- 显示时伤害取反 `-dmg` 转为正值

**多语言关键词**（en / zh-CN / zh-TW 三档，部分档位存在重复，见 [§12](#12-已知问题与待优化项)）：
```js
castLangs    = ['casts', '施放', '施放']            // zh-TW 档疑似重复
hpLangs      = ['HP', '生命', '生命']
armorLangs   = ['Armor', '护甲', '護甲']            // 正确区分简繁
// ... 多套关键词映射
```

**属性归因优先级**（施法者/目标/元素/暴击）：
1. **施法者**：取自施法行 `A casts B` 或冒号前缀 `A: ...`；召唤物通过 `getSummoner()` 剥离尾部 `(Owner)`
2. **暴击**：行为文本含 `暴击` / `Critical` / `critical`，识别后从文本中剔除
3. **元素**：优先级——括号修饰词中的元素 > 行为串中的元素 > 施法时记录的 `recentSpellElement`
4. **格挡**：修饰词含 `Block` / `格挡`

**间接伤害来源归因**（按修饰词类别）：
| 类别 | 关键词 | 归属 |
|------|--------|------|
| 直伤附加 | 箭塔/脉冲星/回旋镖等 | `recentCaster` |
| 自我附加 | 盾墙等 | 当前 `caster` |
| 燃烧 DoT | `燃烧` | `[Burning]`（由下一施法回填） |
| 反击 | `Counterattack`/`反击` | `recentDest` |
| 无视 | `气功`/`Vital Energy` | `[Ignored]` |
| 命名技能 | 已施放的命名法术 | 查 `recentNamedEffectApply[mod]` |

### 5.6 数据结构

**全局状态**（第 1082–1088 行）：
```js
let combatDataDict = {};      // combatId -> CombatData
let currentCombatId = null;
let selectedPlayer = null;
let charts = {};              // canvasId -> Chart/ECharts 实例
const MAX_COMBATS = 10;
```

**`class CombatData`**（第 1202 行）核心字段：
```js
players = [];            playersPos = [];          // 玩家及出生坐标
playersSummon = [];      playersSummonPos = [];    // 玩家召唤物
playersBreed = {};       // 玩家名 -> 职业ID
mobs = [];               mobsPos = [];             // NPC 及坐标
mobsSummon = [];         mobsSummonPos = [];
combatId = 'Unknown';
lineNumber = 0;          // 用于按时间排序
data = [];               // 战斗记录条目数组
```

**记录条目**（`addEntry`）：
```js
{ caster, target, damage, element, crit, block, desc, extra }
```

**核心方法**：
| 方法 | 作用 |
|------|------|
| `addEntry(...)` | 追加一条伤害/治疗记录 |
| `isTeamMember(name, isPlayer)` | 是否本方成员（⚠️ `'Unknown'` 恒返回 `true`） |
| `getSummoner(caster)` | 从 `名字(所有者)` 中剥离出所有者 |
| `getStats()` | 聚合统计：玩家伤害/承伤/治疗/吸血、NPC 伤害/承伤/治疗、元素分布 |
| `getPlayerDetail(name)` | 单玩家详情：伤害、承伤、治疗、吸血、元素分布、技能分布、目标分布 |
| `getHighestHealthNPC()` | ⚠️ 名不副实：返回**承伤最多**的 NPC（日志无真实血量） |

**吸血 vs 治疗判定**：自我施放的治疗，**职业 7（Eniripsa）算作治疗**，其余职业算作吸血。

### 5.7 职业识别（`breedNames`，共 19 项，ID 1–19）

| ID | 名称 | ID | 名称 |
|----|------|----|------|
| 1 | 守护 (Feca) | 11 | 狂战 (Sacrier) |
| 2 | 召唤 (Osamodas) | 12 | 熊猫 (Pandawa) |
| 3 | 宝藏 (Enutrof) | 13 | 盗贼 (Rogue) |
| 4 | 刺客 (Sram) | 14 | 萨满 (Masqueraiders) |
| 5 | 时法 (Xelor) | 15 | 狗子 (Ouginak) |
| 6 | 幸运猫 (Ecaflip) | 16 | 蒸汽 (Foggernaut) |
| 7 | 治疗 (Eniripsa) | 17 | 雨果 (Eliotrope) |
| 8 | 夸夸 (Iop) | **18** | **雨果 (Eliotrope)** ⚠️ 与 17 重复 |
| 9 | 弓箭 (Cra) | 19 | 光法 (Huppermage) |
| 10 | 植物 (Sadida) | | |

> ⚠️ **已知 Bug**：ID 18 与 17 都是 Eliotrope，应为 Huppermage。游戏真实 breed ID 是 17=Eliotrope、18=Huppermage。后果：**breed 18 的 Huppermage 会被误标为 Eliotrope**。详见 [§12](#12-已知问题与待优化项)。

**职业图标**：
```js
function getBreedIconPath(breedId) {           // 第 1138 行
    return isValidBreedId(breedId) ? `asset/breed/${breedId}.png` : 'asset/breed/0.png';
}
```
`asset/breed/0.png ~ 19.png` 共 20 张图。`preloadBreedIcon` 预加载并缓存到 `iconCache`，失败回退 `0.png` 再回退 `null`。ECharts 通过富文本 `backgroundColor.image` 在 Y 轴标签旁渲染职业头像。

### 5.8 元素系统（⚠️ 双重配色不一致）

存在**两套配色**，分别用于不同组件：

| 元素 | Chart.js `elementColors` | CSS `.element-*` / 表格 / 统计卡 |
|------|--------------------------|----------------------------------|
| 火 Fire | `#ff6b6b` | `#ef4444` |
| 水 Water | `#4ecdc4` | `#06b6d4` |
| 风 Air | `#a855f7` | `#a855f7` ✓ |
| 土 Earth | `#84cc16` | `#22c55e` |
| 中性 Neutral | `#9ca3af` | `#6b7280` |

**元素归一化** `getElementName(elem)`：`FIRE/WATER/EARTH/AIR` → `Fire/Water/Earth/Air`，其余归 `Neutral`。`Light`（光系）与 `Neutral`（中性）关键词被显式**过滤出修饰词**，避免污染来源归因。

### 5.9 六个分析标签页

默认显示 `summary`（总览）。`selectCombat()` 一次性填充所有标签页。

| `data-tab` | 标签 | 内容 | 图表 |
|-----------|------|------|------|
| `summary` | 总览 | 4 统计卡（玩家总伤害/总治疗/总吸血/总承伤） | `playerSummaryChart` — ECharts 堆叠横向柱状（伤害+治疗+吸血） |
| `overview` | 伤害总览 | 4 统计卡（玩家伤害/承伤/治疗/NPC伤害） | `playerDamageChart` — ECharts 横向柱状（青色渐变） |
| `healing` | 治疗总览 | 4 统计卡（玩家治疗/伤害/承伤/NPC伤害） | `playerHealingChart` — ECharts 横向柱状（绿色渐变） |
| `players` | 玩家统计 | 玩家卡片网格：职业图标+名字+职业+伤害/治疗/吸血；点击进入详情 | — |
| `details` | 详细数据 | 单玩家：4 元素统计卡 + 治疗/吸血 + 技能伤害表 + 目标伤害表 + **完整伤害记录表**（角色/目标/伤害/元素/暴击/描述） | `skillDamageChart`（Chart.js 横向）、`targetDamageChart`（Chart.js 纵向） |
| `npcs` | NPC总览 | NPC 卡片网格（名字、NPC、造成伤害） | — |

**ECharts 图表 Y 轴**：玩家名旁渲染对应职业图标（富文本 image）。

### 5.10 特殊功能
- **召唤物归属**：`recentNamedSummonApply` 记录同名多主召唤物；萨满分身用 `isMasqueDouble` 标记（召唤名 == 召唤者名）
- **附加伤害改写**：`addedvalueLangs`（增值/Added Value）会改写上一条记录的施法者
- **DoT 回填**：`linesToFillCaster` 队列，用下一次施法回填 `[Burning]` 来源
- **剪贴板复制**日志路径，附 Bootstrap tooltip 反馈「Copied!」

---

## 6. 副本攻略 (dungeon.html)

**定位**：全等级地下城攻略。**纯原生 JS**，无外部库，仅引用 `theme.css` + `theme.js`。

### 6.1 数据结构
```js
const DUNGEON_DATA = [
  {
    level: 51,                    // 等级档
    dungeons: [
      { name: "野兽巢穴",         // 副本名
        content: "<div class='boss-info'>...</div>" }  // HTML 攻略
    ]
  },
  // ...
]
```
- `content` 是**原始 HTML 字符串**，通过 `innerHTML` 注入模态框
- 内部用 `.boss-info`（青色框，BOSS/小怪）和 `.note`（琥珀色框，注意事项）两个样式类

### 6.2 副本清单（共 **8 等级档 / 42 副本**）

| 等级档 | 数量 | 副本 |
|--------|------|------|
| 51级 | 3 | 野兽巢穴、蚌蚌地下城、蟹皇领地 |
| 66级 | 5 | 满月祭坛、邦塔鸵鸟、咕哩泥塘、鸦人大酋长神庙、盘丝洞 |
| 81级 | 3 | 斯雷克洞穴、废弃虫洞、骸骨都市 |
| 96级 | 5 | 终结者的蒸汽室、劲舞秀场、犄角冰川、土匪据点、吉郎狼巢穴 |
| 111级 | 7 | 哈根达兹要塞、旋车公路、掌仙人地下城、大使之翼、布丁地下城、磨魂窟、迷之渔场 |
| 126级 | 6 | 卡利老巢、石笋旅店、土匪老巢、盗贼地下城、基地号飞艇、机械迷城（留） |
| 171级 | 6 | 汉尼芭地下城（野人）、椰人地下城、尼罗鳄地下城、汉尼草地下城、沙鼠地下城、紫金城 |
| 186级 | 7 | 冰盖峰、獾兽巢穴、蛋龙庇护地、熔岩火山、潘达拉坟墓、祸豹峡谷、鸮鸟工厂 |

> 数据质量提示：「迷之渔场」内容为占位符 `（攻略缺失）`；「机械迷城（留）」的「（留）」疑为保留状态标记。

### 6.3 交互功能
- **表格渲染**：`renderDungeonTable()` 动态生成 `<tr>`，每行显示等级档 + 该档所有副本标签
- **模态框**：点击 `.dungeon-tag` 调用 `openModal(title, contentHTML)`
  - 打开时锁定背景滚动（`body.style.overflow = 'hidden'`）
  - 三种关闭方式：① 右上 × 按钮 ② 点击**遮罩背景**（点击卡片内部不关闭） ③ **ESC 键**
- **无搜索、无筛选功能**（文档若提及搜索/筛选均为不准确描述）

---

## 7. 职业攻略 (class.html)

**定位**：职业展示与详情。采用**自研 hash 路由 SPA**（无框架），纯原生 JS。

### 7.1 职业数据（共 **15 个**，非首页文案的"18"）

```js
{ name: "弓箭手 (Cra)", slug: "cra", role: "远程输出 / 高单体伤害",
  icon: "🏹", description: "..." }
```

| # | 职业 | slug | 定位 | 图标 |
|---|------|------|------|------|
| 1 | 弓箭手 (Cra) | cra | 远程输出/高单体伤害 | 🏹 |
| 2 | 幸运猫 (Ecaflip) | ecaflip | 赌博型输出/辅助 | 🍀 |
| 3 | 治愈者 (Eniripsa) | eniripsa | 治疗/辅助 | 💉 |
| 4 | 宝藏猎人 (Enutrof) | enutrof | 宝藏搜寻/控制 | 💰 |
| 5 | 守护者 (Feca) | feca | 坦克/护盾辅助 | 🛡️ |
| 6 | 骑士 (Iop) | iop | 近战爆发/坦克 | ⚔️ |
| 7 | 唤兽师 (Osamodas) | osamodas | 召唤/辅助 | 🐉 |
| 8 | 熊猫武僧 (Pandawa) | pandawa | 控制/搬运 | 🐼 |
| 9 | 刺客 (Sram) | sram | 隐身/陷阱爆发 | 🗡️ |
| 10 | 植物术士 (Sadida) | sadida | 控制/召唤植物 | 🌿 |
| 11 | 时间术士 (Xelor) | xelor | 行动力操控/爆发 | ⏳ |
| 12 | 盗贼 (Rogue) | rogue | 炸弹爆破/远程 | 💣 |
| 13 | 萨满 (Masqueraider) | masqueraider | 近战/位移 | 🎭 |
| 14 | 异度旅者 (Eliotrope) | eliotrope | 传送/远程输出 | 🌀 |
| 15 | 光能法师 (Huppermage) | huppermage | 元素连携/全能 | 🔮 |

> ⚠️ **图标为 emoji**，**不使用** `asset/breed/*.png`。该 PNG 资源仅被 `analysis.html` 使用。
> 该页职业数（15）与 analysis.html 的 breed 数（19）不一致，两者是独立数据源。

### 7.2 路由系统（IIFE + `hashchange`）

| Hash | 渲染函数 | 内容 |
|------|----------|------|
| `#/` / 空 | `renderHome()` | 标题"全部职业" + 全部卡片网格 |
| `#/classes` | `renderClassesIndex()` | 标题"职业攻略" + `共 N 个职业` + 网格 |
| `#/classes/{slug}` | `renderClassDetail(slug)` | 职业详情；slug 无匹配则重定向到 `#/classes` |
| 其他 | `renderNotFound()` | 404 页 + 返回首页链接 |

> 注：`renderHome` 与 `renderClassesIndex` 输出几乎一致（根路由 `/` 等同于 `/classes`）。

### 7.3 详情页内容
1. 头部：职业图标（emoji）+ 名字 + 定位
2. 描述段落
3. 「⚡ 核心技能（示例）」表格（4 列：技能名/AP/元素/描述）
4. 「📐 推荐 Build（示例）」占位文本 + 「详细构筑请等待玩家贡献」

> ⚠️ **技能与 Build 为占位数据**：所有 15 个职业共享同一份 `demoSkills`（Raining Arrow/Destructive Arrow/Retreat Arrow），并非各职业真实技能。

### 7.4 其他
- Favicon 为内联 SVG data URI 嵌入 🌱 emoji（无需图片文件）
- 含页脚（Ankama 版权声明）

---

## 8. 其余内容页面

下述四页均为**纯静态内容页**，无外部 JS 库，引用 `theme.css` + `theme.js`。注意它们在 `<link rel="stylesheet" href="theme.css">` **之前**内联了大段重复样式（硬编码颜色），导致主题切换在这些页面上**仅部分生效**。

### 8.1 任务攻略 (quest.html)
- 标题渐变：绿色 `#34d399 → #10b981`
- **任务类型**：主线/支线/日常/隐藏
- **主线流程**（3 章）：① 觉醒（新手村，奖励基础装备）② 启程（离村进城选职，奖励职业专属技能）③ 抉择（阵营抉择，奖励阵营称号）
- **隐藏成就**（4）：暗影猎手、神龙之友、时间旅行者、全图鉴收集者
- **任务贴士**：4 条（任务追踪、时间限制、组队、检查日志）

### 8.2 生活攻略 (crafting.html)
- 标题渐变：绿色 `#10b981 → #34d399`
- 副标题声称"14种专业技能"，**实际仅列出 11 种**（4+4+3）：

| 分类 | 技能（数量） |
|------|--------------|
| 采集类 | 草药学、采矿、伐木、钓鱼（4） |
| 制造类 | 锻造、炼金、裁缝、珠宝加工（4） |
| 生产类 | 建筑、烹饪、制皮（3） |

### 8.3 图鉴与收藏 (collection.html)
- 标题渐变：蓝色 `#7dd3fc → #0ea5e9`
- **12 张卡片**（每类 4 张）：
  - 宠物：忠诚犬、暗影猫、九尾狐、幼龙
  - 坐骑：白马、独角兽、炎龙、飞行扫帚
  - 时装：绅士套装、暗影刺客、皇室礼服、法师长袍
- 稀有收藏：传说级宠物（每服仅 3 只）、绝版坐骑、成就称号、特殊幻化

### 8.4 装备搭配 (equipment.html)
- 标题渐变：粉色 `#f0abfc → #d946ef`
- **本质是 4 个外部工具/资源导航**（非配装器本体）：

| 工具 | 链接 / 来源 |
|------|-------------|
| 沃沃查工具 | QQ 群空间下载 |
| ZenithWakfu | https://www.zenithwakfu.com/builder |
| Cyomega (cyz) | https://wakfublue.pages.dev/ |
| 官方装备资料库 | https://www.wakfu.com/en/mmorpg/encyclopedia |

- 外链统一使用 `rel="noopener noreferrer"`（安全实践良好）
- ⚠️ 页面 CSS 中定义了 `.search-bar`、`.equip-card` 等样式，但**标记中无对应元素**——属模板遗留的脚手架代码

---

## 9. 主题系统

### 9.1 主题列表（5 套）
定义于 `theme.js`（与 index.html 内联脚本一致）：

```js
const themes = [
  { name: '暗夜', icon: '🌙', theme: 'dark' },
  { name: '春',   icon: '🌸', theme: 'spring' },
  { name: '夏',   icon: '☀️', theme: 'summer' },
  { name: '秋',   icon: '🍂', theme: 'autumn' },
  { name: '冬',   icon: '❄️', theme: 'winter' }
];
```

### 9.2 各主题主色

| 主题 | `data-theme` | 主色 `--accent-primary` | 氛围 |
|------|--------------|-------------------------|------|
| 暗夜 | `dark` | `#3b82f6` 蓝 | 靛蓝/紫光 |
| 春 | `spring` | `#66bb6a` 绿 | 绿/粉光 |
| 夏 | `summer` | `#ff9800` 橙 | 橙/红光 |
| 秋 | `autumn` | `#ff5722` 深橙 | 橙/棕光 |
| 冬 | `winter` | `#29b6f6` 浅蓝 | 蓝/青光 |

### 9.3 实现机制
- 通过 `<body data-theme="...">` 切换，CSS 自定义属性（CSS Variables）驱动全套配色
- `localStorage` 持久化（键 `wakfu-theme`，存索引值）
- `theme.js` 的 `initTheme()` **动态创建** `.theme-switcher` 浮动组件并注入 `body`（首页是内联在 HTML 中的）

**核心函数**：
```js
setTheme(index)   // 设置主题：更新 data-theme、图标、名称、指示点、localStorage
nextTheme()       // 切换到下一个主题（循环）
initTheme()       // 动态创建切换器并恢复已保存的主题
```

### 9.4 切换流程
```
点击 .theme-switcher
  → nextTheme() 更新 currentThemeIndex
  → setTheme() 更新 data-theme 属性
  → 更新图标/名称/指示点 active 状态
  → localStorage 持久化
  → CSS 变量级联更新（body 0.5s 过渡）
```

### 9.5 主题变量（约 16 个/主题）
`--bg-primary`、`--bg-secondary`、`--bg-card`、`--bg-card-hover`、`--text-primary`、`--text-secondary`、`--text-muted`、`--text-dim`、`--accent-primary`、`--accent-secondary`、`--accent-glow`、`--nav-link-hover`、`--border-color`、`--border-hover`、`--glow-top`、`--glow-bottom`、`--card-shadow`、`--card-shadow-hover`

---

## 10. 全局样式与共享组件

### 10.1 theme.css（577 行，设计系统基座）
- **全局 reset**（`*` box-sizing）
- **body**：径向渐变背景、字体栈 `'Segoe UI', 'PingFang SC', 'Microsoft YaHei'`、0.5s 主题过渡
- **`.bg-glow` / `.bg-glow.bottom`**：固定模糊光斑（80px blur，70vw×70vh / 60vw×60vh）
- **`.navbar`**：sticky + 毛玻璃，Logo 渐变文字 + 发光，导航链接悬停时 `::after` 下划线从 0% 拉到 100%
- **`.hero`**：H1 用楷体 `KaiTi`、`clamp(1.8rem, 5vw, 3.2rem)`、渐变文字裁切 + 投影发光；`.accent-line` 120px 渐变横条
- **`.cards-grid`**：4 列（≤900px→2 列，≤500px→1 列）
- **`.card`**：28px 圆角玻璃卡 + 光泽扫过悬停动画 + 图标缩放旋转
- **`.footer`**：顶部边框 + 模糊暗底
- **`.theme-switcher`**：左下角浮动胶囊，含图标（悬停旋转 30°）、名称、5 个指示点（active 放大 1.2×）

### 10.2 analysis_fix.css（86 行，分析页补丁层）
文件头注释：「战斗分析页面专属优化样式」。全部规则挂在 `.analysis-page` 下，用 `!important` 把 Bootstrap 默认浅色组件**强制重着色**为暗色玻璃风：

| 覆盖对象 | 处理 |
|----------|------|
| `.content-area` | 深色半透明 + blur 20px |
| `.stat-card` / `.player-card` / `.combat-item` | 映射到主题变量 |
| `.tab` / `.tab.active` | 非激活用 `--text-secondary`，激活用 `--accent-primary` |
| `.table` 系列 | 暗底 + 主题色边框 + 行悬停高亮 |
| `.progress` / `.progress-bar` | 渐变填充 |
| `.card` / `.card-header` / `.card-body` | 暗色卡片 |
| `.form-control` / `.form-select` | 暗色输入框 + **硬编码紫色聚焦环** `rgba(139,92,246,0.25)` |

> ⚠️ 聚焦环颜色硬编码为紫色，**不随春夏秋冬主题变化**——轻微不一致。

---

## 11. 数据结构参考

### 11.1 副本数据 (dungeon.html)
```js
DUNGEON_DATA: Array<{
  level: number,
  dungeons: Array<{ name: string, content: string /* HTML */ }>
}>
```

### 11.2 职业数据 (class.html)
```js
classesData: Array<{
  name: string, slug: string, role: string,
  icon: string /* emoji */, description: string
}>
demoSkills: Array<{ name: string, ap: number, element: string, desc: string }>
```

### 11.3 战斗数据 (analysis.html) — 见 [§5.6](#56-数据结构)
```js
CombatData {
  players[], playersPos[], playersSummon[], playersSummonPos[],
  playersBreed: { [name]: breedId },
  mobs[], mobsPos[], mobsSummon[], mobsSummonPos[],
  combatId: string, lineNumber: number,
  data: Array<{ caster, target, damage, element, crit, block, desc, extra }>
}
```

---

## 12. 已知问题与待优化项

### 数据准确性
| # | 问题 | 影响 |
|---|------|------|
| 1 | `breedNames` 中 ID 17、18 均为 Eliotrope（重复），Huppermage 被挤到 ID 19 | breed 18 的 Huppermage 被误标为 Eliotrope |
| 2 | 首页"18职业构筑"文案 | 实际 class.html 仅 15 个 |
| 3 | 生活攻略副标题"14种专业技能" | 实际仅列 11 种 |
| 4 | class.html 全职业共享同一份占位 `demoSkills` | 详情页技能非真实数据 |

### 代码问题
| # | 问题 | 位置 |
|---|------|------|
| 5 | 元素双重配色不一致（Chart.js vs CSS） | 火水土中性在图表与表格中色值不同 |
| 6 | 多语言数组简繁重复（`施放/生命/光系/中性/增值` 三档与二档相同） | zh-TW 用户匹配不到差异化变体 |
| 7 | `if (source === 'Unknown' \|\| source === 'Unknown')` 同操作数重复 | analysis.html 第 1774 行 |
| 8 | 死代码：`langDict`（声明未用）、`updateCombatList()`（定义未调用） | analysis.html |
| 9 | `isTeamMember('Unknown')` 恒返回 `true` | 归因失败时会计入玩家方，可能虚高统计 |
| 10 | `getHighestHealthNPC()` 名不副实 | 实为"承伤最多 NPC"，非真实血量 |

### 样式与体验
| # | 问题 | 影响 |
|---|------|------|
| 11 | quest/crafting/collection/equipment 内联样式硬编码颜色 + 重复 ~150 行 theme.css | 主题切换在这 4 页仅部分生效 |
| 12 | analysis_fix.css 聚焦环硬编码紫色 | 不随主题变化 |
| 13 | equipment.html 残留 `.search-bar` / `.equip-card` 未使用样式 | 模板脚手架遗留 |
| 14 | CDN 资源无 SRI 完整性校验 | 安全风险 |
| 15 | 无文件大小/数量上限 | 超大日志可能撑爆内存 |

---

## 13. 部署与运行

**部署平台**：
- GitHub Pages：https://windcat0.github.io
- Cloudflare Pages：https://wakfu0.pages.dev

**运行方式**：
- 纯静态站点，无构建步骤、无后端
- 直接用浏览器打开 `index.html` 即可运行（analysis 解析功能因使用 FileReader，本地 file:// 协议也能用）
- 或本地起静态服务器：
  ```bash
  python3 -m http.server 8000
  # 访问 http://localhost:8000
  ```

**版权声明**：非官方粉丝站点，Wakfu 及相关知识产权归 Ankama 所有。
