// CSL names checked against Zotero 10.0.5 schema 44, commit 70c3aa98627413d6a30dca955886eafbde085ce9.
export const catalogEditorTypes = [
  ['article', '预印本／文章'],
  ['article-journal', '期刊论文'],
  ['article-magazine', '杂志文章'],
  ['article-newspaper', '报纸文章'],
  ['bill', '议案'],
  ['book', '图书'],
  ['broadcast', '广播节目'],
  ['chapter', '书籍章节'],
  ['dataset', '数据集'],
  ['document', '文档'],
  ['entry-dictionary', '词典条目'],
  ['entry-encyclopedia', '百科条目'],
  ['graphic', '图像作品'],
  ['hearing', '听证材料'],
  ['interview', '访谈'],
  ['legal_case', '判例'],
  ['legislation', '法律法规'],
  ['manuscript', '手稿'],
  ['map', '地图'],
  ['motion_picture', '影像'],
  ['paper-conference', '会议论文'],
  ['patent', '专利'],
  ['personal_communication', '个人通信'],
  ['post', '帖子'],
  ['post-weblog', '博客文章'],
  ['report', '报告'],
  ['software', '软件'],
  ['song', '录音作品'],
  ['speech', '演讲'],
  ['standard', '标准'],
  ['thesis', '学位论文'],
  ['webpage', '网页'],
] as const;

const publication = [
  'article-journal',
  'article-magazine',
  'article-newspaper',
  'chapter',
  'entry-dictionary',
  'entry-encyclopedia',
  'paper-conference',
];
const books = ['book', 'chapter', 'entry-dictionary', 'entry-encyclopedia'];
export const catalogEditorFields: readonly {
  key: string;
  label: string;
  types?: readonly string[];
}[] = [
  { key: 'title', label: '题名' },
  { key: 'DOI', label: 'DOI' },
  { key: 'URL', label: 'URL' },
  { key: 'abstract', label: '摘要' },
  { key: 'language', label: '语言' },
  { key: 'container-title', label: '刊物／书籍名称', types: publication },
  {
    key: 'publisher',
    label: '出版者',
    types: [
      ...books,
      ...publication,
      'report',
      'thesis',
      'software',
      'dataset',
      'document',
      'standard',
    ],
  },
  {
    key: 'publisher-place',
    label: '出版地',
    types: [...books, ...publication, 'report', 'thesis', 'software', 'document', 'standard'],
  },
  { key: 'volume', label: '卷', types: [...books, ...publication] },
  {
    key: 'issue',
    label: '期',
    types: ['article-journal', 'article-magazine', 'article-newspaper', 'paper-conference'],
  },
  { key: 'page', label: '页码', types: [...publication, 'report', 'patent', 'legislation'] },
  {
    key: 'ISBN',
    label: 'ISBN',
    types: [...books, 'paper-conference', 'report', 'thesis', 'software', 'standard'],
  },
  { key: 'ISSN', label: 'ISSN', types: [...books, ...publication, 'report', 'thesis'] },
  { key: 'edition', label: '版次', types: [...books, 'standard'] },
  { key: 'version', label: '软件／数据版本', types: ['software', 'dataset', 'standard'] },
] as const;

export const catalogEditorRoles = [
  ['author', '作者'],
  ['editor', '编辑'],
  ['translator', '译者'],
  ['container-author', '书籍作者'],
] as const;
export const catalogEditorDates = [
  ['issued', '发表日期'],
  ['accessed', '访问日期'],
  ['submitted', '提交日期'],
  ['original-date', '原始发表日期'],
] as const;
