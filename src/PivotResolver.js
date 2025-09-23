import { add, scale, ZERO_VECTOR, decomposeTransform } from './math.js';

function extractTranslation(target, context) {
  if (!target) return ZERO_VECTOR;
  const actual = target.entity && target.entity !== target ? target.entity : target;
  const resolvedTime = context.time ?? context.defaultTime ?? null;
  if (actual.position) {
    if (typeof actual.position.getValue === 'function') {
      const value = actual.position.getValue(resolvedTime);
      if (value) {
        return { x: value.x, y: value.y, z: value.z };
      }
    } else if (typeof actual.position.x === 'number') {
      return { x: actual.position.x, y: actual.position.y, z: actual.position.z };
    }
  }
  let matrix =
    actual.matrix ??
    actual.modelMatrix ??
    (typeof actual.getWorldMatrix === 'function' ? actual.getWorldMatrix() : null);
  if (!matrix && typeof actual.computeModelMatrix === 'function') {
    const when =
      resolvedTime ?? (context.Cesium?.JulianDate?.now ? context.Cesium.JulianDate.now() : undefined);
    if (when) {
      matrix = actual.computeModelMatrix(when);
    }
  }
  if (matrix) {
    return decomposeTransform(matrix).translation;
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

  resolve(targets, optionsOrMode) {
    let mode = this.mode;
    let options = {};
    if (typeof optionsOrMode === 'string' || optionsOrMode === undefined) {
      mode = optionsOrMode ?? this.mode;
    } else if (optionsOrMode && typeof optionsOrMode === 'object') {
      options = optionsOrMode;
      mode = options.mode ?? this.mode;
    }
    const resolvedTime =
      options.time ?? (options.Cesium?.JulianDate?.now ? options.Cesium.JulianDate.now() : undefined);
    const context = { time: options.time, defaultTime: resolvedTime, Cesium: options.Cesium };
    const targetArray = Array.isArray(targets) ? targets : targets ? [targets] : [];
    const positions = targetArray.map((target) => extractTranslation(target, context));
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
