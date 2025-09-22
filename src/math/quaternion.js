import { length as vecLength, normalize as vecNormalize, cross, dot } from './vector.js';

export function create(x = 0, y = 0, z = 0, w = 1) {
  return [x, y, z, w];
}

export function clone(q) {
  return [q[0], q[1], q[2], q[3]];
}

export function multiply(a, b) {
  const ax = a[0], ay = a[1], az = a[2], aw = a[3];
  const bx = b[0], by = b[1], bz = b[2], bw = b[3];
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz
  ];
}

export function fromAxisAngle(axis, angle) {
  const half = angle * 0.5;
  const s = Math.sin(half);
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(half)];
}

export function toMatrix3(q) {
  const x = q[0], y = q[1], z = q[2], w = q[3];
  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;
  const xx = x * x2;
  const xy = x * y2;
  const xz = x * z2;
  const yy = y * y2;
  const yz = y * z2;
  const zz = z * z2;
  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;

  return [
    1 - (yy + zz), xy - wz, xz + wy,
    xy + wz, 1 - (xx + zz), yz - wx,
    xz - wy, yz + wx, 1 - (xx + yy)
  ];
}

export function normalize(out) {
  const len = Math.sqrt(out[0] * out[0] + out[1] * out[1] + out[2] * out[2] + out[3] * out[3]);
  if (len === 0) {
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
    out[3] = 1;
    return out;
  }
  const inv = 1 / len;
  out[0] *= inv;
  out[1] *= inv;
  out[2] *= inv;
  out[3] *= inv;
  return out;
}

export function slerp(a, b, t) {
  let cosTheta = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  const sign = cosTheta < 0 ? -1 : 1;
  const end = [b[0] * sign, b[1] * sign, b[2] * sign, b[3] * sign];
  cosTheta *= sign;
  if (1 - cosTheta < 1e-6) {
    return [
      a[0] + t * (end[0] - a[0]),
      a[1] + t * (end[1] - a[1]),
      a[2] + t * (end[2] - a[2]),
      a[3] + t * (end[3] - a[3])
    ];
  }
  const theta = Math.acos(cosTheta);
  const sinTheta = Math.sin(theta);
  const w1 = Math.sin((1 - t) * theta) / sinTheta;
  const w2 = Math.sin(t * theta) / sinTheta;
  return [
    a[0] * w1 + end[0] * w2,
    a[1] * w1 + end[1] * w2,
    a[2] * w1 + end[2] * w2,
    a[3] * w1 + end[3] * w2
  ];
}

export function toAxisAngle(q) {
  const normalized = normalize(clone(q));
  const angle = 2 * Math.acos(normalized[3]);
  const s = Math.sqrt(1 - normalized[3] * normalized[3]);
  if (s < 1e-6) {
    return {
      axis: [1, 0, 0],
      angle: 0
    };
  }
  return {
    axis: [normalized[0] / s, normalized[1] / s, normalized[2] / s],
    angle
  };
}

export function fromVectors(a, b) {
  const v1 = a.slice();
  const v2 = b.slice();
  vecNormalize(v1, v1);
  vecNormalize(v2, v2);
  const dotAB = dot(v1, v2);
  if (dotAB >= 1 - 1e-6) {
    return [0, 0, 0, 1];
  }
  if (dotAB <= -1 + 1e-6) {
    const axis = cross([0, 0, 0], v1, [1, 0, 0]);
    if (vecLength(axis) < 1e-6) {
      cross(axis, v1, [0, 1, 0]);
    }
    vecNormalize(axis, axis);
    return fromAxisAngle(axis, Math.PI);
  }
  const axis = cross([0, 0, 0], v1, v2);
  return normalize([
    axis[0],
    axis[1],
    axis[2],
    1 + dotAB
  ]);
}

export function applyToVector(q, v) {
  const u = [q[0], q[1], q[2]];
  const s = q[3];
  const crossUV = cross([0, 0, 0], u, v);
  const crossUU = cross([0, 0, 0], u, crossUV);
  return [
    v[0] + 2 * (s * crossUV[0] + crossUU[0]),
    v[1] + 2 * (s * crossUV[1] + crossUU[1]),
    v[2] + 2 * (s * crossUV[2] + crossUU[2])
  ];
}

export default {
  create,
  clone,
  multiply,
  fromAxisAngle,
  toMatrix3,
  normalize,
  slerp,
  toAxisAngle,
  fromVectors,
  applyToVector
};
