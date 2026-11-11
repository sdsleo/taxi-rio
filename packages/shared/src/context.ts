import * as asyncHooks from 'async_hooks';

export interface IRequestContext {
  correlationId: string;
  traceId?: string;
  userId?: string;
}

class NoopAsyncLocalStorage<T> {
  private store?: T;
  getStore(): T | undefined {
    return this.store;
  }
  run<R>(store: T, callback: () => R): R {
    this.store = store;
    try {
      return callback();
    } finally {
      this.store = undefined;
    }
  }
}

const StorageConstructor =
  typeof asyncHooks?.AsyncLocalStorage === 'function'
    ? asyncHooks.AsyncLocalStorage
    : NoopAsyncLocalStorage;

export const requestContextStorage = new StorageConstructor<IRequestContext>();

export function getRequestContext(): IRequestContext | undefined {
  return requestContextStorage.getStore();
}

export function getCorrelationId(): string {
  const store = requestContextStorage.getStore();
  return store?.correlationId || 'no-correlation-id';
}
