import { dot, subtract, add, scale } from './vector.js';

export function intersectPlane(ray, plane) {
  const denom = dot(plane.normal, ray.direction);
  if (Math.abs(denom) < 1e-6) {
    return null;
  }
  const diff = subtract([0, 0, 0], plane.point, ray.origin);
  const t = dot(diff, plane.normal) / denom;
  if (t < 0) {
    return null;
  }
  const result = [0, 0, 0];
  add(result, ray.origin, scale(result, ray.direction, t));
  return result.slice();
}

export function intersectSphere(ray, sphere) {
  const diff = subtract([0, 0, 0], ray.origin, sphere.center);
  const a = dot(ray.direction, ray.direction);
  const b = 2 * dot(ray.direction, diff);
  const c = dot(diff, diff) - sphere.radius * sphere.radius;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) {
    return null;
  }
  const t = (-b - Math.sqrt(discriminant)) / (2 * a);
  if (t < 0) {
    return null;
  }
  const point = [0, 0, 0];
  add(point, ray.origin, scale(point, ray.direction, t));
  return point.slice();
}

export function projectOnAxis(ray, axis, origin, planeNormal) {
  const plane = {
    normal: planeNormal,
    point: origin
  };
  const hit = intersectPlane(ray, plane);
  if (!hit) {
    return null;
  }
  const diff = subtract([0, 0, 0], hit, origin);
  return dot(diff, axis);
}

export default {
  intersectPlane,
  intersectSphere,
  projectOnAxis
};
