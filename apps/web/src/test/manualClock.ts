import type { FrameClock } from "../walk/walkingCamera";

/** A frame clock the test advances by hand, letting promises settle between frames. */
export class ManualClock implements FrameClock {
  now = 0;
  private next = 1;
  private readonly pending = new Map<number, (nowMs: number) => void>();

  request(callback: (nowMs: number) => void): number {
    const id = this.next++;
    this.pending.set(id, callback);
    return id;
  }

  cancel(handle: number): void {
    this.pending.delete(handle);
  }

  get waiting(): number {
    return this.pending.size;
  }

  /** Run frames `stepMs` apart for `ms` milliseconds. */
  async advance(ms: number, stepMs = 50): Promise<void> {
    await settle();
    for (let t = 0; t < ms; t += stepMs) {
      this.now += stepMs;
      const callbacks = [...this.pending.values()];
      this.pending.clear();
      for (const cb of callbacks) cb(this.now);
      await settle();
    }
  }
}

export async function settle(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}
