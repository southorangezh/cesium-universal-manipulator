const EPSILON = 1e-12;

export function create(x = 0, y = 0, z = 0) {
  return [x, y, z];
}

export function clone(v) {
  return [v[0], v[1], v[2]];
}

export function set(out, x, y, z) {
  out[0] = x;
  out[1] = y;
  out[2] = z;
  return out;
}

export function add(out, a, b) {
  out[0] = a[0] + b[0];
  out[1] = a[1] + b[1];
  out[2] = a[2] + b[2];
  return out;
}

export function subtract(out, a, b) {
  out[0] = a[0] - b[0];
  out[1] = a[1] - b[1];
  out[2] = a[2] - b[2];
  return out;
}

export function scale(out, a, s) {
  out[0] = a[0] * s;
  out[1] = a[1] * s;
  out[2] = a[2] * s;
  return out;
}

export function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function cross(out, a, b) {
  const ax = a[0], ay = a[1], az = a[2];
  const bx = b[0], by = b[1], bz = b[2];
  out[0] = ay * bz - az * by;
  out[1] = az * bx - ax * bz;
  out[2] = ax * by - ay * bx;
  return out;
}

export function length(a) {
  return Math.sqrt(lengthSquared(a));
}

export function lengthSquared(a) {
  return a[0] * a[0] + a[1] * a[1] + a[2] * a[2];
}

export function normalize(out, a) {
  const len = length(a);
  if (len < EPSILON) {
    return set(out, 0, 0, 0);
  }
  const inv = 1 / len;
  return scale(out, a, inv);
}

export function distance(a, b) {
  return Math.sqrt(distanceSquared(a, b));
}

export function distanceSquared(a, b) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return dx * dx + dy * dy + dz * dz;
}

export function projectScalar(point, origin, axis) {
  const diff = [0, 0, 0];
  subtract(diff, point, origin);
  return dot(diff, axis);
}

export function projectPoint(out, point, origin, axis) {
  const s = projectScalar(point, origin, axis);
  out[0] = origin[0] + axis[0] * s;
  out[1] = origin[1] + axis[1] * s;
  out[2] = origin[2] + axis[2] * s;
  return out;
}

export function lerp(out, a, b, t) {
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
  return out;
}

export function almostEquals(a, b, eps = 1e-6) {
  return Math.abs(a[0] - b[0]) <= eps && Math.abs(a[1] - b[1]) <= eps && Math.abs(a[2] - b[2]) <= eps;
}

export function angleBetween(a, b) {
  const na = clone(a);
  const nb = clone(b);
  normalize(na, na);
  normalize(nb, nb);
  const d = Math.max(-1, Math.min(1, dot(na, nb)));
  return Math.acos(d);
}

export function rotateAroundAxis(out, v, axis, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const term1 = scale([0, 0, 0], v, cos);
  const term2 = scale([0, 0, 0], cross([0, 0, 0], axis, v), sin);
  const term3 = scale([0, 0, 0], axis, dot(axis, v) * (1 - cos));
  out[0] = term1[0] + term2[0] + term3[0];
  out[1] = term1[1] + term2[1] + term3[1];
  out[2] = term1[2] + term2[2] + term3[2];
  return out;
}

export function isFiniteVector(v) {
  return Number.isFinite(v[0]) && Number.isFinite(v[1]) && Number.isFinite(v[2]);
}

export default {
  create,
  clone,
  set,
  add,
  subtract,
  scale,
  dot,
  cross,
  length,
  lengthSquared,
  normalize,
  distance,
  distanceSquared,
  projectScalar,
  projectPoint,
  lerp,
  almostEquals,
  angleBetween,
  rotateAroundAxis,
  isFiniteVector
};
