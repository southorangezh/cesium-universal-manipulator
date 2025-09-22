import {
  add,
  angleBetween,
  clampMagnitude,
  cross,
  magnitude,
  normalize,
  projectScalar,
  rayPlaneIntersection,
  scale,
  subtract,
  ZERO_VECTOR,
  fromAxisAngle,
  quaternionMultiply,
  IDENTITY_QUATERNION,
} from './math.js';

const EPSILON = 1e-6;

function ensurePlaneNormal(axis, cameraDirection) {
  let planeNormal = cross(axis, cameraDirection);
  if (magnitude(planeNormal) < EPSILON) {
    const fallback = Math.abs(axis.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 0, y: 1, z: 0 };
    planeNormal = cross(axis, fallback);
  }
  const normal = cross(axis, planeNormal);
  if (magnitude(normal) < EPSILON) {
    return normalize(planeNormal);
  }
  return normalize(normal);
}

export function beginAxisTranslation({ axis, pivot, startRay, cameraDirection }) {
  const axisNorm = normalize(axis);
  const planeNormal = ensurePlaneNormal(axisNorm, normalize(cameraDirection));
  const startPoint =
    rayPlaneIntersection(startRay, planeNormal, pivot) ?? add(pivot, scale(axisNorm, 0));
  return {
    type: 'axis-translate',
    axis: axisNorm,
    pivot,
    planeNormal,
    startPoint,
  };
}

export function updateAxisTranslation(session, currentRay) {
  const point = rayPlaneIntersection(currentRay, session.planeNormal, session.pivot);
  if (!point) {
    return { distance: 0, vector: ZERO_VECTOR };
  }
  const deltaVector = subtract(point, session.startPoint);
  const distance = projectScalar(deltaVector, session.axis);
  const vector = scale(session.axis, distance);
  return { distance, vector };
}

export function beginPlaneTranslation({ planeNormal, pivot, startRay }) {
  const normal = normalize(planeNormal);
  const startPoint = rayPlaneIntersection(startRay, normal, pivot) ?? pivot;
  return {
    type: 'plane-translate',
    normal,
    pivot,
    startPoint,
  };
}

export function updatePlaneTranslation(session, currentRay) {
  const point = rayPlaneIntersection(currentRay, session.normal, session.pivot);
  if (!point) {
    return { vector: ZERO_VECTOR };
  }
  const vector = subtract(point, session.startPoint);
  return { vector };
}

export function beginAxisRotation({ axis, pivot, startRay }) {
  const normal = normalize(axis);
  const startPoint = rayPlaneIntersection(startRay, normal, pivot);
  const startVector = startPoint ? subtract(startPoint, pivot) : ZERO_VECTOR;
  return {
    type: 'axis-rotate',
    axis: normal,
    pivot,
    startVector: startVector,
    lastAngle: 0,
  };
}

export function updateAxisRotation(session, currentRay) {
  const point = rayPlaneIntersection(currentRay, session.axis, session.pivot);
  if (!point) {
    return { angle: 0, quaternion: IDENTITY_QUATERNION };
  }
  const vector = subtract(point, session.pivot);
  if (magnitude(vector) < EPSILON || magnitude(session.startVector) < EPSILON) {
    return { angle: 0, quaternion: IDENTITY_QUATERNION };
  }
  const angle = angleBetween(session.startVector, vector, session.axis);
  session.lastAngle = angle;
  const quaternion = fromAxisAngle(session.axis, angle);
  return { angle, quaternion };
}

export function beginViewRotation({ viewDirection, pivot, startRay }) {
  const axis = normalize(viewDirection);
  return beginAxisRotation({ axis, pivot, startRay });
}

export function beginAxisScale({ axis, pivot, startRay, cameraDirection }) {
  const axisNorm = normalize(axis);
  const planeNormal = ensurePlaneNormal(axisNorm, cameraDirection);
  const startPoint = rayPlaneIntersection(startRay, planeNormal, pivot) ?? pivot;
  const referenceVector = subtract(startPoint, pivot);
  const initialLength = Math.max(Math.abs(projectScalar(referenceVector, axisNorm)), EPSILON);
  return {
    type: 'axis-scale',
    axis: axisNorm,
    pivot,
    planeNormal,
    startPoint,
    initialLength,
  };
}

export function updateAxisScale(session, currentRay) {
  const point = rayPlaneIntersection(currentRay, session.planeNormal, session.pivot);
  if (!point) {
    return { scale: 1 };
  }
  const deltaVector = subtract(point, session.startPoint);
  const distance = projectScalar(deltaVector, session.axis);
  const factor = clampMagnitude(1 + distance / session.initialLength);
  return { scale: factor === 0 ? 1 : factor, axis: session.axis };
}

export function beginUniformScale({ pivot, startRay, cameraDirection }) {
  const normal = normalize(cameraDirection);
  const startPoint = rayPlaneIntersection(startRay, normal, pivot) ?? pivot;
  const baseDistance = magnitude(subtract(startPoint, pivot));
  return {
    type: 'uniform-scale',
    pivot,
    normal,
    startPoint,
    baseDistance: Math.max(baseDistance, EPSILON),
  };
}

export function updateUniformScale(session, currentRay) {
  const point = rayPlaneIntersection(currentRay, session.normal, session.pivot);
  if (!point) {
    return { scale: 1 };
  }
  const distance = magnitude(subtract(point, session.pivot));
  const factor = clampMagnitude(distance / session.baseDistance);
  return { scale: factor === 0 ? 1 : factor };
}

export function accumulateTranslation(delta, current) {
  return add(current ?? ZERO_VECTOR, delta);
}

export function accumulateRotation(deltaQuaternion, currentQuaternion) {
  return quaternionMultiply(deltaQuaternion, currentQuaternion ?? IDENTITY_QUATERNION);
}

export function accumulateScale(deltaScale, currentScale) {
  if (!currentScale) {
    return { x: deltaScale.x ?? deltaScale, y: deltaScale.y ?? deltaScale, z: deltaScale.z ?? deltaScale };
  }
  if (typeof deltaScale === 'number') {
    return {
      x: currentScale.x * deltaScale,
      y: currentScale.y * deltaScale,
      z: currentScale.z * deltaScale,
    };
  }
  return {
    x: currentScale.x * (deltaScale.x ?? 1),
    y: currentScale.y * (deltaScale.y ?? 1),
    z: currentScale.z * (deltaScale.z ?? 1),
  };
}
