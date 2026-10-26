import type { ContextItem, ResourceDescriptor, ResourceRef } from '@scholoom/protocol';
import { type PointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useContextContribution } from './context-contributions';
import type { WorkbenchResourcePort } from './resource-controller';

type Region = Extract<ContextItem, { kind: 'region' }>['region'];
const fields = ['x', 'y', 'width', 'height'] as const;
const fieldNames = { x: '区域横坐标', y: '区域纵坐标', width: '区域宽度', height: '区域高度' };
const byteLimit = 8 * 1024 * 1024;
const chunkLimit = 256 * 1024;

function sameRef(left: ResourceRef, right: ResourceRef): boolean {
  return left.source === 'project'
    ? right.source === 'project' &&
        left.projectId === right.projectId &&
        left.fileId === right.fileId
    : right.source === 'library' &&
        left.attachmentId === right.attachmentId &&
        left.materialVersionId === right.materialVersionId;
}

export function ImageResourceView({
  resource,
  port,
  enabled,
  viewId,
}: {
  resource: ResourceDescriptor;
  port: WorkbenchResourcePort;
  enabled: boolean;
  viewId?: string | undefined;
}) {
  const { contributeSelection, appendContextItem, available, contextError } =
    useContextContribution();
  const [loaded, setLoaded] = useState<{
    resource: ResourceDescriptor;
    url: string;
    width: number;
    height: number;
  }>();
  const [error, setError] = useState('');
  const [region, setRegion] = useState<Region>();
  const [draft, setDraft] = useState(['0', '0', '1', '1']);
  const [regionError, setRegionError] = useState('');
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const drag = useRef<{ id: number; x: number; y: number } | undefined>(undefined);
  const active = enabled && loaded?.resource === resource;
  const selectRegion = (next: Region | undefined) => {
    setRegion(next);
    setRegionError('');
    if (next) setDraft(fields.map((field) => String(next[field])));
  };

  useEffect(() => {
    let generation = 0;
    let disposed = false;
    let ready = false;
    let url = '';
    let image: HTMLImageElement | undefined;
    const release = () => {
      ready = false;
      if (image) image.src = '';
      if (url) URL.revokeObjectURL(url);
      url = '';
    };
    setLoaded(undefined);
    setRegion(undefined);
    setError('');
    drag.current = undefined;
    const refresh = () => {
      const request = ++generation;
      const current = () => !disposed && request === generation;
      void (async () => {
        const extension = resource.name.split('.').at(-1)?.toLowerCase();
        const mime =
          extension === 'png'
            ? 'image/png'
            : extension === 'jpg' || extension === 'jpeg'
              ? 'image/jpeg'
              : extension === 'gif'
                ? 'image/gif'
                : extension === 'webp'
                  ? 'image/webp'
                  : '';
        if (!mime) throw new Error('仅支持 PNG、JPEG、GIF 和 WebP 图片。');
        const fresh = await port.describe(resource.ref);
        if (!current()) return;
        if (!sameRef(fresh.ref, resource.ref) || fresh.basis !== resource.basis)
          throw new Error('材料依据已变化，请重新打开资源。');
        if (!fresh.capabilities.read) throw new Error(fresh.unavailableReason || '无权读取图片。');
        setError('');
        if (ready) return;
        release();
        const chunks: Uint8Array<ArrayBuffer>[] = [];
        let offset = 0;
        let size: number | undefined;
        while (current()) {
          const part = await port.read({
            ref: resource.ref,
            basis: resource.basis,
            encoding: 'base64',
            offset,
            limit: chunkLimit,
          });
          if (!current()) return;
          if (!sameRef(part.ref, resource.ref) || part.basis !== resource.basis)
            throw new Error('图片读取依据已变化，请重新打开资源。');
          if (part.size > byteLimit) throw new Error('图片超过 8 MiB 读取上限。');
          if (
            part.unit !== 'byte' ||
            part.offset !== offset ||
            !Number.isSafeInteger(part.size) ||
            part.size <= 0 ||
            (size !== undefined && part.size !== size) ||
            part.data.length > Math.ceil(chunkLimit / 3) * 4
          )
            throw new Error('图片分片位置或大小无效。');
          size = part.size;
          const bytes = Uint8Array.from(atob(part.data), (character) => character.charCodeAt(0));
          const end = offset + bytes.length;
          if (
            !bytes.length ||
            bytes.length > chunkLimit ||
            end > size ||
            part.truncated ||
            (end < size ? part.nextOffset !== end : part.nextOffset !== undefined)
          )
            throw new Error('图片分片不完整或继续位置无效。');
          chunks.push(bytes);
          offset = end;
          if (end === size) break;
        }
        if (!current()) return;
        const blob = new Blob(chunks, { type: mime });
        const header = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
        if (!current()) return;
        const signature = (values: number[], start = 0) =>
          values.every((value, index) => header[start + index] === value);
        const raster =
          mime === 'image/png'
            ? signature([137, 80, 78, 71, 13, 10, 26, 10])
            : mime === 'image/jpeg'
              ? signature([255, 216, 255])
              : mime === 'image/gif'
                ? signature([71, 73, 70, 56]) &&
                  (header[4] === 55 || header[4] === 57) &&
                  header[5] === 97
                : signature([82, 73, 70, 70]) && signature([87, 69, 66, 80], 8);
        if (!raster) throw new Error('图片内容与受支持的栅格格式不符。');
        url = URL.createObjectURL(blob);
        image = new Image();
        image.src = url;
        await image.decode();
        if (!current()) return;
        if (
          !image.naturalWidth ||
          !image.naturalHeight ||
          image.naturalWidth * image.naturalHeight > 16_000_000
        )
          throw new Error('图片解码尺寸无效或超过 1600 万像素。');
        ready = true;
        setLoaded({ resource, url, width: image.naturalWidth, height: image.naturalHeight });
      })().catch((reason: unknown) => {
        if (!current()) return;
        release();
        setLoaded(undefined);
        setRegion(undefined);
        setError(reason instanceof Error ? reason.message : '图片读取或解码失败。');
      });
    };
    if (enabled) refresh();
    const unsubscribe = enabled ? port.subscribe(refresh) : undefined;
    return () => {
      disposed = true;
      unsubscribe?.();
      release();
    };
  }, [port, resource, enabled]);

  const item = useMemo<ContextItem | undefined>(
    () =>
      active && region
        ? {
            kind: 'region',
            itemId: crypto.randomUUID(),
            ref: resource.ref,
            basis: resource.basis,
            target: { kind: 'image' },
            region,
          }
        : undefined,
    [active, region, resource],
  );
  useEffect(() => {
    if (viewId) contributeSelection(viewId, item ? { selections: [item] } : undefined);
    return () => {
      if (viewId) contributeSelection(viewId);
    };
  }, [contributeSelection, viewId, item]);

  const point = (event: PointerEvent<HTMLElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - box.left) / box.width));
    const y = Math.max(0, Math.min(1, (event.clientY - box.top) / box.height));
    return rotation === 90
      ? { x: y, y: 1 - x }
      : rotation === 180
        ? { x: 1 - x, y: 1 - y }
        : rotation === 270
          ? { x: 1 - y, y: x }
          : { x, y };
  };
  const move = (event: PointerEvent<HTMLElement>) => {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    const end = point(event);
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);
    selectRegion(
      width > 0 && height > 0
        ? {
            x: Math.min(start.x, end.x),
            y: Math.min(start.y, end.y),
            width,
            height,
          }
        : undefined,
    );
  };

  if (!active || !loaded)
    return (
      <p role={error ? 'alert' : 'status'}>
        {error || (enabled ? '正在读取图片…' : '需连接内核。')}
      </p>
    );
  const width = loaded.width * zoom;
  const height = loaded.height * zoom;
  const sideways = rotation === 90 || rotation === 270;
  return (
    <section className="pdf-reader" aria-label={`图片 ${resource.name}`}>
      <div className="file-view-controls">
        <label>
          图片缩放
          <select
            aria-label="图片缩放"
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          >
            {[0.25, 0.5, 1, 1.5, 2].map((value) => (
              <option key={value} value={value}>
                {value * 100}%
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn"
          onClick={() => setRotation((value) => (value + 90) % 360)}
        >
          旋转图片
        </button>
        <button
          type="button"
          className="btn"
          disabled={!item || !available}
          onClick={() => {
            if (item) appendContextItem({ ...item, itemId: crypto.randomUUID() });
          }}
        >
          附加图片区域
        </button>
        <button
          type="button"
          className="btn"
          disabled={!region}
          onClick={() => selectRegion(undefined)}
        >
          清除图片选区
        </button>
      </div>
      <form
        className="file-view-controls"
        aria-label="图片区域坐标"
        onSubmit={(event) => {
          event.preventDefault();
          const [x = 0, y = 0, w = 0, h = 0] = draft.map((value) => Number(value));
          if (
            draft.some((value) => !value.trim()) ||
            ![x, y, w, h].every(Number.isFinite) ||
            x < 0 ||
            y < 0 ||
            w <= 0 ||
            h <= 0 ||
            x + w > 1 ||
            y + h > 1
          ) {
            setRegionError('区域须位于图片内，坐标范围为 0–1，宽高须大于 0。');
            return;
          }
          selectRegion({ x, y, width: w, height: h });
        }}
      >
        {fields.map((field, index) => (
          <label key={field}>
            {fieldNames[field]}
            <input
              type="number"
              aria-label={fieldNames[field]}
              min="0"
              max="1"
              step="any"
              required
              value={draft[index]}
              onChange={(event) =>
                setDraft((values) =>
                  values.map((value, i) => (i === index ? event.target.value : value)),
                )
              }
            />
          </label>
        ))}
        <button type="submit" className="btn">
          应用图片区域
        </button>
      </form>
      {(regionError || contextError) && <p role="alert">{regionError || contextError}</p>}
      <div style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
        {/* The outer box follows rotation; the inner image and overlay keep original coordinates. */}
        <fieldset
          aria-label="图片框选区域"
          style={{
            position: 'relative',
            width: sideways ? height : width,
            height: sideways ? width : height,
            border: 0,
            margin: 0,
            padding: 0,
            minWidth: 0,
            touchAction: 'none',
            cursor: 'crosshair',
            userSelect: 'none',
          }}
          onPointerDown={(event) => {
            if (event.button !== 0 || !event.isPrimary) return;
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = { id: event.pointerId, ...point(event) };
            selectRegion(undefined);
          }}
          onPointerMove={move}
          onPointerUp={(event) => {
            move(event);
            drag.current = undefined;
            if (event.currentTarget.hasPointerCapture(event.pointerId))
              event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={() => {
            drag.current = undefined;
            selectRegion(undefined);
          }}
          onLostPointerCapture={() => {
            drag.current = undefined;
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width,
              height,
              transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
              pointerEvents: 'none',
            }}
          >
            <img
              src={loaded.url}
              alt={resource.name}
              draggable={false}
              width={loaded.width}
              height={loaded.height}
              style={{ display: 'block', width: '100%', height: '100%' }}
            />
            {region && (
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  boxSizing: 'border-box',
                  left: `${region.x * 100}%`,
                  top: `${region.y * 100}%`,
                  width: `${region.width * 100}%`,
                  height: `${region.height * 100}%`,
                  outline: 'calc(var(--space-unit) / 2) solid var(--accent)',
                  background: 'var(--diff-add-bg)',
                }}
              />
            )}
          </div>
        </fieldset>
      </div>
    </section>
  );
}
