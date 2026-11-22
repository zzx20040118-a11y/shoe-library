# SHOE/书 · 多城市步行尺度地点考证候选（第一批）

状态：research_candidate，**未加入正式地图**。本批同时涉及伦敦、都柏林；继续按同一标准扩展其他城市。只有完成正文位置核验、地理坐标核验和证据审查后才能发布。

| 城市 | 已在书库中的作品 | 具体候选地点 | 关联类型 | 核验来源 | 后续处理 |
|---|---|---|---|---|---|
| 伦敦 | 雾都孤儿 (pg730) / Oliver Twist (pg56586) | Saffron Hill | 小说明确出现的街道 | https://www.thelondonarchives.org/blog/olivers-walk-through-clerkenwell-1837 | 核对当前版本的章节及正文位置；街道是线状对象，不要伪装成精确门牌 |
| 伦敦 | 雾都孤儿 (pg730) / Oliver Twist (pg56586) | Field Lane（历史旧街） | 小说明确出现、原址已变化 | https://www.cityoflondon.gov.uk/assets/Things-to-do/dickens-magic-lantern.pdf | 考证历史街道与现今路网的对应范围；位置标为 approximate/area |
| 伦敦 | 雾都孤儿 (pg730) / Oliver Twist (pg56586) | 54 Hatton Garden | 小说法庭的现实参照/原型 | https://www.gresham.ac.uk/watch-now/dickenss-law-makers-and-law-breakers-barnards-inn-and-beyond | 核对原型证据及门牌现址；标注为 literary_prototype，不是原文逐字提及门牌 |
| 伦敦 | 雾都孤儿 (pg730) / Oliver Twist (pg56586) | Exmouth Street、Sadler's Wells | 小说路线中的具体街道/建筑 | https://www.cambridge.org/core/elements/new-approaches-for-digital-literary-mapping/6096DAEAAAF867D7C08D19E49EC59857 | 检查版本中的地名翻译与原文，再决定是否加入 |
| 都柏林 | 尤利西斯 (pg4300) | 7 Eccles Street | 小说角色住所；建筑已拆除 | https://jamesjoyce.ie/visit-/ | 核验正文中地址出现位置；旧址和现存原门（博物馆）是两个不同地点，不要混为一谈 |

## 发布门槛

- 每条记录需确认对应**书库版本的实际正文**中是否有地点或能直接追溯的情节。不得拿其他版本的文字直接冒充当前版本摘录。
- 地点记录须有 `book_id, page, at, quote, mention, canonical_place, city, country, relation_type, precision, evidence_url, review_status`；若尚未核验精确坐标，保持 `lat/lon=null`。
- 历史旧址与虚构原型必须展示证据性质与位置不确定性。地图上优先显示可步行的街道、建筑和原址，不将城市中心当作替代坐标。
- 这份文件只是**多城市增量考证队列**，并不表示已完成全书库联网考证或自动导入。
