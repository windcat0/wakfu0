// ============================================================
//  功能清单数据源 (由 func.html 加载并动态渲染卡片)
//  本文件由 scripts/gen_manifest.js 自动生成，也可手动维护。
//  新增功能：在 funcs/ 放带 <meta name="func-*"> 的 html 后运行
//           `node scripts/gen_manifest.js` 即可重写本文件。
// ============================================================
window.FUNCS = [
  {
    href: "funcs/liner.html",
    icon: "📐",
    title: "线性拟合 · 参数学习",
    badge: "梯度下降可视化",
    desc: "通过可视化展示线性回归参数在梯度下降过程中的学习轨迹，直观看到损失曲面与参数收敛的关系。",
    tags: ["线性回归","梯度下降","损失函数"]
  },
  {
    href: "funcs/non-liner.html",
    icon: "📈",
    title: "多段线性 · 非线性拟合",
    badge: "ReLU 基函数组合",
    desc: "用多段线性（ReLU 形式的基函数）组合拟合非线性数据，可调断点数量，观察分段线性如何逼近任意曲线。",
    tags: ["非线性拟合","ReLU 基函数","分段线性"]
  },
  {
    href: "funcs/activation.html",
    icon: "⚡",
    title: "激活函数可视化",
    badge: "公式 / 曲线 / 导数",
    desc: "对比 Sigmoid、Tanh、ReLU、Leaky ReLU、GeLU 五个常用激活函数的公式、函数曲线与导数曲线，支持悬停查看数值。",
    tags: ["Sigmoid","ReLU","GeLU"]
  },
  {
    href: "funcs/llm_params.html",
    icon: "🧮",
    title: "LLM 参数计算器",
    badge: "Transformer 架构",
    desc: "输入 Transformer 模型参数，自动计算各组件的参数量及总参数量。支持 GPT、Llama、Mistral 等常见模型预设。",
    tags: ["Transformer","参数量","GPT/Llama"]
  },
  {
    href: "funcs/attention.html",
    icon: "⚛️",
    title: "注意力机制",
    badge: "Scaled Dot-Product",
    desc: "可视化 Self-Attention 完整计算流程：Q·Kᵀ → 缩放 → softmax → ·V。含注意力热力图、逐步矩阵、权重连线图，可编辑 Q/K/V 实时重算。",
    tags: ["Self-Attention","Softmax","Q·Kᵀ"]
  },
  {
    href: "funcs/bpe_visualizer.html",
    icon: "🧩",
    title: "BPE 可视化器",
    badge: "Byte Pair Encoding",
    desc: "详细展示 BPE 算法迭代过程：字符对频率统计、最高频对合并、词汇表构建。支持分步查看、历史回溯和 Token 化前后对比。",
    tags: ["BPE","Token 化","词汇表"]
  },
  {
    href: "funcs/token_training.html",
    icon: "🔤",
    title: "Token 化与词嵌入",
    badge: "BPE + Word2Vec",
    desc: "可视化展示 Token 化过程（BPE 算法迭代合并最高频字符对）和 Word2Vec 词嵌入训练（滑动窗口、向量更新、语义空间）。",
    tags: ["BPE","Word2Vec","词嵌入"]
  },
  {
    href: "funcs/math.html",
    icon: "🧸",
    title: "数学小勇士",
    badge: "加减乘除练习",
    desc: "面向小朋友的加减乘除法练习乐园，支持模式选择、题量设置、9 键数字键盘、音效反馈与错题回顾，答对答错即时提示。",
    tags: ["加法","减法","乘法","除法","练习"]
  },
  {
    href: "funcs/devtools.html",
    icon: "🧰",
    title: "开发者工具集",
    badge: "34 个工具 · 纯本地计算",
    desc: "内置 34 个常用开发工具：Base64/URL/Hex/Base32 编解码、MD5/SHA/HMAC/AES、JWT 解码、JSON/YAML/CSV、文本处理、进制/时间戳/颜色转换、UUID/密码/短ID/二维码生成、正则/URL/UA 解析、Diff/Cron/Markdown 等，全部在浏览器本地完成，数据不上传。",
    tags: ["Base64","JSON","加密","时间戳","二维码"]
  }
];
