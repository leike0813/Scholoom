import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  createStatusBarService,
  type StatusBarAction,
  type StatusBarHandle,
  type StatusBarItem,
  type StatusBarService,
} from './statusbar';

const StatusBarContext = createContext<StatusBarService | null>(null);

export function StatusBarProvider({ children }: { children: ReactNode }) {
  const [service] = useState(createStatusBarService);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      // StrictMode 的同步重挂继续使用同一实例；实际卸载后终结外部贡献句柄。
      queueMicrotask(() => {
        if (!mounted.current) service.dispose();
      });
    };
  }, [service]);
  return <StatusBarContext.Provider value={service}>{children}</StatusBarContext.Provider>;
}

export function useStatusBar(): StatusBarService {
  const service = useContext(StatusBarContext);
  if (!service) throw new Error('状态栏贡献需要位于 StatusBarProvider 内。');
  return service;
}

/** 同一 owner/id 在组件存续期间保持句柄；更新与激活使用本次提交的最新值。 */
export function useStatusBarItem(
  owner: string,
  item: StatusBarItem | undefined,
  activate?: StatusBarAction,
) {
  const service = useStatusBar();
  const registration = useRef<{ owner: string; id: string; handle: StatusBarHandle } | null>(null);
  const action = useRef(activate);
  const dispatch = useCallback(() => action.current?.(), []);

  useLayoutEffect(() => {
    action.current = activate;
    const current = registration.current;
    if (current && (current.owner !== owner || current.id !== item?.id)) {
      current.handle.dispose();
      registration.current = null;
    }
    if (!item) return;
    if (!registration.current) {
      registration.current = {
        owner,
        id: item.id,
        handle: service.registerItem(owner, item, activate ? dispatch : undefined),
      };
    } else {
      registration.current.handle.update(
        {
          ...item,
          alignment: item.alignment,
          priority: item.priority,
          icon: item.icon,
          tooltip: item.tooltip,
          ariaLabel: item.ariaLabel,
          tone: item.tone,
          announce: item.announce,
        },
        activate ? dispatch : null,
      );
    }
  });
  useLayoutEffect(
    () => () => {
      registration.current?.handle.dispose();
      registration.current = null;
    },
    [],
  );
}
