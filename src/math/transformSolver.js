import { subtract, normalize, dot, cross, angleBetween } from './vector.js';
import { multiply as multiplyQuat, fromAxisAngle, normalize as normalizeQuat } from './quaternion.js';
import { projectOnAxis, intersectPlane } from './ray.js';

function buildPlaneForAxis(axis, cameraDir) {
  const normal = normalize([0, 0, 0], cross([0, 0, 0], axis, cameraDir));
  if (normal[0] === 0 && normal[1] === 0 && normal[2] === 0) {
    const fallback = Math.abs(axis[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    cross(normal, axis, fallback);
    normalize(normal, normal);
  }
  return normal;
}

export class TransformSolver {
  constructor(options = {}) {
    this.snapper = options.snapper;
  }

  beginInteraction(params) {
    const state = {
      mode: params.mode,
      handle: params.handle,
      origin: params.origin,
      axis: params.axis,
      planeAxes: params.planeAxes,
      initial: params.initial,
      cameraDir: params.cameraDir,
      startRay: params.startRay,
      snapModifiers: params.snapModifiers ?? {},
      uniform: params.uniform ?? false,
      referenceVector: null,
      planeNormal: null,
      planePoint: params.origin,
      radius: params.radius ?? 1
    };

    if (state.mode === 'translate') {
      if (state.handle.type === 'axis') {
        state.planeNormal = buildPlaneForAxis(state.axis, state.cameraDir);
        state.startValue = projectOnAxis(state.startRay, state.axis, state.origin, state.planeNormal);
      } else if (state.handle.type === 'plane') {
        state.planeNormal = normalize([0, 0, 0], cross([0, 0, 0], state.planeAxes[0], state.planeAxes[1]));
        const hit = intersectPlane(state.startRay, { normal: state.planeNormal, point: state.origin });
        state.startPoint = hit ?? state.origin.slice();
      } else if (state.handle.type === 'free') {
        state.planeNormal = state.cameraDir.slice();
        const hit = intersectPlane(state.startRay, { normal: state.planeNormal, point: state.origin });
        state.startPoint = hit ?? state.origin.slice();
      }
    } else if (state.mode === 'rotate') {
      if (state.handle.type === 'view') {
        state.planeNormal = state.cameraDir.slice();
      } else {
        state.planeNormal = state.axis.slice();
      }
      const hit = intersectPlane(state.startRay, { normal: state.planeNormal, point: state.origin });
      state.referenceVector = hit ? subtract([0, 0, 0], hit, state.origin) : state.axis.slice();
      normalize(state.referenceVector, state.referenceVector);
    } else if (state.mode === 'scale') {
      if (state.handle.type === 'axis') {
        state.planeNormal = buildPlaneForAxis(state.axis, state.cameraDir);
        state.startValue = projectOnAxis(state.startRay, state.axis, state.origin, state.planeNormal);
        if (state.startValue === null) {
          state.startValue = 0;
        }
      } else {
        state.planeNormal = state.cameraDir.slice();
        const hit = intersectPlane(state.startRay, { normal: state.planeNormal, point: state.origin });
        state.startPoint = hit ?? state.origin.slice();
      }
    }

    state.delta = {
      translation: [0, 0, 0],
      rotation: [0, 0, 0, 1],
      scale: [1, 1, 1]
    };

    return state;
  }

  update(state, params) {
    if (state.mode === 'translate') {
      return this.solveTranslate(state, params);
    }
    if (state.mode === 'rotate') {
      return this.solveRotate(state, params);
    }
    if (state.mode === 'scale') {
      return this.solveScale(state, params);
    }
    throw new Error(`Unknown mode ${state.mode}`);
  }

  solveTranslate(state, params) {
    const result = state.delta;
    if (state.handle.type === 'axis') {
      const value = projectOnAxis(params.currentRay, state.axis, state.origin, state.planeNormal);
      if (value !== null && state.startValue !== undefined) {
        let delta = value - state.startValue;
        if (this.snapper) {
          delta = this.snapper.snapTranslation(delta, params.modifiers);
        }
        result.translation = [state.axis[0] * delta, state.axis[1] * delta, state.axis[2] * delta];
      }
    } else {
      const hit = intersectPlane(params.currentRay, { normal: state.planeNormal, point: state.origin });
      if (hit) {
        const startPoint = state.startPoint ?? state.origin;
        const diff = subtract([0, 0, 0], hit, startPoint);
        if (state.handle.type === 'plane') {
          const axisA = state.planeAxes[0];
          const axisB = state.planeAxes[1];
          let deltaA = dot(diff, axisA);
          let deltaB = dot(diff, axisB);
          if (this.snapper) {
            deltaA = this.snapper.snapTranslation(deltaA, params.modifiers);
            deltaB = this.snapper.snapTranslation(deltaB, params.modifiers);
          }
          result.translation = [
            axisA[0] * deltaA + axisB[0] * deltaB,
            axisA[1] * deltaA + axisB[1] * deltaB,
            axisA[2] * deltaA + axisB[2] * deltaB
          ];
        } else {
          let deltaX = diff[0];
          let deltaY = diff[1];
          let deltaZ = diff[2];
          if (this.snapper) {
            deltaX = this.snapper.snapTranslation(deltaX, params.modifiers);
            deltaY = this.snapper.snapTranslation(deltaY, params.modifiers);
            deltaZ = this.snapper.snapTranslation(deltaZ, params.modifiers);
          }
          result.translation = [deltaX, deltaY, deltaZ];
        }
      }
    }
    return result;
  }

  solveRotate(state, params) {
    const result = state.delta;
    const hit = intersectPlane(params.currentRay, { normal: state.planeNormal, point: state.origin });
    if (!hit) {
      return result;
    }
    const currentVector = subtract([0, 0, 0], hit, state.origin);
    normalize(currentVector, currentVector);
    let angle = angleBetween(state.referenceVector, currentVector);
    const crossAxis = cross([0, 0, 0], state.referenceVector, currentVector);
    const sign = dot(crossAxis, state.planeNormal) >= 0 ? 1 : -1;
    angle *= sign;
    if (this.snapper) {
      angle = this.snapper.snapAngle(angle, params.modifiers);
    }
    result.rotation = normalizeQuat(multiplyQuat(fromAxisAngle(state.planeNormal, angle), [0, 0, 0, 1]));
    result.rotationAngle = angle;
    result.rotationAxis = state.planeNormal.slice();
    return result;
  }

  solveScale(state, params) {
    const result = state.delta;
    if (state.handle.type === 'axis') {
      const value = projectOnAxis(params.currentRay, state.axis, state.origin, state.planeNormal);
      if (value !== null && state.startValue !== undefined) {
        let factor = (value - state.startValue) / Math.max(1e-6, state.radius) + 1;
        if (this.snapper) {
          factor = this.snapper.snapScale(factor, params.modifiers);
        }
        result.scale = [
          state.axis[0] !== 0 ? factor : 1,
          state.axis[1] !== 0 ? factor : 1,
          state.axis[2] !== 0 ? factor : 1
        ];
      }
    } else {
      const hit = intersectPlane(params.currentRay, { normal: state.planeNormal, point: state.origin });
      if (hit) {
        const startPoint = state.startPoint ?? state.origin;
        const startDist = Math.max(1e-6, Math.hypot(
          startPoint[0] - state.origin[0],
          startPoint[1] - state.origin[1],
          startPoint[2] - state.origin[2]
        ));
        const currentDist = Math.max(1e-6, Math.hypot(
          hit[0] - state.origin[0],
          hit[1] - state.origin[1],
          hit[2] - state.origin[2]
        ));
        let factor = currentDist / startDist;
        if (this.snapper) {
          factor = this.snapper.snapScale(factor, params.modifiers);
        }
        result.scale = [factor, factor, factor];
      }
    }
    return result;
  }
}

export default TransformSolver;
