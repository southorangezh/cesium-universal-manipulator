export const AXIS_COLORS = {
  x: { inactive: [1, 0.266, 0.266, 1], hover: [1, 0.5, 0.5, 1], active: [1, 0.8, 0.6, 1] },
  y: { inactive: [0.266, 1, 0.266, 1], hover: [0.5, 1, 0.5, 1], active: [0.6, 1, 0.8, 1] },
  z: { inactive: [0.266, 0.6, 1, 1], hover: [0.5, 0.7, 1, 1], active: [0.6, 0.85, 1, 1] },
  view: { inactive: [1, 1, 1, 1], hover: [1, 1, 1, 1], active: [1, 1, 1, 1] },
};

export const HANDLE_TYPES = {
  TRANSLATE_AXIS: 'translate-axis',
  TRANSLATE_PLANE: 'translate-plane',
  ROTATE_AXIS: 'rotate-axis',
  ROTATE_VIEW: 'rotate-view',
  SCALE_AXIS: 'scale-axis',
  SCALE_UNIFORM: 'scale-uniform',
};

export const MODE_HANDLES = {
  translate: ['x', 'y', 'z', 'xy', 'yz', 'xz'],
  rotate: ['x', 'y', 'z', 'view'],
  scale: ['x', 'y', 'z', 'uniform'],
};

export const AXIS_VECTORS = {
  x: { x: 1, y: 0, z: 0 },
  y: { x: 0, y: 1, z: 0 },
  z: { x: 0, y: 0, z: 1 },
};

export const PLANE_NORMALS = {
  xy: { x: 0, y: 0, z: 1 },
  yz: { x: 1, y: 0, z: 0 },
  xz: { x: 0, y: 1, z: 0 },
};

export const DEFAULT_SIZE = {
  screenRadius: 110,
  minScale: 0.2,
  maxScale: 2.5,
  axisConeLength: 0.25,
  axisConeRadius: 0.06,
};

export const MODE_TO_HANDLE_TYPE = {
  translate: HANDLE_TYPES.TRANSLATE_AXIS,
  rotate: HANDLE_TYPES.ROTATE_AXIS,
  scale: HANDLE_TYPES.SCALE_AXIS,
};
