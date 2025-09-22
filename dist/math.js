const EPSILON = 1e-10;

export function clone(v) {
  return { x: v.x, y: v.y, z: v.z };
}

export function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function subtract(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scale(v, scalar) {
  return { x: v.x * scalar, y: v.y * scalar, z: v.z * scalar };
}

export function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function magnitude(v) {
  return Math.sqrt(dot(v, v));
}

export function normalize(v) {
  const mag = magnitude(v);
  if (mag < EPSILON) {
    return { x: 0, y: 0, z: 0 };
  }
  return scale(v, 1 / mag);
}

export function equalsEpsilon(a, b, epsilon = EPSILON) {
  return (
    Math.abs(a.x - b.x) <= epsilon &&
    Math.abs(a.y - b.y) <= epsilon &&
    Math.abs(a.z - b.z) <= epsilon
  );
}

export function equalsQuaternion(a, b, epsilon = EPSILON) {
  if (!a || !b) return false;
  const diff = Math.abs(a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w);
  return Math.abs(1 - diff) <= epsilon;
}

export function fromAxisAngle(axis, angle) {
  const half = angle * 0.5;
  const s = Math.sin(half);
  const norm = normalize(axis);
  return {
    x: norm.x * s,
    y: norm.y * s,
    z: norm.z * s,
    w: Math.cos(half),
  };
}

export function quaternionMultiply(a, b) {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  };
}

export function rotateVectorByQuaternion(vector, quaternion) {
  const qVec = { x: quaternion.x, y: quaternion.y, z: quaternion.z };
  const uv = cross(qVec, vector);
  const uuv = cross(qVec, uv);
  const uvScaled = scale(uv, 2 * quaternion.w);
  const uuvScaled = scale(uuv, 2);
  return add(vector, add(uvScaled, uuvScaled));
}

export function quaternionToMatrix(q) {
  const xx = q.x * q.x;
  const yy = q.y * q.y;
  const zz = q.z * q.z;
  const xy = q.x * q.y;
  const xz = q.x * q.z;
  const yz = q.y * q.z;
  const wx = q.w * q.x;
  const wy = q.w * q.y;
  const wz = q.w * q.z;

  return [
    1 - 2 * (yy + zz), 2 * (xy - wz), 2 * (xz + wy),
    2 * (xy + wz), 1 - 2 * (xx + zz), 2 * (yz - wx),
    2 * (xz - wy), 2 * (yz + wx), 1 - 2 * (xx + yy),
  ];
}

export function matrixToQuaternion(m) {
  const trace = m[0] + m[4] + m[8];
  let q = { x: 0, y: 0, z: 0, w: 1 };
  if (trace > 0) {
    const s = Math.sqrt(trace + 1.0) * 2;
    q.w = 0.25 * s;
    q.x = (m[7] - m[5]) / s;
    q.y = (m[2] - m[6]) / s;
    q.z = (m[3] - m[1]) / s;
  } else if (m[0] > m[4] && m[0] > m[8]) {
    const s = Math.sqrt(1.0 + m[0] - m[4] - m[8]) * 2;
    q.w = (m[7] - m[5]) / s;
    q.x = 0.25 * s;
    q.y = (m[1] + m[3]) / s;
    q.z = (m[2] + m[6]) / s;
  } else if (m[4] > m[8]) {
    const s = Math.sqrt(1.0 + m[4] - m[0] - m[8]) * 2;
    q.w = (m[2] - m[6]) / s;
    q.x = (m[1] + m[3]) / s;
    q.y = 0.25 * s;
    q.z = (m[5] + m[7]) / s;
  } else {
    const s = Math.sqrt(1.0 + m[8] - m[0] - m[4]) * 2;
    q.w = (m[3] - m[1]) / s;
    q.x = (m[2] + m[6]) / s;
    q.y = (m[5] + m[7]) / s;
    q.z = 0.25 * s;
  }
  return normalizeQuaternion(q);
}

export function normalizeQuaternion(q) {
  const len = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);
  if (len < EPSILON) {
    return { x: 0, y: 0, z: 0, w: 1 };
  }
  return { x: q.x / len, y: q.y / len, z: q.z / len, w: q.w / len };
}

export function composeTransform(translation, rotation, scaleVec) {
  const m = quaternionToMatrix(rotation);
  return [
    m[0] * scaleVec.x, m[1] * scaleVec.y, m[2] * scaleVec.z, 0,
    m[3] * scaleVec.x, m[4] * scaleVec.y, m[5] * scaleVec.z, 0,
    m[6] * scaleVec.x, m[7] * scaleVec.y, m[8] * scaleVec.z, 0,
    translation.x, translation.y, translation.z, 1,
  ];
}

function toMatrixElements(matrix) {
  if (!matrix) {
    return null;
  }
  if (typeof matrix.length === 'number') {
    return matrix;
  }
  if (typeof matrix.elements === 'object' && typeof matrix.elements.length === 'number') {
    return matrix.elements;
  }
  if (typeof matrix.toArray === 'function') {
    const result = matrix.toArray();
    if (result && typeof result.length === 'number') {
      return result;
    }
  }
  return null;
}

export function decomposeTransform(matrix) {
  const elements = toMatrixElements(matrix);
  if (!elements) {
    return {
      translation: { ...ZERO_VECTOR },
      rotation: { ...IDENTITY_QUATERNION },
      scale: { x: 1, y: 1, z: 1 },
    };
  }

  const translation = {
    x: elements[12] ?? 0,
    y: elements[13] ?? 0,
    z: elements[14] ?? 0,
  };
  const basisX = { x: elements[0] ?? 0, y: elements[4] ?? 0, z: elements[8] ?? 0 };
  const basisY = { x: elements[1] ?? 0, y: elements[5] ?? 0, z: elements[9] ?? 0 };
  const basisZ = { x: elements[2] ?? 0, y: elements[6] ?? 0, z: elements[10] ?? 0 };
  const scale = {
    x: magnitude(basisX),
    y: magnitude(basisY),
    z: magnitude(basisZ),
  };
  const invScale = {
    x: scale.x > EPSILON ? 1 / scale.x : 0,
    y: scale.y > EPSILON ? 1 / scale.y : 0,
    z: scale.z > EPSILON ? 1 / scale.z : 0,
  };
  const rotMatrix = [
    basisX.x * invScale.x, basisY.x * invScale.y, basisZ.x * invScale.z,
    basisX.y * invScale.x, basisY.y * invScale.y, basisZ.y * invScale.z,
    basisX.z * invScale.x, basisY.z * invScale.y, basisZ.z * invScale.z,
  ];
  const rotation = matrixToQuaternion(rotMatrix);
  return { translation, rotation, scale };
}

export function projectOnVector(vector, axis) {
  const axisNorm = normalize(axis);
  return scale(axisNorm, dot(vector, axisNorm));
}

export function projectScalar(vector, axis) {
  const axisNorm = normalize(axis);
  return dot(vector, axisNorm);
}

export function angleBetween(a, b, normal) {
  const aNorm = normalize(a);
  const bNorm = normalize(b);
  const crossProd = cross(aNorm, bNorm);
  const sin = magnitude(crossProd);
  const cos = dot(aNorm, bNorm);
  let angle = Math.atan2(sin, cos);
  if (normal && dot(crossProd, normal) < 0) {
    angle = -angle;
  }
  return angle;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function toMatrix4(columns) {
  return [
    columns[0].x, columns[1].x, columns[2].x, columns[3]?.x ?? 0,
    columns[0].y, columns[1].y, columns[2].y, columns[3]?.y ?? 0,
    columns[0].z, columns[1].z, columns[2].z, columns[3]?.z ?? 0,
    0, 0, 0, 1,
  ];
}

export function orthonormalize(basisX, basisY, basisZ) {
  const x = normalize(basisX);
  const z = normalize(cross(x, basisY));
  const y = normalize(cross(z, x));
  return { x, y, z };
}

export function buildLookAt(forward, up) {
  const z = normalize(forward);
  const x = normalize(cross(up, z));
  const y = cross(z, x);
  return { x, y, z };
}

export function ensureOrthogonalAxes(axes) {
  const { x, y, z } = axes;
  const ortho = orthonormalize(x, y, z);
  return { x: ortho.x, y: ortho.y, z: ortho.z };
}

export function nearlyZero(value, epsilon = EPSILON) {
  return Math.abs(value) <= epsilon;
}

export function clampMagnitude(value, epsilon = EPSILON) {
  return nearlyZero(value, epsilon) ? 0 : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function lerpVector(a, b, t) {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t),
  };
}

export function quaternionSlerp(a, b, t) {
  let cosHalfTheta = a.w * b.w + a.x * b.x + a.y * b.y + a.z * b.z;
  if (cosHalfTheta < 0) {
    b = { x: -b.x, y: -b.y, z: -b.z, w: -b.w };
    cosHalfTheta = -cosHalfTheta;
  }
  if (Math.abs(cosHalfTheta) >= 1.0) {
    return { ...a };
  }
  const halfTheta = Math.acos(cosHalfTheta);
  const sinHalfTheta = Math.sqrt(1.0 - cosHalfTheta * cosHalfTheta);
  if (Math.abs(sinHalfTheta) < EPSILON) {
    return {
      w: 0.5 * (a.w + b.w),
      x: 0.5 * (a.x + b.x),
      y: 0.5 * (a.y + b.y),
      z: 0.5 * (a.z + b.z),
    };
  }
  const ratioA = Math.sin((1 - t) * halfTheta) / sinHalfTheta;
  const ratioB = Math.sin(t * halfTheta) / sinHalfTheta;
  return {
    w: a.w * ratioA + b.w * ratioB,
    x: a.x * ratioA + b.x * ratioB,
    y: a.y * ratioA + b.y * ratioB,
    z: a.z * ratioA + b.z * ratioB,
  };
}

export function rayPlaneIntersection(ray, planeNormal, planePoint) {
  const denom = dot(ray.direction, planeNormal);
  if (nearlyZero(denom)) {
    return null;
  }
  const diff = subtract(planePoint, ray.origin);
  const t = dot(diff, planeNormal) / denom;
  if (t < 0) {
    return null;
  }
  return add(ray.origin, scale(ray.direction, t));
}

export const IDENTITY_QUATERNION = { x: 0, y: 0, z: 0, w: 1 };
export const ZERO_VECTOR = { x: 0, y: 0, z: 0 };
export const UNIT_X = { x: 1, y: 0, z: 0 };
export const UNIT_Y = { x: 0, y: 1, z: 0 };
export const UNIT_Z = { x: 0, y: 0, z: 1 };
