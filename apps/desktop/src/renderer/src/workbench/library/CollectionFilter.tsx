/**
 * 集合筛选下拉组件
 */

import type { KernelClient } from '@scholoom/client';
import { useCallback, useEffect, useState } from 'react';

interface Collection {
  id: string;
  name: string;
}

interface CollectionFilterProps {
  client: KernelClient;
  enabled: boolean;
  selectedCollections: string[];
  onSelectionChange: (collections: string[]) => void;
}

export function CollectionFilter({
  client,
  enabled,
  selectedCollections,
  onSelectionChange,
}: CollectionFilterProps) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // 加载集合列表
  useEffect(() => {
    if (!enabled || !isOpen) return;
    setLoading(true);
    void client
      .call('library.collections', { offset: 0, limit: 100 })
      .then((result) => {
        setCollections(result.collections);
      })
      .catch(() => {
        setCollections([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [client, enabled, isOpen]);

  const toggleCollection = useCallback(
    (collectionId: string) => {
      if (selectedCollections.includes(collectionId)) {
        onSelectionChange(selectedCollections.filter((id) => id !== collectionId));
      } else {
        onSelectionChange([...selectedCollections, collectionId]);
      }
    },
    [selectedCollections, onSelectionChange],
  );

  const clearSelection = useCallback(() => {
    onSelectionChange([]);
  }, [onSelectionChange]);

  return (
    <div className="collection-filter">
      <button
        type="button"
        className="btn btn-sm collection-filter-toggle"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="筛选集合"
        aria-expanded={isOpen}
      >
        集合
        {selectedCollections.length > 0 && (
          <span className="collection-filter-badge">{selectedCollections.length}</span>
        )}
        <span className="dropdown-arrow">{isOpen ? '▲' : '▼'}</span>
      </button>
      {isOpen && (
        <div className="collection-filter-dropdown">
          {loading ? (
            <div className="collection-filter-loading">加载中...</div>
          ) : collections.length === 0 ? (
            <div className="collection-filter-empty">暂无集合</div>
          ) : (
            <>
              <div className="collection-filter-header">
                <span>选择集合</span>
                {selectedCollections.length > 0 && (
                  <button type="button" className="btn-link" onClick={clearSelection}>
                    清除
                  </button>
                )}
              </div>
              <div className="collection-filter-list">
                {collections.map((collection) => {
                  const isSelected = selectedCollections.includes(collection.id);
                  return (
                    <label key={collection.id} className="collection-filter-item">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleCollection(collection.id)}
                      />
                      <span className="collection-filter-name">{collection.name}</span>
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
