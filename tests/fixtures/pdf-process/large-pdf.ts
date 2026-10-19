/** Synthetic PDF larger than the 2 MiB control-frame budget; not derived from any real document. */

export const LARGE_PAGE_TEXT = 'Oversized PDF evidence 11';
export const FRAME_BUDGET = 2 * 1024 * 1024;

export function largePdf(): Buffer {
  const content = `BT /F1 12 Tf 72 720 Td (${LARGE_PAGE_TEXT}) Tj ET\n`;
  const filler = ' '.repeat(3 * 1024 * 1024);
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ' +
      '/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}endstream`,
    `<< /Length ${filler.length} >>\nstream\n${filler}\nendstream`,
  ];

  let pdf = '%PDF-1.7\n';
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const startxref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF\n`;

  return Buffer.from(pdf, 'latin1');
}
