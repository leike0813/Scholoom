# EPUB／HTML 文档解析

文献模块在独立受管 Node 进程解析本地材料，不将正文提交外部解析服务。

| 直接依赖 | 固定版本 | 许可 | 用途 |
| --- | --- | --- | --- |
| [yauzl](https://github.com/thejoshwolfe/yauzl) | 3.4.0 | MIT | EPUB ZIP 中央目录及按需条目流 |
| [@xmldom/xmldom](https://github.com/xmldom/xmldom) | 0.9.12 | MIT | container、OPF、NCX、XHTML |
| [parse5](https://github.com/inikulin/parse5) | 8.0.1 | MIT | HTML 快照解析 |
| @types/yauzl | 3.4.0 | MIT | 编译期类型 |

依赖原有许可随各 npm 包保留，随内核运行时依赖分发。parse5 的 entities 和 yauzl 的 pend 属传递依赖，以锁文件为准。

支持 EPUB 2／3 重排版、单文件 HTML；固定版式和加密正文明确不支持。原书 CSS、字体、脚本及外部实体不执行或取回。正文从共同规范化树读取，图片限 PNG／JPEG／GIF／WebP，HTML 只读 data 资源，EPUB 按当前章节引用读取包内资源。缺图片保留替代说明。

限制集中在文档解析模块：容器条目最多10000、累计声明展开256MiB、单文档8MiB、图片1MiB。正文每次最多32768 UTF-16单元和4096节点；超出时提供继续位置，搜索最多扫描16章节后提供继续游标。运行时受30秒截止时间及共同进程容量约束，不宣称强安全沙箱或硬内存配额。
