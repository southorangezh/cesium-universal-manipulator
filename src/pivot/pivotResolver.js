import { getTranslation } from '../math/matrix4.js';

export class PivotResolver {
  constructor(options = {}) {
    this.cursor = options.cursor ?? [0, 0, 0];
  }

  setCursor(position) {
    this.cursor = position.slice();
  }

  resolvePivot(targets, pivot = 'origin') {
    if (!Array.isArray(targets)) {
      targets = targets ? [targets] : [];
    }
    if (targets.length === 0) {
      return {
        point: [0, 0, 0],
        perTarget: []
      };
    }
    if (pivot === 'cursor') {
      return {
        point: this.cursor.slice(),
        perTarget: targets.map((t) => ({ target: t, point: this.cursor.slice() }))
      };
    }
    if (pivot === 'individual') {
      const perTarget = targets.map((t) => ({ target: t, point: this.extractTranslation(t) }));
      return {
        point: perTarget[0].point,
        perTarget
      };
    }
    if (pivot === 'median') {
      const sum = [0, 0, 0];
      const perTarget = targets.map((t) => {
        const translation = this.extractTranslation(t);
        sum[0] += translation[0];
        sum[1] += translation[1];
        sum[2] += translation[2];
        return { target: t, point: translation };
      });
      const inv = 1 / targets.length;
      return {
        point: [sum[0] * inv, sum[1] * inv, sum[2] * inv],
        perTarget
      };
    }
    // origin fallback
    const first = this.extractTranslation(targets[0]);
    return {
      point: first,
      perTarget: targets.map((t) => ({ target: t, point: first }))
    };
  }

  extractTranslation(target) {
    if (!target) {
      return [0, 0, 0];
    }
    if (typeof target.getModelMatrix === 'function') {
      const matrix = target.getModelMatrix();
      return getTranslation([0, 0, 0], matrix);
    }
    if (target.matrix) {
      return getTranslation([0, 0, 0], target.matrix);
    }
    if (Array.isArray(target)) {
      return getTranslation([0, 0, 0], target);
    }
    return [0, 0, 0];
  }
}

export default PivotResolver;
