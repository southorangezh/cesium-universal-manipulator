const DEFAULTS = {
  translate: 1.0,
  rotate: (5 * Math.PI) / 180,
  scale: 0.1,
};

function resolveStep(base, modifiers) {
  if (!base || base <= 0) return 0;
  let step = base;
  if (modifiers?.shiftKey) {
    step *= 0.1;
  }
  if (modifiers?.altKey) {
    step *= 0.25;
  }
  return step;
}

export class Snapper {
  constructor(config = {}) {
    this.steps = { ...DEFAULTS, ...config };
  }

  setConfig(config) {
    this.steps = { ...this.steps, ...config };
  }

  snapTranslation(value, modifiers = {}) {
    const step = resolveStep(this.steps.translate, modifiers);
    if (!step || !modifiers?.ctrlKey) return value;
    return Math.round(value / step) * step;
  }

  snapRotation(angle, modifiers = {}) {
    const step = resolveStep(this.steps.rotate, modifiers);
    if (!step || !modifiers?.ctrlKey) return angle;
    return Math.round(angle / step) * step;
  }

  snapScale(scale, modifiers = {}) {
    const step = resolveStep(this.steps.scale, modifiers);
    if (!step || !modifiers?.ctrlKey) return scale;
    return Math.round((scale - 1) / step) * step + 1;
  }
}
