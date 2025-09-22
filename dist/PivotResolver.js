import { add, scale, ZERO_VECTOR } from './math.js';

function extractTranslation(target) {
  if (!target) return ZERO_VECTOR;
  if (target.position) {
    return target.position;
  }
  if (target.matrix) {
    const m = target.matrix;
    return { x: m[3], y: m[7], z: m[11] };
  }
  if (typeof target.getWorldMatrix === 'function') {
    const m = target.getWorldMatrix();
    return { x: m[3], y: m[7], z: m[11] };
  }
  return ZERO_VECTOR;
}

function averagePoints(points) {
  if (!points.length) return ZERO_VECTOR;
  const total = points.reduce((acc, point) => add(acc, point), ZERO_VECTOR);
  return scale(total, 1 / points.length);
}

export class PivotResolver {
  constructor() {
    this.mode = 'origin';
    this.cursor = ZERO_VECTOR;
  }

  setMode(mode) {
    this.mode = mode;
  }

  setCursor(position) {
    this.cursor = position;
  }

  resolve(targets, modeOverride) {
    const mode = modeOverride ?? this.mode;
    const targetArray = Array.isArray(targets) ? targets : [targets];
    const positions = targetArray.map(extractTranslation);
    if (!targetArray.length) {
      return { pivot: ZERO_VECTOR, perTarget: new Map() };
    }

    if (mode === 'cursor') {
      const map = new Map();
      for (const target of targetArray) {
        map.set(target, this.cursor);
      }
      return { pivot: this.cursor, perTarget: map };
    }

    if (mode === 'individual') {
      const map = new Map();
      targetArray.forEach((target, index) => {
        map.set(target, positions[index]);
      });
      return { pivot: positions[0], perTarget: map };
    }

    if (mode === 'median') {
      const pivot = averagePoints(positions);
      const map = new Map();
      targetArray.forEach((target) => map.set(target, pivot));
      return { pivot, perTarget: map };
    }

    // origin fallback
    const pivot = positions[0];
    const map = new Map();
    targetArray.forEach((target) => map.set(target, pivot));
    return { pivot, perTarget: map };
  }
}
