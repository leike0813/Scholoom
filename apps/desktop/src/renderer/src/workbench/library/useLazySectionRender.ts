/**
 * 懒渲染 hook
 * 参考 Zotero itemPaneSectionElementBase：三段式 render/asyncRender/discard
 */
import { useEffect, useRef } from 'react';

export interface LazySection {
  id: string;
  render: () => void;
  asyncRender?: () => Promise<void>;
  discard: () => void;
}

export function useLazySectionRender(
  sections: LazySection[],
  containerRef: React.RefObject<HTMLElement | null>,
  activeSection: string,
) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const renderedSectionsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 创建 IntersectionObserver
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const sectionId = entry.target.getAttribute('data-section');
          if (!sectionId) return;

          const section = sections.find((s) => s.id === sectionId);
          if (!section) return;

          if (entry.isIntersecting) {
            // 进入视口：渲染
            if (!renderedSectionsRef.current.has(sectionId)) {
              section.render();
              renderedSectionsRef.current.add(sectionId);
              // 异步加载数据（限 500ms）
              if (section.asyncRender) {
                const timeoutId = setTimeout(() => {
                  console.warn(`Section ${sectionId} asyncRender timeout`);
                }, 500);
                void section.asyncRender().finally(() => clearTimeout(timeoutId));
              }
            }
          } else {
            // 离开视口：释放
            if (renderedSectionsRef.current.has(sectionId)) {
              section.discard();
              renderedSectionsRef.current.delete(sectionId);
            }
          }
        });
      },
      {
        root: container,
        rootMargin: '50px', // 提前 50px 加载
        threshold: 0,
      },
    );

    observerRef.current = observer;

    // 观察所有分区
    sections.forEach((section) => {
      const el = container.querySelector(`[data-section="${section.id}"]`);
      if (el) {
        observer.observe(el);
      }
    });

    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, [sections, containerRef]);

  // 活动分区切换时，强制渲染当前分区
  useEffect(() => {
    const section = sections.find((s) => s.id === activeSection);
    if (section && !renderedSectionsRef.current.has(activeSection)) {
      section.render();
      renderedSectionsRef.current.add(activeSection);
      if (section.asyncRender) {
        void section.asyncRender();
      }
    }
  }, [activeSection, sections]);
}
