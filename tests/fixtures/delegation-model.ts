import type { DelegationRequest, ResourceEvidence } from '../../packages/protocol/dist/index.js';
import { createModelServer, type ModelServer } from '../model-server.js';

function output(body: Record<string, unknown>, name: string): Record<string, any> | undefined {
  const messages = body.messages as Array<{ role: string; content: unknown }>;
  let toolId: string | undefined;
  let result: Record<string, any> | undefined;
  for (const message of messages) {
    if (!Array.isArray(message.content)) continue;
    for (const block of message.content) {
      if (block.type === 'tool_use' && block.name === name) toolId = block.id;
      if (toolId && block.type === 'tool_result' && block.tool_use_id === toolId) {
        const content =
          typeof block.content === 'string'
            ? block.content
            : block.content?.find((item: { type: string }) => item.type === 'text')?.text;
        try {
          result = JSON.parse(content);
        } catch {
          /* A non-JSON SDK result is not a resource receipt. */
        }
      }
    }
  }
  return result;
}

export { output as delegationOutput };

/** Only the external model is scripted; tool calls still cross actual workers and owners. */
export async function delegationModel(
  request: DelegationRequest,
  options: {
    childHold?: boolean;
    forbiddenWrite?: boolean;
    childMissing?: boolean;
    parentExit?: boolean;
    repeat?: boolean;
    conflict?: boolean;
    beforeChild?: () => void;
  } = {},
): Promise<ModelServer> {
  let heldChild = false;
  const model = await createModelServer({
    respond: ({ user, calls }) => {
      const body = model.requests.at(-1)!;
      if (user.includes('PARENT_DELEGATION')) {
        if (!calls.includes('delegate_agent'))
          return { tool: { name: 'delegate_agent', input: request } };
        if (
          (options.repeat || options.conflict) &&
          calls.filter((name) => name === 'delegate_agent').length === 1
        )
          return {
            tool: {
              name: 'delegate_agent',
              input: options.conflict
                ? {
                    ...request,
                    workPackage: {
                      ...request.workPackage,
                      requirements: 'Different work under the same identity',
                    },
                  }
                : request,
            },
          };
        if (options.parentExit) return { text: 'Parent is finished; owned child must stop.' };
        const waited = output(body, 'wait_delegation');
        if (!waited || ['accepted', 'running', 'cancelling'].includes(waited.delegation?.state))
          return {
            tool: {
              name: 'wait_delegation',
              input: { delegationId: request.delegationId, waitMs: 5000 },
            },
          };
        if (waited.delegation?.artifacts?.length && !calls.includes('read_context_resource')) {
          const resource = waited.delegation.artifacts[0].resource;
          return {
            tool: {
              name: 'read_context_resource',
              input: { ref: resource.ref, basis: resource.basis, encoding: 'utf8' },
            },
          };
        }
        return { text: 'Parent checked the actual delegation outcome.' };
      }
      if (user.includes('CHILD_DELEGATION')) {
        if (!calls.length) options.beforeChild?.();
        if (options.childHold && !heldChild) {
          heldChild = true;
          model.hold = true;
        }
        if (options.forbiddenWrite && !calls.includes('write_file'))
          return {
            tool: { name: 'write_file', input: { file_path: '/input.md', content: 'FORBIDDEN' } },
          };
        if (options.childMissing) return { text: 'No report was saved.' };
        const material = request.workPackage.materials[0]!;
        if (!calls.includes('read_context_resource'))
          return {
            tool: {
              name: 'read_context_resource',
              input: { ref: material.ref, basis: material.basis, encoding: 'utf8' },
            },
          };
        const read = output(body, 'read_context_resource');
        if (read?.error && !calls.includes('report_delegation'))
          return {
            tool: {
              name: 'report_delegation',
              input: {
                findings: '',
                unfinished: 'Material was not read.',
                blockers: read.error.code,
                artifacts: [],
              },
            },
          };
        if (read?.error) return { text: 'Material access failed; no report file was created.' };
        if (!calls.includes('create_delegation_resource'))
          return {
            tool: {
              name: 'create_delegation_resource',
              input: {
                projectId: (material.ref as { projectId: string }).projectId,
                path: 'report.md',
                operationId: 'delegation-report-create',
                content: '# Report\n\nObserved 42 from the original material.\n',
              },
            },
          };
        if (!calls.includes('report_delegation')) {
          const saved = output(body, 'create_delegation_resource');
          const artifacts: ResourceEvidence[] = saved?.resource
            ? [{ ref: saved.resource.ref, basis: saved.resource.basis }]
            : [];
          return {
            tool: {
              name: 'report_delegation',
              input: {
                findings: 'Observed 42.',
                unfinished: artifacts.length ? '' : 'No confirmed file.',
                blockers: '',
                artifacts,
              },
            },
          };
        }
        return { text: 'Child completed.' };
      }
      return { text: 'No delegation request.' };
    },
  });
  return model;
}
