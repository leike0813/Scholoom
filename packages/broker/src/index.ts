import {
  type CallArguments,
  type CallContext,
  type ContractParams,
  type ContractResult,
  compileContract,
  type OperationContract,
  OperationError,
} from '@scholoom/protocol/core';

type Contracts = Readonly<Record<string, OperationContract>>;
type IncompatiblePayloads<
  C extends Contracts,
  P extends Record<keyof C, unknown>,
  R extends Record<keyof C, unknown>,
> =
  | Exclude<keyof P | keyof R, keyof C>
  | {
      [M in keyof C]: [P[M], R[M]] extends [ContractParams<C[M]>, ContractResult<C[M]>]
        ? [ContractParams<C[M]>, ContractResult<C[M]>] extends [P[M], R[M]]
          ? never
          : M
        : M;
    }[keyof C];
export type Handlers<P, R> = {
  [M in keyof P & keyof R]: (input: P[M], context: CallContext) => R[M] | Promise<R[M]>;
};
export class Broker<
  C extends Contracts,
  P extends Record<keyof C, unknown>,
  R extends Record<keyof C, unknown>,
> {
  // Keep schema and payloads invariant when an existing instance is assigned another type.
  declare protected readonly schemaBinding: (contracts: C, params: P, results: R) => [C, P, R];
  private readonly providers = new Map<
    keyof C,
    { owner: string; handler: (input: unknown, context: CallContext) => unknown }
  >();
  private readonly validators;
  constructor(
    private readonly contracts: C,
    ..._schemaBinding: [IncompatiblePayloads<C, P, R>] extends [never]
      ? []
      : [incompatiblePayloadTypes: never]
  ) {
    this.validators = new Map(
      Object.entries(contracts).map(([method, contract]) => [method, compileContract(contract)]),
    );
  }

  register<K extends keyof C>(
    owner: string,
    handlers: Pick<Handlers<P, R>, K>,
    ..._schemaBinding: [IncompatiblePayloads<C, P, R>] extends [never]
      ? []
      : [incompatiblePayloadTypes: never]
  ): void {
    const entries = Object.entries(handlers) as [K, Handlers<P, R>[K]][];
    for (const [method] of entries) {
      if (!Object.hasOwn(this.contracts, method))
        throw new OperationError('invalidRequest', '操作未声明。');
      if (this.providers.has(method))
        throw new OperationError('invalidRequest', '操作提供者重复。');
    }
    for (const [method, handler] of entries)
      this.providers.set(method, {
        owner,
        handler: handler as (input: unknown, context: CallContext) => unknown,
      });
  }

  available<K extends keyof C>(methods: readonly K[]): K[] {
    return methods.filter((method) => this.providers.has(method));
  }

  // Host-only binding: modules receive the returned port, never this registration object.
  consumer<K extends keyof C>(context: CallContext, methods: readonly K[]) {
    const allowed = new Set(methods);
    const trusted = Object.freeze({
      ...context,
      principal: Object.freeze({ ...context.principal }),
    });
    return {
      call: async <A extends CallArguments<P, K>>(...args: A): Promise<R[A[0]]> => {
        const [method, input] = args;
        trusted.signal?.throwIfAborted();
        if (!allowed.has(method))
          throw new OperationError('permissionDenied', '模块未获准消费该操作。');
        const provider = this.providers.get(method);
        if (!provider) throw new OperationError('unavailable', '操作提供者不可用。');
        const validation = this.validators.get(String(method));
        if (!validation?.params(input))
          throw new OperationError('invalidRequest', '操作参数不符合契约。');
        const result = await provider.handler(input, trusted);
        if (!validation.result(result))
          throw new OperationError(
            this.contracts[method]?.semantics.effect === 'write' ? 'outcomeUnknown' : 'unavailable',
            '操作结果不符合契约，请核查实际效果。',
          );
        return result as R[A[0]];
      },
    };
  }
}

export function eventChannel<const S extends OperationContract['params']>(schema: S) {
  type Event = ContractParams<{
    params: S;
    result: true;
    semantics: OperationContract['semantics'];
  }>;
  const validate = compileContract({ params: schema, result: true }).params;
  const listeners = new Set<(value: Event) => void>();
  return {
    subscribe(listener: (value: Event) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    publish(value: unknown): boolean {
      if (!validate(value)) return false;
      for (const listener of listeners) {
        try {
          listener(value as Event);
        } catch {
          /* Subscriber failure is local. */
        }
      }
      return true;
    },
  };
}
