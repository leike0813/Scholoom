import { type PointerEvent as ReactPointerEvent, useRef, useState } from 'react';

export interface PaneHandleProps {
  /** 手柄可访问名（如"调整左区宽度"）。 */
  label: string;
  /** separator 朝向：vertical 分隔左右（沿 x 拖拽），horizontal 分隔上下（沿 y 拖拽）。 */
  orientation: 'vertical' | 'horizontal';
  /** 额外类名（外壳用它指定网格列，如 pane-handle--left）。 */
  className?: string | undefined;
  /** 拖拽期间直接写入的 CSS 变量名。 */
  varName: string;
  value: number;
  defaultValue: number;
  /** 拖拽范围，取值来自 docs/ui-design/README.md 三区骨架一节。 */
  min: number;
  max: number;
  /** 指针位移方向系数：向左/上拖增大取 -1。 */
  sign: 1 | -1;
  /** 拖拽开始时评估，须为其余区域保留的像素（中心最小宽度 + 另一区当前宽度等）。 */
  reserve?: (() => number) | undefined;
  onChange: (value: number) => void;
}

/** 面板分隔手柄：pointer capture 期间只写 CSS 变量（高频 move 不碰 React 状态），落定才回写。 */
export function PaneHandle({
  label,
  orientation,
  className,
  varName,
  value,
  defaultValue,
  min,
  max,
  sign,
  reserve,
  onChange,
}: PaneHandleProps) {
  const [dragging, setDragging] = useState(false);
  const live = useRef(value);
  live.current = value;

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const handle = event.currentTarget;
    const shell = handle.closest('.shell');
    if (!(shell instanceof HTMLElement)) return;
    handle.setPointerCapture(event.pointerId);
    setDragging(true);
    const alongX = orientation === 'vertical';
    const start = alongX ? event.clientX : event.clientY;
    const startValue = live.current;
    const spare = reserve?.();
    const limit =
      spare === undefined
        ? max
        : Math.max(min, Math.min(max, shell.getBoundingClientRect().width - spare));
    const read = (move: globalThis.PointerEvent) => {
      const position = alongX ? move.clientX : move.clientY;
      return Math.min(limit, Math.max(min, startValue + sign * (position - start)));
    };
    const onMove = (move: globalThis.PointerEvent) => {
      shell.style.setProperty(varName, `${read(move)}px`);
    };
    const onUp = (up: globalThis.PointerEvent) => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);
      setDragging(false);
      onChange(read(up));
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
  };

  return (
    <hr
      className={`pane-handle pane-handle--${orientation}${className ? ` ${className}` : ''}${dragging ? ' pane-handle--active' : ''}`}
      aria-orientation={orientation}
      aria-label={label}
      onPointerDown={onPointerDown}
      onDoubleClick={() => onChange(defaultValue)}
    />
  );
}
