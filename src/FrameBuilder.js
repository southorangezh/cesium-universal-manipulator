import {
  IDENTITY_QUATERNION,
  UNIT_X,
  UNIT_Y,
  UNIT_Z,
  buildLookAt,
  decomposeTransform,
  ensureOrthogonalAxes,
  normalize,
  quaternionToMatrix,
  ZERO_VECTOR,
} from './math.js';

function extractMatrix(target) {
  if (!target) {
    return null;
  }
  if (target.matrix) {
    return target.matrix;
  }
  if (target.modelMatrix) {
    return target.modelMatrix;
  }
  if (typeof target.getWorldMatrix === 'function') {
    return target.getWorldMatrix();
  }
  if (target.entity && target.entity.computeModelMatrix) {
    return target.entity.computeModelMatrix(Date.now());
  }
  return null;
}

function matrixAxes(rotationMatrix) {
  return {
    x: { x: rotationMatrix[0], y: rotationMatrix[3], z: rotationMatrix[6] },
    y: { x: rotationMatrix[1], y: rotationMatrix[4], z: rotationMatrix[7] },
    z: { x: rotationMatrix[2], y: rotationMatrix[5], z: rotationMatrix[8] },
  };
}

function fromRotation(quaternion) {
  const matrix = quaternionToMatrix(quaternion);
  return matrixAxes(matrix);
}

function computeENU(position, cesium, ellipsoid) {
  if (cesium?.Transforms?.eastNorthUpToFixedFrame) {
    const matrix = cesium.Transforms.eastNorthUpToFixedFrame(position, ellipsoid);
    return {
      origin: position,
      axes: {
        x: { x: matrix[0], y: matrix[4], z: matrix[8] },
        y: { x: matrix[1], y: matrix[5], z: matrix[9] },
        z: { x: matrix[2], y: matrix[6], z: matrix[10] },
      },
    };
  }
  return { origin: position, axes: { x: UNIT_X, y: UNIT_Y, z: UNIT_Z } };
}

export class FrameBuilder {
  constructor(options = {}) {
    this.cesium = options.Cesium ?? options.cesium;
    this.ellipsoid = options.ellipsoid ?? this.cesium?.Ellipsoid?.WGS84;

  }

  buildFrame({ target, orientation = 'global', camera, normal, gimbalYaw = 0, gimbalPitch = 0 }) {
    const matrix = extractMatrix(target);
    let origin = ZERO_VECTOR;
    let rotation = IDENTITY_QUATERNION;
    if (matrix) {
      const decomposed = decomposeTransform(matrix);
      origin = decomposed.translation;
      rotation = decomposed.rotation;
    }

    switch (orientation) {
      case 'global':
        return { origin, axes: { x: UNIT_X, y: UNIT_Y, z: UNIT_Z } };
      case 'local': {
        const axes = ensureOrthogonalAxes(fromRotation(rotation));
        return { origin, axes };
      }
      case 'view': {
        if (!camera) {
          return { origin, axes: { x: UNIT_X, y: UNIT_Y, z: UNIT_Z } };
        }
        const axes = {
          x: camera.right ?? UNIT_X,
          y: camera.up ?? UNIT_Y,
          z: camera.direction ? normalize(camera.direction) : UNIT_Z,
        };
        return { origin, axes: ensureOrthogonalAxes(axes) };
      }
      case 'enu': {
        return computeENU(origin, this.cesium, this.ellipsoid);
      }
      case 'normal': {
        const referenceNormal = normal ?? UNIT_Z;
        const axes = buildLookAt(referenceNormal, UNIT_Z);
        return { origin, axes: ensureOrthogonalAxes(axes) };
      }
      case 'gimbal': {
        const yawAxis = { x: Math.cos(gimbalYaw), y: 0, z: Math.sin(gimbalYaw) };
        const pitchAxis = { x: 0, y: Math.cos(gimbalPitch), z: Math.sin(gimbalPitch) };
        const axes = ensureOrthogonalAxes({ x: yawAxis, y: pitchAxis, z: UNIT_Z });
        return { origin, axes };
      }
      default:
        return { origin, axes: { x: UNIT_X, y: UNIT_Y, z: UNIT_Z } };
    }
  }
}
