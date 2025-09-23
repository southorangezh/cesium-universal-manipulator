const DEFAULT_SAMPLE_SIZE = 120;

function defaultNow() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function defaultMemory() {
  if (typeof performance !== 'undefined' && performance && performance.memory) {
    const value = performance.memory.usedJSHeapSize;
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

function createListener(monitor) {
  return () => monitor._recordFrame();
}

export class PerformanceMonitor {
  constructor(options = {}) {
    const { viewer, scene, sampleSize = DEFAULT_SAMPLE_SIZE, now, memory } = options;
    this.viewer = viewer ?? null;
    this.scene = scene ?? this.viewer?.scene ?? null;
    this.sampleSize = sampleSize;
    this._now = typeof now === 'function' ? now : defaultNow;
    this._memory = typeof memory === 'function' ? memory : defaultMemory;
    this._frames = [];
    this._memorySamples = [];
    this._listening = false;
    this._listener = createListener(this);
    this._lastTime = null;
  }

  start() {
    const event = this.scene?.postRender;
    if (!event || this._listening || typeof event.addEventListener !== 'function') {
      return;
    }
    this.reset();
    event.addEventListener(this._listener);
    this._listening = true;
  }

  stop() {
    const event = this.scene?.postRender;
    if (event && this._listening && typeof event.removeEventListener === 'function') {
      event.removeEventListener(this._listener);
    }
    this._listening = false;
    this._lastTime = null;
  }

  reset() {
    this._frames.length = 0;
    this._memorySamples.length = 0;
    this._lastTime = null;
  }

  markFrame() {
    this._recordFrame();
  }

  _recordFrame() {
    const now = this._now();
    if (this._lastTime != null) {
      const delta = now - this._lastTime;
      if (Number.isFinite(delta) && delta >= 0) {
        if (this._frames.length >= this.sampleSize) {
          this._frames.shift();
        }
        this._frames.push(delta);
      }
    }
    this._lastTime = now;
    const memoryValue = this._memory();
    if (memoryValue != null && Number.isFinite(memoryValue)) {
      if (this._memorySamples.length >= this.sampleSize) {
        this._memorySamples.shift();
      }
      this._memorySamples.push(memoryValue);
    }
  }

  getMetrics() {
    const frameSamples = this._frames.length;
    const totalFrameTime = frameSamples ? this._frames.reduce((sum, value) => sum + value, 0) : 0;
    const averageFrameTime = frameSamples ? totalFrameTime / frameSamples : 0;
    const fps = averageFrameTime > 0 ? 1000 / averageFrameTime : 0;
    const maxFrameTime = frameSamples ? Math.max(...this._frames) : 0;
    const minFrameTime = frameSamples ? Math.min(...this._frames) : 0;
    const memorySamples = this._memorySamples.length;
    const totalMemory = memorySamples
      ? this._memorySamples.reduce((sum, value) => sum + value, 0)
      : 0;
    const averageMemory = memorySamples ? totalMemory / memorySamples : null;
    const memoryDelta = memorySamples > 1
      ? this._memorySamples[memorySamples - 1] - this._memorySamples[0]
      : 0;
    return {
      frameSamples,
      averageFrameTime,
      maxFrameTime,
      minFrameTime,
      fps,
      memorySamples,
      averageMemory,
      memoryDelta,
    };
  }
}
