import { OperationError } from '@scholoom/protocol/core';
import { isReportManifest, type ReportManifest, reportLimits } from '@scholoom/protocol/reports';

export const reportHeaderStart = '<!--scholoom-report-v1\n';
const end = '\n-->';
const bytes = (value: string) => new TextEncoder().encode(value).byteLength;

export function decodeReportHeader(html: string): ReportManifest {
  if (!html.startsWith(reportHeaderStart))
    throw new OperationError('invalidRequest', '缺少受支持的报告头部。');
  // JSON byte capacity also bounds its UTF-16 prefix, so the HTML body is never parsed.
  const prefix = html.slice(
    reportHeaderStart.length,
    reportHeaderStart.length + reportLimits.manifestBytes + end.length + 1,
  );
  const stop = prefix.indexOf(end);
  if (stop < 0) throw new OperationError('invalidRequest', '报告头部缺少有界结束符。');
  const after = prefix[stop + end.length];
  if (after !== undefined && after !== '\n')
    throw new OperationError('invalidRequest', '报告头部结束符必须独占一行。');
  const json = prefix.slice(0, stop);
  if (bytes(json) > reportLimits.manifestBytes)
    throw new OperationError('tooLarge', '报告清单超过字节容量。');
  if (/[<>-]/.test(json))
    throw new OperationError('invalidRequest', '报告清单字符串必须使用注释安全转义。');
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    throw new OperationError('invalidRequest', '报告清单JSON无效。');
  }
  if (!isReportManifest(value)) throw new OperationError('invalidRequest', '报告清单不符合契约。');
  return value;
}

export function encodeReportHeader(manifest: ReportManifest): string {
  const serialized = JSON.stringify(manifest);
  if (bytes(serialized) > reportLimits.manifestBytes)
    throw new OperationError('tooLarge', '报告清单超过字节容量。');
  if (!isReportManifest(manifest))
    throw new OperationError('invalidRequest', '报告清单不符合契约。');
  const json = serialized.replace(
    /[<>-]/g,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
  if (bytes(json) > reportLimits.manifestBytes)
    throw new OperationError('tooLarge', '报告清单超过字节容量。');
  return `${reportHeaderStart}${json}${end}\n`;
}
