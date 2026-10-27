import {
  type CslMetadata,
  catalogEditorDates,
  catalogEditorFields,
  catalogEditorNumericDate,
  catalogEditorRoles,
  catalogEditorTypes,
} from '@scholoom/protocol';
import { type Ref, useId, useState } from 'react';
import {
  catalogDateCirca,
  catalogDateParts,
  editCatalogDateCirca,
  editCatalogDatePart,
  editCatalogField,
  moveCatalogCreator,
  removeCatalogDateEnd,
} from './catalog-metadata';

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
  const [dateModes, setDateModes] = useState<Record<string, 'literal' | 'parts'>>({});
  const [dateError, setDateError] = useState<{ key: string; basis: string; message: string }>();
  let metadata: CslMetadata;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!record(parsed) || typeof parsed.title !== 'string') throw new Error();
    metadata = parsed as CslMetadata;
  } catch {
    return <p role="status">请先在 CSL JSON 中检查题录格式，原草稿已保留。</p>;
  }
  const update = (key: string, next: unknown) => {
    setDateError(undefined);
    onChange(JSON.stringify(editCatalogField(metadata, key, next), null, 2));
  };
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
        const parts = catalogDateParts(date);
        const editable =
          date === undefined ||
          (record(date) &&
            typeof date.literal === 'string' &&
            !('date-parts' in date) &&
            !('raw' in date));
        if (!editable && !parts)
          return (
            <p key={key}>
              {label}：{JSON.stringify(date)}（保留原值，可在JSON中编辑）
            </p>
          );
        const mode = parts
          ? 'parts'
          : date === undefined
            ? (dateModes[key] ?? 'literal')
            : 'literal';
        const circa = catalogDateCirca(date);
        const dateInputs = (endpoint: number) =>
          catalogEditorNumericDate.parts.map(({ label: part, min, max }, index) => (
            <label key={part}>
              {part}
              <input
                type="number"
                min={min}
                max={max}
                step={1}
                aria-label={name(`${label}${endpoint === 1 ? '结束' : ''}${part}`)}
                value={parts?.[endpoint]?.[index] ?? ''}
                disabled={
                  (endpoint === 1 && !parts?.[0]?.length) ||
                  index > (parts?.[endpoint]?.length ?? 0)
                }
                onChange={(event) => {
                  const next = event.currentTarget.validity.badInput
                    ? metadata
                    : editCatalogDatePart(metadata, key, index, event.target.value, endpoint);
                  if (next === metadata) {
                    setDateError({
                      key,
                      basis: value,
                      message: '未采用该输入；请使用范围内整数并保持连续精度，原日期草稿已保留。',
                    });
                    return;
                  }
                  setDateError(undefined);
                  onChange(JSON.stringify(next, null, 2));
                }}
              />
            </label>
          ));
        return (
          <fieldset key={key}>
            <legend>{label}</legend>
            <label>
              表达
              <select
                aria-label={name(`${label}表达`)}
                value={mode}
                disabled={date !== undefined}
                onChange={(event) =>
                  setDateModes((current) => ({
                    ...current,
                    [key]: event.target.value as 'literal' | 'parts',
                  }))
                }
              >
                <option value="literal">原文</option>
                <option value="parts">年月日</option>
              </select>
            </label>
            {mode === 'literal' ? (
              <label>
                {label}原文
                <input
                  aria-label={name(`${label}原文`)}
                  value={record(date) ? String(date.literal) : ''}
                  onChange={(event) => {
                    if (!event.target.value && (!record(date) || Object.keys(date).length === 1))
                      update(key, '');
                    else
                      update(key, { ...(record(date) ? date : {}), literal: event.target.value });
                  }}
                />
              </label>
            ) : (
              <>
                {dateInputs(0)}
                <details open={parts?.length === 2}>
                  <summary>结束日期</summary>
                  {dateInputs(1)}
                  <button
                    type="button"
                    className="btn btn-sm"
                    aria-label={name(`移除${label}结束日期`)}
                    disabled={parts?.length !== 2}
                    onClick={() => {
                      setDateError(undefined);
                      onChange(JSON.stringify(removeCatalogDateEnd(metadata, key), null, 2));
                    }}
                  >
                    移除结束日期
                  </button>
                </details>
                {circa === undefined ? (
                  <p>
                    约略标记：{JSON.stringify(record(date) ? date.circa : undefined)}
                    （保留原值，可在JSON中编辑）
                  </p>
                ) : (
                  <label>
                    约略标记
                    <select
                      aria-label={name(`${label}约略标记`)}
                      value={circa}
                      disabled={!parts}
                      onChange={(event) => {
                        setDateError(undefined);
                        onChange(
                          JSON.stringify(
                            editCatalogDateCirca(metadata, key, event.target.value),
                            null,
                            2,
                          ),
                        );
                      }}
                    >
                      <option value="unset">未指定</option>
                      <option value="true">约略</option>
                      <option value="false">非约略</option>
                    </select>
                  </label>
                )}
              </>
            )}
            {dateError?.key === key && dateError.basis === value && (
              <p role="alert">{dateError.message}</p>
            )}
            <button
              type="button"
              className="btn btn-sm"
              aria-label={name(`清除${label}`)}
              disabled={date === undefined}
              onClick={() => update(key, '')}
            >
              清除日期
            </button>
          </fieldset>
        );
      })}
      <details>
        <summary>创建者</summary>
        {catalogEditorRoles.map(([role, label, types]) => {
          const creators = metadata[role];
          if (types && !types.includes(type))
            return creators === undefined ? null : (
              <p key={role}>
                {label}：{JSON.stringify(creators)}（保留原值，可在JSON中编辑）
              </p>
            );
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
                        {catalogEditorRoles
                          .filter(
                            ([id, , roleTypes]) =>
                              id === role || !roleTypes || roleTypes.includes(type),
                          )
                          .map(([id, roleLabel]) => (
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
                  添加机构／单名
                </button>
              </div>
            </fieldset>
          );
        })}
      </details>
    </div>
  );
}
