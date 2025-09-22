import { create as vec3, add, subtract, cross, normalize, dot } from './vector.js';

export function identity() {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ];
}

export function clone(m) {
  return m.slice();
}

export function multiply(a, b) {
  const out = new Array(16);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += a[row + k * 4] * b[k + col * 4];
      }
      out[row + col * 4] = sum;
    }
  }
  return out;
}

export function compose(translation, rotation, scale) {
  const [sx, sy, sz] = scale;
  const [qx, qy, qz, qw] = rotation;
  const xx = qx * qx;
  const xy = qx * qy;
  const xz = qx * qz;
  const xw = qx * qw;
  const yy = qy * qy;
  const yz = qy * qz;
  const yw = qy * qw;
  const zz = qz * qz;
  const zw = qz * qw;

  const m11 = (1 - 2 * (yy + zz)) * sx;
  const m12 = (2 * (xy - zw)) * sx;
  const m13 = (2 * (xz + yw)) * sx;
  const m21 = (2 * (xy + zw)) * sy;
  const m22 = (1 - 2 * (xx + zz)) * sy;
  const m23 = (2 * (yz - xw)) * sy;
  const m31 = (2 * (xz - yw)) * sz;
  const m32 = (2 * (yz + xw)) * sz;
  const m33 = (1 - 2 * (xx + yy)) * sz;

  return [
    m11, m21, m31, 0,
    m12, m22, m32, 0,
    m13, m23, m33, 0,
    translation[0], translation[1], translation[2], 1
  ];
}

export function getTranslation(out, matrix) {
  out[0] = matrix[12];
  out[1] = matrix[13];
  out[2] = matrix[14];
  return out;
}

export function getScale(out, matrix) {
  const x = [matrix[0], matrix[1], matrix[2]];
  const y = [matrix[4], matrix[5], matrix[6]];
  const z = [matrix[8], matrix[9], matrix[10]];
  out[0] = Math.hypot(...x);
  out[1] = Math.hypot(...y);
  out[2] = Math.hypot(...z);
  return out;
}

export function getRotation(out, matrix) {
  const scale = [0, 0, 0];
  getScale(scale, matrix);
  const m11 = matrix[0] / scale[0];
  const m12 = matrix[4] / scale[1];
  const m13 = matrix[8] / scale[2];
  const m21 = matrix[1] / scale[0];
  const m22 = matrix[5] / scale[1];
  const m23 = matrix[9] / scale[2];
  const m31 = matrix[2] / scale[0];
  const m32 = matrix[6] / scale[1];
  const m33 = matrix[10] / scale[2];
  const trace = m11 + m22 + m33;
  let qx, qy, qz, qw;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    qw = 0.25 * s;
    qx = (m32 - m23) / s;
    qy = (m13 - m31) / s;
    qz = (m21 - m12) / s;
  } else if (m11 > m22 && m11 > m33) {
    const s = Math.sqrt(1 + m11 - m22 - m33) * 2;
    qw = (m32 - m23) / s;
    qx = 0.25 * s;
    qy = (m12 + m21) / s;
    qz = (m13 + m31) / s;
  } else if (m22 > m33) {
    const s = Math.sqrt(1 + m22 - m11 - m33) * 2;
    qw = (m13 - m31) / s;
    qx = (m12 + m21) / s;
    qy = 0.25 * s;
    qz = (m23 + m32) / s;
  } else {
    const s = Math.sqrt(1 + m33 - m11 - m22) * 2;
    qw = (m21 - m12) / s;
    qx = (m13 + m31) / s;
    qy = (m23 + m32) / s;
    qz = 0.25 * s;
  }
  out[0] = qx;
  out[1] = qy;
  out[2] = qz;
  out[3] = qw;
  return out;
}

export function invert(matrix) {
  const m = matrix;
  const inv = new Array(16);
  inv[0] = m[5] * m[10] * m[15] - m[5] * m[11] * m[14] - m[9] * m[6] * m[15] + m[9] * m[7] * m[14] + m[13] * m[6] * m[11] - m[13] * m[7] * m[10];
  inv[4] = -m[4] * m[10] * m[15] + m[4] * m[11] * m[14] + m[8] * m[6] * m[15] - m[8] * m[7] * m[14] - m[12] * m[6] * m[11] + m[12] * m[7] * m[10];
  inv[8] = m[4] * m[9] * m[15] - m[4] * m[11] * m[13] - m[8] * m[5] * m[15] + m[8] * m[7] * m[13] + m[12] * m[5] * m[11] - m[12] * m[7] * m[9];
  inv[12] = -m[4] * m[9] * m[14] + m[4] * m[10] * m[13] + m[8] * m[5] * m[14] - m[8] * m[6] * m[13] - m[12] * m[5] * m[10] + m[12] * m[6] * m[9];
  inv[1] = -m[1] * m[10] * m[15] + m[1] * m[11] * m[14] + m[9] * m[2] * m[15] - m[9] * m[3] * m[14] - m[13] * m[2] * m[11] + m[13] * m[3] * m[10];
  inv[5] = m[0] * m[10] * m[15] - m[0] * m[11] * m[14] - m[8] * m[2] * m[15] + m[8] * m[3] * m[14] + m[12] * m[2] * m[11] - m[12] * m[3] * m[10];
  inv[9] = -m[0] * m[9] * m[15] + m[0] * m[11] * m[13] + m[8] * m[1] * m[15] - m[8] * m[3] * m[13] - m[12] * m[1] * m[11] + m[12] * m[3] * m[9];
  inv[13] = m[0] * m[9] * m[14] - m[0] * m[10] * m[13] - m[8] * m[1] * m[14] + m[8] * m[2] * m[13] + m[12] * m[1] * m[10] - m[12] * m[2] * m[9];
  inv[2] = m[1] * m[6] * m[15] - m[1] * m[7] * m[14] - m[5] * m[2] * m[15] + m[5] * m[3] * m[14] + m[13] * m[2] * m[7] - m[13] * m[3] * m[6];
  inv[6] = -m[0] * m[6] * m[15] + m[0] * m[7] * m[14] + m[4] * m[2] * m[15] - m[4] * m[3] * m[14] - m[12] * m[2] * m[7] + m[12] * m[3] * m[6];
  inv[10] = m[0] * m[5] * m[15] - m[0] * m[7] * m[13] - m[4] * m[1] * m[15] + m[4] * m[3] * m[13] + m[12] * m[1] * m[7] - m[12] * m[3] * m[5];
  inv[14] = -m[0] * m[5] * m[14] + m[0] * m[6] * m[13] + m[4] * m[1] * m[14] - m[4] * m[2] * m[13] - m[12] * m[1] * m[6] + m[12] * m[2] * m[5];
  inv[3] = -m[1] * m[6] * m[11] + m[1] * m[7] * m[10] + m[5] * m[2] * m[11] - m[5] * m[3] * m[10] - m[9] * m[2] * m[7] + m[9] * m[3] * m[6];
  inv[7] = m[0] * m[6] * m[11] - m[0] * m[7] * m[10] - m[4] * m[2] * m[11] + m[4] * m[3] * m[10] + m[8] * m[2] * m[7] - m[8] * m[3] * m[6];
  inv[11] = -m[0] * m[5] * m[11] + m[0] * m[7] * m[9] + m[4] * m[1] * m[11] - m[4] * m[3] * m[9] - m[8] * m[1] * m[7] + m[8] * m[3] * m[5];
  inv[15] = m[0] * m[5] * m[10] - m[0] * m[6] * m[9] - m[4] * m[1] * m[10] + m[4] * m[2] * m[9] + m[8] * m[1] * m[6] - m[8] * m[2] * m[5];

  let det = m[0] * inv[0] + m[1] * inv[4] + m[2] * inv[8] + m[3] * inv[12];
  if (!det) {
    return identity();
  }
  det = 1.0 / det;
  for (let i = 0; i < 16; i++) {
    inv[i] *= det;
  }
  return inv;
}

export function transformPoint(matrix, point) {
  const x = point[0], y = point[1], z = point[2];
  const w = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
  const invW = w !== 0 ? 1 / w : 1;
  return [
    (matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12]) * invW,
    (matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13]) * invW,
    (matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]) * invW
  ];
}

export function transpose(matrix) {
  return [
    matrix[0], matrix[4], matrix[8], matrix[12],
    matrix[1], matrix[5], matrix[9], matrix[13],
    matrix[2], matrix[6], matrix[10], matrix[14],
    matrix[3], matrix[7], matrix[11], matrix[15]
  ];
}

export function orthonormalize(matrix) {
  const x = [matrix[0], matrix[1], matrix[2]];
  const y = [matrix[4], matrix[5], matrix[6]];
  const z = [matrix[8], matrix[9], matrix[10]];

  normalize(x, x);
  const yProj = vec3();
  const dotXY = dot(y, x);
  const scaledX = vec3(x[0] * dotXY, x[1] * dotXY, x[2] * dotXY);
  subtract(yProj, y, scaledX);
  normalize(yProj, yProj);
  const zOrtho = cross(vec3(), x, yProj);
  normalize(zOrtho, zOrtho);

  return [
    x[0], x[1], x[2], 0,
    yProj[0], yProj[1], yProj[2], 0,
    zOrtho[0], zOrtho[1], zOrtho[2], 0,
    matrix[12], matrix[13], matrix[14], 1
  ];
}

export default {
  identity,
  clone,
  multiply,
  compose,
  getTranslation,
  getScale,
  getRotation,
  invert,
  transformPoint,
  transpose,
  orthonormalize
};
