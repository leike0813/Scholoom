import type { ResourceEvidence } from '../../packages/protocol/dist/resources.js';
import type { ModelServerOptions } from '../model-server.js';

/** External model boundary for synthetic 42/17 samples; no research-quality oracle. */
export function synthesisModelResponse(
  materials: () => readonly ResourceEvidence[],
): NonNullable<ModelServerOptions['respond']> {
  let answers = 0;
  return ({ calls }) => {
    if (!calls.length) answers = 0;
    const source = materials()[calls.filter((name) => name === 'read_context_resource').length];
    if (source)
      return {
        tool: {
          name: 'read_context_resource',
          input: {
            ref: source.ref,
            basis: source.basis,
            encoding: 'utf8',
            offset: 0,
            limit: 4096,
          },
        },
      };
    answers++;
    return {
      text: JSON.stringify(
        answers === 1
          ? {
              process: '形成比较维度：42与17来自各1个合成样本，不能推广。下一步比较。',
              next: 'synthesize',
            }
          : answers === 2
            ? {
                process: '比较：42比17大25，仅描述当前合成样本。',
                report:
                  '# 合成比较\n42与17相差25，均为单样本，不能推广。研究局限、材料覆盖和证据不足分别保留。',
                next: 'review',
              }
            : {
                process: '自查已核来源和25差值，保留单样本限制。尚无独立复核。',
                next: 'deliver',
              },
      ),
    };
  };
}
