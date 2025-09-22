const DEFAULT_TRANSLATE_STEP = 0.1;
const DEFAULT_ROTATE_STEP = (5 * Math.PI) / 180;
const DEFAULT_SCALE_STEP = 0.1;

export class Snapper {
  constructor(config = {}) {
    this.translationStep = config.translationStep ?? DEFAULT_TRANSLATE_STEP;
    this.rotationStep = config.rotationStep ?? DEFAULT_ROTATE_STEP;
    this.scaleStep = config.scaleStep ?? DEFAULT_SCALE_STEP;
  }

  update(config = {}) {
    if (typeof config.translationStep === 'number') {
      this.translationStep = config.translationStep;
    }
    if (typeof config.rotationStep === 'number') {
      this.rotationStep = config.rotationStep;
    }
    if (typeof config.scaleStep === 'number') {
      this.scaleStep = config.scaleStep;
    }
  }

  snapTranslation(value, modifiers = {}) {
    const step = this.translationStep * (modifiers.shift ? 0.1 : 1) * (modifiers.ctrl ? 10 : 1);
    return this.snap(value, step);
  }

  snapAngle(value, modifiers = {}) {
    const step = this.rotationStep * (modifiers.shift ? 0.1 : 1) * (modifiers.ctrl ? 10 : 1);
    return this.snap(value, step);
  }

  snapScale(value, modifiers = {}) {
    const step = this.scaleStep * (modifiers.shift ? 0.1 : 1) * (modifiers.ctrl ? 10 : 1);
    return this.snap(value, step);
  }

  snap(value, step) {
    if (!step || !Number.isFinite(step)) {
      return value;
    }
    return Math.round(value / step) * step;
  }
}

export default Snapper;
