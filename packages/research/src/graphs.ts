import { compileContract, OperationError } from '@scholoom/protocol/core';
import {
  type ResearchGraph,
  type ResearchInputs,
  type ResearchOutputs,
  researchGraphSchema,
  researchOperations,
} from '@scholoom/protocol/research';

const descriptionContract = compileContract({ params: researchGraphSchema, result: true });
const pageContract = compileContract(researchOperations['research.graphs']);
const responseLimit = 512 * 1024;

export class ResearchGraphs {
  private readonly entries = new Map<
    string,
    Map<string, { graph: ResearchGraph; validate: ReturnType<typeof compileContract>['params'] }>
  >();
  constructor(descriptions: readonly ResearchGraph[] = []) {
    for (const value of descriptions) {
      if (!descriptionContract.params(value))
        throw new OperationError('invalidRequest', '科研图描述不符合契约。');
      const graph = structuredClone(value);
      if (Buffer.byteLength(JSON.stringify(graph)) > responseLimit)
        throw new OperationError('tooLarge', '科研图描述过大。');
      const versions = this.entries.get(graph.definition.graphId) ?? new Map();
      if (versions.has(graph.definition.version))
        throw new OperationError('invalidRequest', '科研图身份和版本重复。');
      versions.set(graph.definition.version, {
        graph,
        validate: compileContract({ params: graph.definition.configSchema, result: true }).params,
      });
      this.entries.set(graph.definition.graphId, versions);
    }
  }

  discover(input: ResearchInputs['research.graphs'] = {}): ResearchOutputs['research.graphs'] {
    if (!pageContract.params(input))
      throw new OperationError('invalidRequest', '科研图分页参数无效。');
    const offset = input.offset ?? 0;
    const all = [...this.entries.values()].flatMap((versions) =>
      [...versions.values()].map(({ graph }) => graph),
    );
    const descriptions: ResearchGraph[] = [];
    for (const graph of all.slice(offset, offset + (input.limit ?? 25))) {
      if (
        Buffer.byteLength(
          JSON.stringify({
            descriptions: [...descriptions, graph],
            nextOffset: offset + descriptions.length + 1,
          }),
        ) > responseLimit
      )
        break;
      descriptions.push(graph);
    }
    if (!descriptions.length && offset < all.length)
      throw new OperationError('tooLarge', '科研图描述超出响应上限。');
    return structuredClone({
      descriptions,
      ...(offset + descriptions.length < all.length
        ? { nextOffset: offset + descriptions.length }
        : {}),
    });
  }

  describe(input: ResearchInputs['research.graph']): ResearchGraph {
    const entry = this.entries.get(input.graphId)?.get(input.version);
    if (!entry) throw new OperationError('notFound', '科研图或指定版本不存在。');
    return structuredClone(entry.graph);
  }

  select(graphId: string, version: string, config: Record<string, unknown>): ResearchGraph {
    const graph = this.describe({ graphId, version });
    if (!this.entries.get(graphId)?.get(version)?.validate(config))
      throw new OperationError('invalidRequest', '科研图配置不符合声明。');
    return graph;
  }
}
