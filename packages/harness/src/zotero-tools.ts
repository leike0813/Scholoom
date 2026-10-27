import { type ZoteroInputs, type ZoteroPort, zoteroOperations } from '@scholoom/protocol/zotero';
import { z } from 'zod';

export function zoteroTools(port: ZoteroPort, rememberLibrary: (libraryId: string) => void) {
  return (
    [
      [
        'zotero.inspect',
        'inspect_zotero_originals',
        '有界核对所选revision的CSL与唯一Zotero原值identity。只比较准确题名，其他字段notComparable；不可把题名相同当全条目一致。不确定用户要采用哪个表达时，先明确询问。',
      ],
      [
        'zotero.replaceTitle',
        'replace_zotero_original_title',
        '独立更正已核对identity/revision的唯一schema44期刊原值题名，必须有用户明确的准确新题名；不确定先询问。只改原title，不改CSL/日期/作者/Extra/正式键。稳定requestId；未知只查询原结果，不重放。',
      ],
      [
        'zotero.fillKeys',
        'fill_zotero_keys',
        '为隔离期刊所选版本补缺键；稳定operationId，未知时查询原操作，不重放。',
      ],
      [
        'zotero.export',
        'export_zotero',
        '按用户明示指令采用原值时，提供已核对identity/revision的expression.kind=zotero-original；无法确定先询问用户，不能用boolean自报授权。未选择返回selectionRequired且无文本；明确选择后才由原BBT导出并返回exported及依据。',
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
    func: async (input: ZoteroInputs[keyof ZoteroInputs]) => {
      const result = await port.call(...([method, input] as Parameters<ZoteroPort['call']>));
      rememberLibrary(input.libraryId);
      return JSON.stringify(result);
    },
  }));
}
