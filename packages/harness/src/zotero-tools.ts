import { type ZoteroPort, zoteroOperations } from '@scholoom/protocol/zotero';
import { z } from 'zod';

export function zoteroTools(port: ZoteroPort) {
  return (
    [
      [
        'zotero.fillKeys',
        'fill_zotero_keys',
        '为隔离期刊所选版本补缺键；稳定operationId，未知时查询原操作，不重放。',
      ],
      [
        'zotero.export',
        'export_zotero',
        '按所选版本和正式键通过原BBT导出BibTeX或BibLaTeX；返回有界文本。',
      ],
      [
        'zotero.result',
        'read_zotero_result',
        '查询原补键操作的共同持久回执；notFound不表示可以重放未知提交。',
      ],
    ] as const
  ).map(([method, name, description]) => ({
    name,
    description,
    schema: z.fromJSONSchema(JSON.parse(JSON.stringify(zoteroOperations[method].params))),
    func: async (input: unknown) =>
      JSON.stringify(await port.call(...([method, input] as Parameters<ZoteroPort['call']>))),
  }));
}
