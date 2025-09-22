import { compose, getRotation, getScale, getTranslation } from '../math/matrix4.js';
import { multiply as multiplyQuat, normalize as normalizeQuat, applyToVector } from '../math/quaternion.js';
import { subtract, add } from '../math/vector.js';

export function decompose(matrix) {
  const translation = getTranslation([0, 0, 0], matrix);
  const rotation = getRotation([0, 0, 0, 1], matrix);
  const scale = getScale([0, 0, 0], matrix);
  return { translation, rotation, scale };
}

export function composeTRS(translation, rotation, scale) {
  return compose(translation, rotation, scale);
}

export function applyTranslation(matrix, delta) {
  const { translation, rotation, scale } = decompose(matrix);
  const resultTranslation = [
    translation[0] + delta[0],
    translation[1] + delta[1],
    translation[2] + delta[2]
  ];
  return compose(resultTranslation, rotation, scale);
}

export function applyScale(matrix, scaleDelta, pivot) {
  const { translation, rotation, scale } = decompose(matrix);
  const resultScale = [
    scale[0] * scaleDelta[0],
    scale[1] * scaleDelta[1],
    scale[2] * scaleDelta[2]
  ];
  let resultTranslation = translation.slice();
  if (pivot) {
    const offset = subtract([0, 0, 0], translation, pivot);
    const scaledOffset = [
      offset[0] * scaleDelta[0],
      offset[1] * scaleDelta[1],
      offset[2] * scaleDelta[2]
    ];
    resultTranslation = add([0, 0, 0], pivot, scaledOffset);
  }
  return compose(resultTranslation, rotation, resultScale);
}

export function applyRotation(matrix, rotationDelta, pivot) {
  const { translation, rotation, scale } = decompose(matrix);
  const resultRotation = normalizeQuat(multiplyQuat(rotationDelta, rotation));
  let resultTranslation = translation.slice();
  if (pivot) {
    const offset = subtract([0, 0, 0], translation, pivot);
    const rotated = applyToVector(rotationDelta, offset);
    resultTranslation = add([0, 0, 0], pivot, rotated);
  }
  return compose(resultTranslation, resultRotation, scale);
}

export function applyDelta(matrix, delta, pivot) {
  let result = matrix.slice();
  if (delta.translation) {
    result = applyTranslation(result, delta.translation);
  }
  if (delta.rotation) {
    result = applyRotation(result, delta.rotation, pivot);
  }
  if (delta.scale) {
    result = applyScale(result, delta.scale, pivot);
  }
  return result;
}

export default {
  decompose,
  composeTRS,
  applyTranslation,
  applyScale,
  applyRotation,
  applyDelta
};
