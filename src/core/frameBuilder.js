import { normalize, cross } from '../math/vector.js';
import { identity, invert, orthonormalize } from '../math/matrix4.js';

function buildGlobalFrame(origin) {
  return {
    origin,
    axes: {
      x: [1, 0, 0],
      y: [0, 1, 0],
      z: [0, 0, 1]
    },
    matrix: identity()
  };
}

function buildLocalFrame(origin, matrix) {
  const ortho = orthonormalize(matrix);
  return {
    origin,
    axes: {
      x: [ortho[0], ortho[1], ortho[2]],
      y: [ortho[4], ortho[5], ortho[6]],
      z: [ortho[8], ortho[9], ortho[10]]
    },
    matrix: ortho
  };
}

function buildViewFrame(origin, camera) {
  const forward = [-camera.direction.x, -camera.direction.y, -camera.direction.z];
  const right = [camera.right.x, camera.right.y, camera.right.z];
  const up = [camera.up.x, camera.up.y, camera.up.z];
  return {
    origin,
    axes: {
      x: normalize(right.slice(), right),
      y: normalize(up.slice(), up),
      z: normalize(forward.slice(), forward)
    },
    matrix: [
      right[0], right[1], right[2], 0,
      up[0], up[1], up[2], 0,
      forward[0], forward[1], forward[2], 0,
      origin[0], origin[1], origin[2], 1
    ]
  };
}

function buildENUFrame(origin, ellipsoid) {
  if (!ellipsoid || !ellipsoid.eastNorthUpToFixedFrame) {
    return buildGlobalFrame(origin);
  }
  const matrix = ellipsoid.eastNorthUpToFixedFrame(origin, new Array(16));
  return {
    origin,
    axes: {
      x: [matrix[0], matrix[1], matrix[2]],
      y: [matrix[4], matrix[5], matrix[6]],
      z: [matrix[8], matrix[9], matrix[10]]
    },
    matrix
  };
}

function buildNormalFrame(origin, normal, fallbackMatrix) {
  const up = normalize([0, 0, 0], normal);
  const xAxis = normalize([0, 0, 0], cross([0, 0, 0], up, [0, 0, 1]));
  if (xAxis[0] === 0 && xAxis[1] === 0 && xAxis[2] === 0) {
    cross(xAxis, up, [1, 0, 0]);
    normalize(xAxis, xAxis);
  }
  const yAxis = cross([0, 0, 0], up, xAxis);
  normalize(yAxis, yAxis);
  return {
    origin,
    axes: {
      x: xAxis,
      y: yAxis,
      z: up
    },
    matrix: [
      xAxis[0], xAxis[1], xAxis[2], 0,
      yAxis[0], yAxis[1], yAxis[2], 0,
      up[0], up[1], up[2], 0,
      origin[0], origin[1], origin[2], 1
    ],
    fallback: fallbackMatrix
  };
}

function buildGimbalFrame(origin, matrix) {
  return buildLocalFrame(origin, matrix);
}

export class FrameBuilder {
  constructor(context = {}) {
    this.context = context;
  }

  build({ orientation = 'global', origin = [0, 0, 0], matrix = identity(), camera, normal }) {
    switch (orientation) {
      case 'local':
        return buildLocalFrame(origin, matrix);
      case 'view':
        if (!camera) {
          throw new Error('View orientation requires camera information.');
        }
        return buildViewFrame(origin, camera);
      case 'enu':
        return buildENUFrame(origin, this.context.ellipsoid);
      case 'normal':
        if (!normal) {
          return buildLocalFrame(origin, matrix);
        }
        return buildNormalFrame(origin, normal, matrix);
      case 'gimbal':
        return buildGimbalFrame(origin, matrix);
      case 'global':
      default:
        return buildGlobalFrame(origin);
    }
  }

  toLocal(matrix, point) {
    const inv = invert(matrix);
    const x = point[0], y = point[1], z = point[2];
    const w = inv[3] * x + inv[7] * y + inv[11] * z + inv[15];
    const invW = w !== 0 ? 1 / w : 1;
    return [
      (inv[0] * x + inv[4] * y + inv[8] * z + inv[12]) * invW,
      (inv[1] * x + inv[5] * y + inv[9] * z + inv[13]) * invW,
      (inv[2] * x + inv[6] * y + inv[10] * z + inv[14]) * invW
    ];
  }
}

export default FrameBuilder;
