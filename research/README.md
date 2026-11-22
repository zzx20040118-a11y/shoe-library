# SHOE / 逐书文本整理流水线（第一阶段）

目标：逐本整理分页与文学地理记录；原文不得改写。**当前阶段为离线产物，不会自动替换网站的书籍。**

## 执行

在仓库根目录安装 Node.js 18+，运行：

```bash
npm run prepare:book -- --id pg4300
npm run prepare:book -- --id pg4300 --annotations research/pg4300.places.json
```

读取 `library/pg4300.json.gz`，写入 `research/generated/pg4300.json`。输出包括新分页文本、旧正文的 SHA-256、原文绝对偏移量、地点映射、QA 信息。

## 位置标注格式

创建 `research/pg4300.places.json`：

```json
[
  {
    "term": "EXACT TEXT",
    "place": "经过核验的具体地点名称",
    "city": "Dublin",
    "kind": "direct",
    "oldPage": 0,
    "oldAt": 0,
    "lat": 0,
    "lon": 0,
    "confidence": "pending-review"
  }
]
```

示例仅展示字段，**不是有效地点数据**。实际 `term` 必须与原文指定偏移处逐字一致；坐标须核验，不能使用示例的 0,0。

- `direct`：原文明确出现的具体、可定位地点。
- `prototype`：文学虚构地点的现实原型；必须填写 `sourceUrl`，不得由 AI 自行推断。
- `city-context`：城市或区域检索上下文，不生成地图点。

## 审核要求

1. 原文完整性：新页拼接必须与旧页拼接逐字符一致。
2. 分页边界：优先段落、句末，不允许截断句子；诗歌、戏剧和对话需要单独人工/AI 审核，不能只凭正则判断。
3. 地点位置：保存原始页码和字符偏移；映射后再检查原文词一致。
4. 来源：原文地点应能回溯原句；现实原型应有独立资料。
5. 审核后才发布：当前脚本的 `aiReviewed:false` 是刻意保留的状态，不能声称已经由 AI 逐书分析。

## 后续接入

现有网站仍使用旧页码和旧地点索引。待完成逐书 QA 和历史书签迁移机制后，才可以将审核通过的产物接入阅读器和地图。禁止在未迁移索引时直接覆盖线上 `library/*.json.gz`。
