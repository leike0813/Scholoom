import {
  createContext,
  type ReactNode,
  type RefObject,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

const MenuClose = createContext<() => void>(() => {});

/** 菜单内表单等自定义内容在成功后主动关闭菜单。 */
export function useMenuClose(): () => void {
  return useContext(MenuClose);
}

const focusable = (node: HTMLElement) => [
  ...node.querySelectorAll<HTMLElement>(
    '.menu__body button:not(:disabled), .menu__body input:not(:disabled), .menu__body select:not(:disabled)',
  ),
];

/** details 弹层通用行为：外点/Esc 关闭（Esc 不冒泡到宿主）、焦点进入与归还、方向键循环。 */
function useMenuBehavior(ref: RefObject<HTMLDetailsElement | null>) {
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const onToggle = () => {
      if (node.open) {
        requestAnimationFrame(() => {
          if (node.open) focusable(node)[0]?.focus();
        });
        return;
      }
      const active = document.activeElement;
      if (active instanceof HTMLElement && node.contains(active) && active.tagName !== 'SUMMARY')
        node.querySelector('summary')?.focus();
    };
    const onClick = (event: MouseEvent) => {
      if (node.open && !node.contains(event.target as Node)) node.open = false;
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && node.open) {
        event.stopPropagation();
        node.open = false;
        return;
      }
      if (!node.open || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) return;
      const target = event.target;
      if (!(target instanceof Node) || !node.contains(target)) return;
      const items = focusable(node);
      if (!items.length) return;
      event.preventDefault();
      const current = items.indexOf(document.activeElement as HTMLElement);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      items[(current + step + items.length) % items.length]?.focus();
    };
    node.addEventListener('toggle', onToggle);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      node.removeEventListener('toggle', onToggle);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [ref]);
}

/** 共享操作菜单：行尾 ⋯ 或文字触发，内容定位于触发处下方（menu--up 向上）。 */
export function Menu({
  label,
  summary,
  className = '',
  children,
}: {
  label: string;
  summary?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useMenuBehavior(ref);
  return (
    <details className={`menu${className ? ` ${className}` : ''}`} ref={ref}>
      <summary className="menu__toggle" aria-label={label}>
        {summary ?? '⋯'}
      </summary>
      <MenuClose.Provider
        value={() => {
          if (ref.current) ref.current.open = false;
        }}
      >
        <div className="menu__body">{children}</div>
      </MenuClose.Provider>
    </details>
  );
}

/** 右键/ContextMenu 键使用的受控菜单；视觉与条目行为复用共享 Menu 原语。 */
export function ContextMenu({
  label,
  position,
  onClose,
  returnFocus,
  trigger,
  children,
}: {
  label: string;
  position: { x: number; y: number };
  onClose: () => void;
  returnFocus?: RefObject<HTMLElement | null> | undefined;
  trigger?: RefObject<HTMLElement | null> | undefined;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const [frame, setFrame] = useState({ left: position.x, top: position.y, ready: false });

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    previousFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const place = () => {
      const rect = node.getBoundingClientRect();
      const margin = 8;
      const next = {
        left: Math.max(margin, Math.min(position.x, window.innerWidth - rect.width - margin)),
        top: Math.max(margin, Math.min(position.y, window.innerHeight - rect.height - margin)),
        ready: true,
      };
      setFrame((current) =>
        current.ready && current.left === next.left && current.top === next.top ? current : next,
      );
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(node);
    window.addEventListener('resize', place);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', place);
    };
  }, [position.x, position.y]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const focusTimer = requestAnimationFrame(() => focusable(node)[0]?.focus());
    const onPointer = (event: PointerEvent) => {
      if (!node.contains(event.target as Node) && !trigger?.current?.contains(event.target as Node))
        onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Tab') return;
      const items = focusable(node);
      if (!items.length) return;
      event.preventDefault();
      const current = items.indexOf(document.activeElement as HTMLElement);
      const step = event.key === 'ArrowUp' || (event.key === 'Tab' && event.shiftKey) ? -1 : 1;
      items[(current + step + items.length) % items.length]?.focus();
    };
    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('contextmenu', onPointer, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      cancelAnimationFrame(focusTimer);
      document.removeEventListener('pointerdown', onPointer, true);
      document.removeEventListener('contextmenu', onPointer, true);
      document.removeEventListener('keydown', onKey, true);
      const target = trigger?.current ?? returnFocus?.current ?? previousFocus.current;
      if (target && document.contains(target)) target.focus();
    };
  }, [onClose, returnFocus, trigger]);

  return (
    <MenuClose.Provider value={onClose}>
      <div
        ref={ref}
        className="menu context-menu"
        role="menu"
        aria-label={label}
        style={{ left: frame.left, top: frame.top, opacity: frame.ready ? 1 : 0 }}
      >
        <div className="menu__body">{children}</div>
      </div>
    </MenuClose.Provider>
  );
}

/** 菜单条目；onSelect 返回 false 时保持菜单打开（用于原地显示错误）。 */
export function MenuItem({
  onSelect,
  disabled,
  reason,
  children,
}: {
  onSelect?: () => unknown;
  disabled?: boolean;
  reason?: string | undefined;
  children: ReactNode;
}) {
  const close = useContext(MenuClose);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button
        type="button"
        className="menu__item"
        disabled={disabled || busy}
        aria-busy={busy || undefined}
        onClick={() => {
          void (async () => {
            setBusy(true);
            try {
              const result = await onSelect?.();
              if (result !== false) close();
            } finally {
              setBusy(false);
            }
          })();
        }}
      >
        {children}
      </button>
      {disabled && reason ? <p className="menu__hint">{reason}</p> : null}
    </>
  );
}

/** 菜单内的单步表单段；提交不自动关闭菜单，由调用方决定。 */
export function MenuFormItem({
  legend,
  onSubmit,
  children,
}: {
  legend: string;
  onSubmit: () => unknown;
  children: ReactNode;
}) {
  return (
    <form
      className="menu__form"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit();
      }}
    >
      <span className="menu__legend">{legend}</span>
      {children}
    </form>
  );
}

/** 共享确认呈现：说明实际后果，确认后执行；在菜单内时确认成功自动关闭，取消只退出确认。 */
export function ConfirmAction({
  description,
  confirmLabel,
  cancelLabel = '取消',
  onConfirm,
  onCancel,
  busy,
  className = '',
}: {
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => unknown;
  onCancel?: () => void;
  busy?: boolean;
  className?: string;
}) {
  const close = useContext(MenuClose);
  return (
    <div className={`confirm${className ? ` ${className}` : ''}`}>
      <p className="confirm__text">{description}</p>
      <div className="confirm__actions">
        <button
          type="button"
          className="btn"
          disabled={busy}
          aria-busy={busy || undefined}
          onClick={() => {
            void (async () => {
              try {
                const result = await onConfirm();
                if (result !== false) close();
              } catch {
                // 调用方在原地显示错误，菜单保持打开。
              }
            })();
          }}
        >
          {confirmLabel}
        </button>
        <button type="button" className="btn" onClick={() => (onCancel ? onCancel() : close())}>
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}
