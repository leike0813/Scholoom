import {
  type CslMetadata,
  catalogEditorDates,
  catalogEditorFields,
  catalogEditorRoles,
  catalogEditorTypes,
} from '@scholoom/protocol';
import { type Ref, useId } from 'react';
import { editCatalogField, moveCatalogCreator } from './catalog-metadata';

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export function CatalogItemForm({
  value,
  onChange,
  prefix = '题录',
  titleRef,
}: {
  value: string;
  onChange: (value: string) => void;
  prefix?: string;
  titleRef?: Ref<HTMLInputElement>;
}) {
  const formId = useId();
  let metadata: CslMetadata;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!record(parsed) || typeof parsed.title !== 'string') throw new Error();
    metadata = parsed as CslMetadata;
  } catch {
    return <p role="status">请先在 CSL JSON 中检查题录格式，原草稿已保留。</p>;
  }
  const update = (key: string, next: unknown) =>
    onChange(JSON.stringify(editCatalogField(metadata, key, next), null, 2));
  const name = (label: string) => `${prefix}${label}`;
  const type = typeof metadata.type === 'string' ? metadata.type : '';
  const changeCreator = (role: string, index: number, field: string, next: string) => {
    const creators = metadata[role];
    if (!Array.isArray(creators) || !record(creators[index])) return;
    update(
      role,
      creators.map((creator, position) =>
        position === index ? { ...creator, [field]: next } : creator,
      ),
    );
  };
  return (
    <div className="metadata-edit-form">
      <label>
        类型（CSL）
        <select
          aria-label={name('类型')}
          value={type}
          onChange={(event) => update('type', event.target.value)}
        >
          <option value="">未指定</option>
          {type && !catalogEditorTypes.some(([id]) => id === type) && (
            <option value={type}>{type}</option>
          )}
          {catalogEditorTypes.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {catalogEditorFields.map((field) => {
        const current = metadata[field.key];
        const applicable = !field.types || field.types.includes(type);
        if (!applicable && current === undefined) return null;
        if (!applicable || (current !== undefined && typeof current !== 'string'))
          return (
            <p key={field.key}>
              {field.label}：{JSON.stringify(current)}（保留原值，可在JSON中编辑）
            </p>
          );
        return (
          <label key={field.key} htmlFor={`${formId}-${field.key}`}>
            {field.label}
            {field.key === 'abstract' ? (
              <textarea
                id={`${formId}-${field.key}`}
                aria-label={name(field.label)}
                value={current ?? ''}
                rows={3}
                onChange={(event) => update(field.key, event.target.value)}
              />
            ) : (
              <input
                id={`${formId}-${field.key}`}
                ref={field.key === 'title' ? titleRef : undefined}
                aria-label={name(field.label)}
                value={current ?? ''}
                onChange={(event) => update(field.key, event.target.value)}
              />
            )}
          </label>
        );
      })}
      {catalogEditorDates.map(([key, label]) => {
        const date = metadata[key];
        const editable =
          date === undefined ||
          (record(date) &&
            typeof date.literal === 'string' &&
            !('date-parts' in date) &&
            !('raw' in date));
        if (!editable)
          return (
            <p key={key}>
              {label}：{JSON.stringify(date)}（保留原值，可在JSON中编辑）
            </p>
          );
        return (
          <label key={key}>
            {label}原文
            <input
              aria-label={name(`${label}原文`)}
              value={record(date) ? String(date.literal) : ''}
              onChange={(event) =>
                update(key, { ...(record(date) ? date : {}), literal: event.target.value })
              }
            />
          </label>
        );
      })}
      <details>
        <summary>创建者</summary>
        {catalogEditorRoles.map(([role, label]) => {
          const creators = metadata[role];
          if (creators !== undefined && !Array.isArray(creators))
            return (
              <p key={role}>
                {label}：{JSON.stringify(creators)}（保留原值，可在JSON中编辑）
              </p>
            );
          return (
            <fieldset key={role}>
              <legend>{label}</legend>
              {(creators ?? []).slice(0, 100).map((creator: unknown, index: number) => {
                const labelPrefix = name(`${label}${index + 1}`);
                const fields =
                  record(creator) && typeof creator.literal === 'string'
                    ? ['literal']
                    : ['family', 'given'];
                if (
                  !record(creator) ||
                  fields.some(
                    (field) => creator[field] !== undefined && typeof creator[field] !== 'string',
                  )
                )
                  // biome-ignore lint/suspicious/noArrayIndexKey: CSL names have no IDs; these rows have no local state.
                  return <p key={index}>{JSON.stringify(creator)}（保留原值，可在JSON中编辑）</p>;
                return (
                  // biome-ignore lint/suspicious/noArrayIndexKey: CSL names have no IDs; all inputs are controlled by the full draft.
                  <div key={index} className="metadata-edit-form">
                    {fields.map((field) => (
                      <label key={field}>
                        {field === 'literal'
                          ? '机构／单字段姓名'
                          : field === 'family'
                            ? '姓'
                            : '名'}
                        <input
                          aria-label={`${labelPrefix}${field}`}
                          value={String(creator[field] ?? '')}
                          onChange={(event) =>
                            changeCreator(role, index, field, event.target.value)
                          }
                        />
                      </label>
                    ))}
                    <label>
                      角色
                      <select
                        aria-label={`${labelPrefix}角色`}
                        value={role}
                        onChange={(event) =>
                          onChange(
                            JSON.stringify(
                              moveCatalogCreator(metadata, role, index, event.target.value),
                              null,
                              2,
                            ),
                          )
                        }
                      >
                        {catalogEditorRoles.map(([id, roleLabel]) => (
                          <option
                            key={id}
                            value={id}
                            disabled={metadata[id] !== undefined && !Array.isArray(metadata[id])}
                          >
                            {roleLabel}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="file-view-controls">
                      <button
                        type="button"
                        className="btn btn-sm"
                        aria-label={`${labelPrefix}上移`}
                        disabled={index === 0}
                        onClick={() =>
                          onChange(
                            JSON.stringify(
                              moveCatalogCreator(metadata, role, index, role, index - 1),
                              null,
                              2,
                            ),
                          )
                        }
                      >
                        上移
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm"
                        aria-label={`${labelPrefix}下移`}
                        disabled={index === (creators?.length ?? 0) - 1}
                        onClick={() =>
                          onChange(
                            JSON.stringify(
                              moveCatalogCreator(metadata, role, index, role, index + 1),
                              null,
                              2,
                            ),
                          )
                        }
                      >
                        下移
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm"
                        aria-label={`${labelPrefix}移除`}
                        onClick={() =>
                          update(
                            role,
                            creators?.filter((_: unknown, position: number) => position !== index),
                          )
                        }
                      >
                        移除
                      </button>
                    </div>
                  </div>
                );
              })}
              {Array.isArray(creators) && creators.length > 100 && (
                <p>仅显示前100位，完整名单可在JSON中编辑。</p>
              )}
              <div className="file-view-controls">
                <button
                  type="button"
                  className="btn btn-sm"
                  aria-label={name(`添加${label}`)}
                  disabled={(creators?.length ?? 0) >= 100}
                  onClick={() => update(role, [...(creators ?? []), { family: '', given: '' }])}
                >
                  添加个人
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  aria-label={name(`添加机构${label}`)}
                  disabled={(creators?.length ?? 0) >= 100}
                  onClick={() => update(role, [...(creators ?? []), { literal: '' }])}
                >
                  添加机构
                </button>
              </div>
            </fieldset>
          );
        })}
      </details>
    </div>
  );
}
