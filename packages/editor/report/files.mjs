import { closeSync, constants, fstatSync, openSync, readSync } from 'node:fs';
import { posix } from 'node:path';
import { OperationError } from '@scholoom/protocol/core';
import { reportLimits } from '@scholoom/protocol/reports';
import { decodeReportHeader, reportHeaderEnd, reportHeaderStart } from '../src/report-codec.js';

const refused = () => new OperationError('unavailable', '报告仅能加载批准的本地依赖。');

/** Runs only in P's frozen /resources view; this is not a host filesystem provider. */
export class ReportProgramFiles {
  constructor(entryPath) {
    if (!entryPath?.startsWith('/resources/') || /[\0\\?#]/.test(entryPath)) throw refused();
    const path = entryPath.slice('/resources/'.length);
    if (path.split('/').some((part) => !part || part === '.' || part === '..')) throw refused();
    this.entryURL = new URL(
      `scholoom-report://local/${path.split('/').map(encodeURIComponent).join('/')}`,
    ).href;
    this.loaded = 0;
    const entry = this.read(entryPath, reportLimits.entryBytes);
    this.html = new TextDecoder('utf-8', { fatal: true }).decode(entry);
    this.manifest = decodeReportHeader(this.html);
    this.html = this.html
      .slice(this.html.indexOf(reportHeaderEnd, reportHeaderStart.length) + reportHeaderEnd.length)
      .replace(/^\s*<!doctype\s[^>]*>/i, '');
    this.files = new Map();
    for (const item of this.manifest.resources) {
      if (
        /[\0\\?#]/.test(item.path) ||
        item.path.startsWith('/') ||
        /^[a-z][a-z\d+.-]*:/i.test(item.path)
      )
        throw refused();
      const resolved = posix.normalize(posix.join(posix.dirname(path), item.path));
      if (resolved === '..' || resolved.startsWith('../')) throw refused();
      const url = new URL(
        `scholoom-report://local/${resolved.split('/').map(encodeURIComponent).join('/')}`,
      );
      if (
        url.protocol !== 'scholoom-report:' ||
        url.host !== 'local' ||
        url.search ||
        url.hash ||
        this.files.has(url.href) ||
        url.href === this.entryURL
      )
        throw refused();
      const bytes = this.read(`/resources/${resolved}`, reportLimits.dependencyBytes);
      this.files.set(url.href, { bytes, mediaType: item.mediaType });
    }
  }

  read(path, limit) {
    const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const stat = fstatSync(fd);
      if (
        !stat.isFile() ||
        !Number.isSafeInteger(stat.size) ||
        stat.size > limit ||
        this.loaded + stat.size > reportLimits.loadBytes
      )
        throw new OperationError('resourceLimit', '报告加载集超过容量。');
      const bytes = Buffer.alloc(stat.size);
      let offset = 0;
      while (offset < bytes.length) {
        const count = readSync(fd, bytes, offset, bytes.length - offset, offset);
        if (count === 0) throw new OperationError('contentChanged', '冻结报告字节不完整。');
        offset += count;
      }
      if (fstatSync(fd).size !== stat.size)
        throw new OperationError('contentChanged', '冻结报告字节已变化。');
      this.loaded += bytes.length;
      return bytes;
    } finally {
      closeSync(fd);
    }
  }

  resolve(specifier, parent = this.entryURL) {
    const url = new URL(specifier, parent);
    if (!this.files.has(url.href)) throw refused();
    return url.href;
  }

  text(url, javascript = false) {
    const file = this.files.get(url);
    if (
      !file ||
      (javascript && !['text/javascript', 'application/javascript'].includes(file.mediaType))
    )
      throw refused();
    return new TextDecoder('utf-8', { fatal: true }).decode(file.bytes);
  }

  response(specifier) {
    const file = this.files.get(this.resolve(specifier));
    return new Response(Uint8Array.from(file.bytes), {
      headers: { 'content-type': file.mediaType },
    });
  }
}
