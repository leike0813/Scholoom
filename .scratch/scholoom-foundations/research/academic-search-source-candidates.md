# 线上文献检索／全文来源候选：官方 API 事实核查

日期：2026-10-09。方法：只读官方文档与 first-party 接口规范（curl 抓官方页、读官方 OpenAPI）。未调用需凭据的真实接口，未下载论文，未实测延迟与配额。这是父项目讨论首批线上来源的事实底稿，不含产品取舍。

## OpenAlex

- 检索：`/works?search=` 加过滤／排序／分页；另有 `/autocomplete`、`/keywords`、OQL。https://help.openalex.org/api/endpoints/
- 标识符：`/works/W…`；组件端点 `/locations` 用 `doi:`、`pmid:` 等命名空间 ID。同上。
- 引用关系：works 实体承载，字段清单未逐项核对。
- 全文位置：`/locations` 每份副本一行；`open_access`／`best_oa_location` 与 Unpaywall 同值。https://help.openalex.org/access/unpaywall
- 全文本体：自存 5000 万+ OA 全文，给 PDF 与 Grobid TEI XML，`has_content`／`content_urls` 指向 content.openalex.org。https://help.openalex.org/access/fulltext/
- **访问条件**：数据免费，无 key 可基本查询；免费 key 把日额度放大 10 倍（`api_key` 参数或 Bearer 头）。超日额度或超 100 请求/秒返 429；per_page ≤100，基础分页上限 10,000，超出用 cursor。https://help.openalex.org/api/authentication/

## Crossref

- 检索：`/works?query=` 加过滤；另有 `/works/{doi}`、`/journals/{issn}/works`。https://www.crossref.org/documentation/retrieve-metadata/rest-api/
- 标识符：`/works/{doi}`，支持内容协商。
- 引用关系：有 `has-references:1`、`is-referenced-by-count`；参考文献列表的开放程度未核清。
- 全文位置：记录含 license 与出版后更新，不是全文位置服务。
- **访问条件**：官方明示无需注册；元数据基本无版权（部分摘要可能仍受限）；礼貌池加 `mailto=`。rows 上限 1000、游标翻页、遇 429 退避。https://www.crossref.org/documentation/retrieve-metadata/rest-api/tips-for-using-the-crossref-rest-api/

## Semantic Scholar

- 检索：`/paper/search`（相关性）、`/paper/search/match`（标题）、`/paper/autocomplete`、`/snippet/search`。https://api.semanticscholar.org/graph/v1/swagger.json
- 标识符：`/paper/{id}`、`POST /paper/batch`、`externalIds`。同上。
- 引用关系：`/paper/{id}/citations`、`/references`，另有 `influentialCitationCount`。
- 全文位置：字段 `openAccessPdf`、`isOpenAccess`，是指针，不托管。
- **访问条件**：部分端点强制要 key，使用 `x-api-key` 头；可匿名使用的端点受共享限流约束，不构成本应用可用配额的保证。具体端点要求与申请后配额随实现核对，未实测。https://www.semanticscholar.org/product/api

## arXiv

- 检索：`search_query` 支持 `ti:`、`au:`、`abs:`、`cat:`；默认按相关性排序，可通过 `sortBy` 选择提交日期或更新日期。https://info.arxiv.org/help/api/user-manual.html
- 标识符：`id_list`，兼容 `hep-ex/0307015` 式旧编号。
- 引用关系：响应不含参考文献列表。
- 全文位置：给摘要页与 PDF 链接。官方条款明确允许个人或研究用途的全文获取、保存和使用；从自己的服务器对外提供全文须具备权利人许可或相应分发许可，不能据此推为禁止本地研究附件保存。https://info.arxiv.org/help/api/tou.html
- **访问条件**：无 key。每三秒不超过一个请求且同时只用一个连接，该限制按你控制的全部机器合计；需更高频率须联系官方。结果总量上限 30,000、单次最多 2,000。描述性元数据为 CC0 1.0。

## PubMed／NCBI E-utilities

- 检索：`esearch`／`efetch`／`esummary`；`elink` 做库间链接，同库时返回相关邻居。基址 `eutils.ncbi.nlm.nih.gov/entrez/eutils/`。https://www.nlm.nih.gov/dataguide/eutilities/utilities.html
- 标识符：以 PMID 等为查询键。引用方向参数与 PMC 链接语义未核清。
- 全文位置：经 `elink` 表达与 PMC 的链接，具体字段未核实。
- **访问条件**：建议不超过每秒 3 次，大批量排在周末或美东夜间；`tool` 与 `email` 建议必带，未注册且违规可能被封；无 key 超 3 次/秒会收到错误；key 作 `api_key` 参数，更高配额需申请。https://www.ncbi.nlm.nih.gov/books/NBK25497/

## Europe PMC

- 检索：`/search?query=` 字段级查询，默认按相关性，可 `sort_cited:y`；`resultType` 有 idlist／lite／core（core 含摘要、全文链接、MeSH），格式 XML／JSON／Dublin Core。https://dev.europepmc.org/RestfulWebService
- 标识符：以文献 ID 取单条。引用关系：官方称覆盖 1,940 万+ 出版物的参考文献列表，并提供被引计数与引文网络。
- 全文位置：称覆盖 1,020 万全文、650 万 OA，但帮助页写明**全文 XML 仅对 OA 子集开放**。https://europepmc.org/help
- **访问条件**：基址 `ebi.ac.uk/europepmc/webservices/rest/`，另有 test 版路径；页面未见 key 要求或限流数字，未核清。

## Unpaywall

- 检索与引用关系：无。仅按 DOI 取单条记录。
- 全文位置：`is_oa`、`oa_status`、`oa_locations`、`best_oa_location`。https://unpaywall.org/api
- **访问条件**：免费，但**必须在 URL 上带 email**，这是唯一认证。官方限流数字未取到（二手资料称每日 10 万次，未核清）。
- 与 OpenAlex：官方称二者已同库，Unpaywall 是 OpenAlex 之上的兼容格式，`is_oa`／`oa_status`／PDF 链接与 `open_access`／`best_oa_location` 同值，增量价值主要在既有工具链兼容。https://help.openalex.org/access/unpaywall

## 覆盖不等于全文

元数据、全文位置指针、实际取得的全文是三件事。本轮核查的 Crossref、PubMed、arXiv 题录接口、Semantic Scholar 和 Unpaywall 接口不直接返回全文本体，取得全文还需读取相应内容地址；arXiv 本身也托管论文全文。OpenAlex content API 可返回其已收录的 OA 内容，Europe PMC 可返回 OA 子集 XML，均不能推为全库全文可用。

覆盖随上游登记与索引而变，不是全网：中文与区域库（CNKI、万方、维普等）、机构库、出版商自有站点，本次均未核到开放 API。

## 通用网页搜索／抓取的职责

承接上述缺口：出版商落地页、非 arXiv 预印本、机构与项目页面、灰色文献、中文／区域来源，都靠通用搜索与抓取发现。书目 API 只能确认「已登记的那条记录」，发现不了未登记的页面。本文不涉及搜索供应商选择。

## 未核清与未实测

- Crossref 参考文献列表开放程度、OpenAlex 引用字段清单、PubMed `elink` 引用方向与 PMC 链接语义。
- Unpaywall 官方限流数字；Europe PMC 是否需要 key 及其限流。
- 全部来源的响应质量、字段填充率、延迟与真实配额消耗，均未实测。
- Europe PMC 与 Unpaywall 文档页为前端渲染，NCBI 直接抓取返回 recaptcha；相关内容经官方域名的渲染读取获得。
