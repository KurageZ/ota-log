export type RepositoryChangeListener = () => void;

/** Small observable used by repositories that need to invalidate UI or widget projections. */
export class RepositoryChangeEmitter {
  private readonly listeners = new Set<RepositoryChangeListener>();

  readonly subscribe = (listener: RepositoryChangeListener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  notify(): void {
    for (const listener of this.listeners) listener();
  }
}
