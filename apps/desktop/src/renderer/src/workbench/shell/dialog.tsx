import { type ReactNode, useEffect, useRef } from 'react';

const focusableSelector =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** 工作台共享居中弹窗：Esc/backdrop 关闭，焦点限制在弹窗内并在关闭后归还。 */
export function Dialog({
  title,
  onClose,
  className = '',
  children,
}: {
  title: string;
  onClose: () => void;
  className?: string;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const node = panel.current;
    if (!node) return;
    const initial = node.querySelector<HTMLElement>('[data-dialog-autofocus]');
    (initial ?? node.querySelector<HTMLElement>(focusableSelector))?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = [...node.querySelectorAll<HTMLElement>(focusableSelector)];
      if (!items.length) return;
      const first = items[0];
      const last = items.at(-1);
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !node.contains(active))) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      const target = previousFocus.current;
      if (target && document.contains(target)) target.focus();
    };
  }, [onClose]);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop dismissal pattern
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        className={`dialog${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="dialog__header">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" aria-label={`关闭${title}`} onClick={onClose}>
            ×
          </button>
        </header>
        <div className="dialog__content">{children}</div>
      </div>
    </div>
  );
}
