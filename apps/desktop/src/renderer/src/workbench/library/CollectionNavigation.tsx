import type { KernelClient } from '@scholoom/client';
import type { LibraryCollection } from '@scholoom/protocol';
import { useState } from 'react';
import { draftKey, readDraft, writeDraft } from '../drafts';
import { useLibraryRead } from './useLibraryRead';

interface NavigationProps {
  client: KernelClient;
  scope: string;
  enabled: boolean;
  revision: number;
  selectedId: string;
  onSelect: (id: string) => void;
}

function CollectionBranch({
  collection,
  ...props
}: NavigationProps & { collection: LibraryCollection }) {
  const key = draftKey(props.scope, 'expanded', collection.id);
  const [expanded, setExpanded] = useState(() => readDraft(key) === 'true');
  return (
    <li>
      <div className="collection-navigation-row">
        <button
          type="button"
          className="btn btn-sm"
          aria-expanded={expanded}
          aria-label={`${expanded ? '收起' : '展开'}集合 ${collection.name}`}
          onClick={() => {
            setExpanded(!expanded);
            writeDraft(key, String(!expanded));
          }}
        >
          {expanded ? '▾' : '▸'}
        </button>
        <button
          type="button"
          className="btn btn-sm"
          aria-current={props.selectedId === collection.id ? 'page' : undefined}
          onClick={() => props.onSelect(collection.id)}
        >
          {collection.name}
        </button>
      </div>
      {expanded && <CollectionLevel {...props} parentId={collection.id} />}
    </li>
  );
}

function CollectionLevel(props: NavigationProps & { parentId: string | null }) {
  const pageKey = draftKey(props.scope, 'collections', props.parentId ?? 'root');
  const [offset, setOffset] = useState(() => {
    const value = Number(readDraft(pageKey));
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
  });
  const result = useLibraryRead(
    `${pageKey}:${offset}:${props.enabled}`,
    props.enabled
      ? () =>
          props.client.call('library.collections', {
            parentId: props.parentId,
            offset,
            limit: 25,
          })
      : undefined,
    props.revision,
  );
  const page = (next: number) => {
    setOffset(next);
    writeDraft(pageKey, String(next));
  };
  return (
    <div>
      {result.error && (
        <p className="business-error" role="alert">
          {result.error}
        </p>
      )}
      <ul className="collection-navigation-list">
        {(props.enabled ? (result.value?.collections ?? []) : []).map((collection) => (
          <CollectionBranch key={collection.id} {...props} collection={collection} />
        ))}
      </ul>
      {props.enabled && result.value && !result.value.collections.length && (
        <p className="empty-hint">没有子集合</p>
      )}
      <div className="file-view-controls">
        {offset > 0 && (
          <button
            type="button"
            className="btn btn-sm"
            aria-label="上一页导航集合"
            onClick={() => page(Math.max(0, offset - 25))}
          >
            上一页
          </button>
        )}
        {result.value?.nextOffset !== undefined && (
          <button
            type="button"
            className="btn btn-sm"
            aria-label="下一页导航集合"
            onClick={() => page(result.value?.nextOffset ?? offset)}
          >
            下一页
          </button>
        )}
      </div>
    </div>
  );
}

export function CollectionNavigation(props: NavigationProps) {
  const key = draftKey(props.scope, 'navigation-collapsed');
  const [collapsed, setCollapsed] = useState(() => readDraft(key) === 'true');
  return (
    <nav aria-label="文献集合导航" className="collection-navigation">
      <button
        type="button"
        className="btn btn-sm"
        aria-expanded={!collapsed}
        onClick={() => {
          setCollapsed(!collapsed);
          writeDraft(key, String(!collapsed));
        }}
      >
        集合导航
      </button>
      {!collapsed && (
        <>
          <button
            type="button"
            className="btn"
            aria-current={!props.selectedId ? 'page' : undefined}
            onClick={() => props.onSelect('')}
          >
            全部题录
          </button>
          <CollectionLevel {...props} parentId={null} />
        </>
      )}
    </nav>
  );
}
