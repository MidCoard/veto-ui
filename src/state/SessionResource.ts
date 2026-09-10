/** A snapshot has one request owner, regardless of how many panels observe it. */
export interface ResourceSnapshot<T> {
  data: T | null;
  loading: boolean;
  stale: boolean;
  error: unknown;
}

export class SessionResource<T> {
  private snapshot: ResourceSnapshot<T> = { data: null, loading: true, stale: true, error: null };
  private listeners = new Set<() => void>();
  private generation = 0;
  private applied = -1;
  private request: AbortController | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  constructor(private readonly fetch: (signal: AbortSignal) => Promise<T>) {}

  getSnapshot = (): ResourceSnapshot<T> => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    if (this.applied !== this.generation) void this.load();
    return () => {
      this.listeners.delete(listener);
      if (!this.observed) {
        this.request?.abort();
        this.request = null;
        if (this.timer !== null) { clearTimeout(this.timer); this.timer = null; }
      }
    };
  };

  get observed(): boolean { return this.listeners.size > 0; }

  invalidate = (): void => {
    if (this.disposed) return;
    this.generation += 1;
    if (!this.snapshot.stale) this.update({ ...this.snapshot, stale: true });
    this.schedule();
  };

  private schedule(): void {
    if (!this.observed || this.request !== null || this.timer !== null || this.disposed) return;
    this.timer = setTimeout(() => { this.timer = null; void this.load(); }, 250);
  }

  private update(snapshot: ResourceSnapshot<T>): void {
    this.snapshot = snapshot;
    this.listeners.forEach(listener => listener());
  }

  private async load(): Promise<void> {
    if (this.disposed || !this.observed || this.request !== null) return;
    if (this.timer !== null) { clearTimeout(this.timer); this.timer = null; }
    const controller = new AbortController();
    const generation = this.generation;
    this.request = controller;
    this.update({ ...this.snapshot, loading: this.snapshot.data === null, error: null });
    try {
      const data = await this.fetch(controller.signal);
      if (this.disposed || controller.signal.aborted) return;
      this.applied = generation;
      this.update({ data, loading: false, stale: generation !== this.generation, error: null });
    } catch (error) {
      if (!this.disposed && !controller.signal.aborted) {
        this.update({ ...this.snapshot, loading: false, stale: true, error });
      }
    } finally {
      if (this.request === controller) {
        this.request = null;
        // Only a new invalidation retries a failed request, never the failure itself.
        if (generation !== this.generation) this.schedule();
      }
    }
  }

  dispose(): void {
    this.disposed = true;
    this.request?.abort();
    if (this.timer !== null) clearTimeout(this.timer);
    this.listeners.clear();
  }
}
