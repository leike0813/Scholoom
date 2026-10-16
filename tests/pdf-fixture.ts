/** Synthetic PDF evidence; not derived from any real document. */

import { createHash } from 'node:crypto';

export const PAGE_ONE_TEXT = 'Scholoom PDF evidence 42';
export const PAGE_TWO_TEXT = 'Second page controlled result 73';

export const PAGE_ONE_MEDIA_BOX = [0, 0, 612, 792] as const;
export const PAGE_TWO_MEDIA_BOX = [0, 0, 400, 600] as const;
export const PAGE_ONE_ORIGIN = { x: 72, y: 720 } as const;
export const PAGE_TWO_ORIGIN = { x: 50, y: 500 } as const;

const contentStream = (text: string, x: number, y: number): string =>
  `BT /F1 12 Tf ${x} ${y} Td (${text}) Tj ET\n`;

function assemble(objects: string[], trailerExtra = ''): Buffer {
  let pdf = '%PDF-1.7\n%\xE2\xE3\xCF\xD3\n';
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const startxref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R ${trailerExtra}>>\nstartxref\n${startxref}\n%%EOF\n`;

  return Buffer.from(pdf, 'latin1');
}

export function syntheticPdf(): Buffer {
  const pageOneStream = contentStream(PAGE_ONE_TEXT, PAGE_ONE_ORIGIN.x, PAGE_ONE_ORIGIN.y);
  const pageTwoStream = contentStream(PAGE_TWO_TEXT, PAGE_TWO_ORIGIN.x, PAGE_TWO_ORIGIN.y);
  const fontRef = '/Font << /F1 5 0 R >>';

  return assemble([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 6 0 R] /Count 2 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [${PAGE_ONE_MEDIA_BOX.join(' ')}] ` +
      `/Resources << ${fontRef} >> /Contents 4 0 R >>`,
    `<< /Length ${Buffer.byteLength(pageOneStream)} >>\nstream\n${pageOneStream}endstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [${PAGE_TWO_MEDIA_BOX.join(' ')}] /Rotate 90 ` +
      `/Resources << ${fontRef} >> /Contents 7 0 R >>`,
    `<< /Length ${Buffer.byteLength(pageTwoStream)} >>\nstream\n${pageTwoStream}endstream`,
  ]);
}

/** One page of drawn marks only, so a reader must report "no text" rather than a parse failure. */
export function textlessPdf(): Buffer {
  const marks = '0.2 0.2 0.2 rg 40 40 200 120 re f\n';
  return assemble([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Resources << >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(marks)} >>\nstream\n${marks}endstream`,
  ]);
}

/** A valid header followed by truncated objects: no page tree survives. */
export function malformedPdf(): Buffer {
  return syntheticPdf().subarray(0, 300);
}

const PAD = Uint8Array.from([
  0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41, 0x64, 0x00, 0x4e, 0x56, 0xff, 0xfa, 0x01, 0x08,
  0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80, 0x2f, 0x0c, 0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a,
]);

const at = (bytes: Uint8Array, index: number): number => bytes[index] ?? 0;

function rc4(key: Uint8Array, input: Uint8Array): Uint8Array {
  const state = Uint8Array.from({ length: 256 }, (_, index) => index);
  for (let i = 0, j = 0; i < 256; i++) {
    j = (j + at(state, i) + at(key, i % key.length)) & 0xff;
    const swap = at(state, i);
    state[i] = at(state, j);
    state[j] = swap;
  }
  const output = new Uint8Array(input.length);
  for (let i = 0, j = 0, k = 0; k < input.length; k++) {
    i = (i + 1) & 0xff;
    j = (j + at(state, i)) & 0xff;
    const swap = at(state, i);
    state[i] = at(state, j);
    state[j] = swap;
    output[k] = at(input, k) ^ at(state, (at(state, i) + at(state, j)) & 0xff);
  }
  return output;
}

function digest(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(createHash('md5').update(bytes).digest());
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const joined = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    joined.set(part, offset);
    offset += part.length;
  }
  return joined;
}

function paddedPassword(password: string): Uint8Array {
  const raw = Buffer.from(password, 'latin1').subarray(0, 32);
  return concat(raw, PAD.subarray(0, 32 - raw.length));
}

const hex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');

/**
 * Standard security handler R2 (40-bit RC4, empty passwords), so pdfium opens the document but
 * reports it as encrypted. Exercises the encrypted-material boundary without a real document.
 */
export function encryptedPdf(): Buffer {
  const documentId = Uint8Array.from({ length: 16 }, (_, index) => index + 0x40);
  const userPassword = paddedPassword('');
  const owner = rc4(digest(paddedPassword('')).subarray(0, 5), userPassword);
  const permission = 0xfffffffc;
  const key = digest(
    concat(
      userPassword,
      owner,
      Uint8Array.from([
        permission & 0xff,
        (permission >> 8) & 0xff,
        (permission >> 16) & 0xff,
        (permission >>> 24) & 0xff,
      ]),
      documentId,
    ),
  ).subarray(0, 5);
  const user = rc4(key, PAD);
  const objectKey = digest(concat(key, Uint8Array.from([4, 0, 0, 0, 0]))).subarray(0, 10);
  const marks = 'BT /F1 12 Tf 40 40 Td (Encrypted until decrypted) Tj ET\n';
  const stream = Buffer.from(rc4(objectKey, Buffer.from(marks, 'latin1'))).toString('latin1');

  return assemble(
    [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] ' +
        '/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
      `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}endstream`,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
      `<< /Filter /Standard /V 1 /R 2 /O <${hex(owner)}> /U <${hex(user)}> /P -4 >>`,
    ],
    `/Encrypt 6 0 R /ID [<${hex(documentId)}> <${hex(documentId)}>] `,
  );
}

export function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
}
