import { AXIS_COLORS, HANDLE_TYPES, MODE_HANDLES, DEFAULT_SIZE } from './constants.js';

function colorFromArray(Cesium, array) {
  return new Cesium.Color(array[0], array[1], array[2], array[3]);
}

function toCartesian3(Cesium, vector) {
  return new Cesium.Cartesian3(vector.x, vector.y, vector.z);
}

function computeWorldScale(Cesium, scene, camera, origin, size) {
  const distance = Cesium.Cartesian3.distance(camera.position, origin);
  const canvas = scene.canvas;
  const frustum = camera.frustum;
  const fov = frustum.fovy ?? frustum.fov ?? Math.PI / 3;
  const metersPerPixel = (2 * distance * Math.tan(fov * 0.5)) / canvas.height;
  let scale = metersPerPixel * size.screenRadius;
  const minWorld = size.minScale * distance;
  const maxWorld = size.maxScale * distance;
  scale = Cesium.Math.clamp(scale, minWorld, maxWorld);
  return scale;
}

function unitCirclePoints(Cesium, axesA, axesB, origin, radius, segments) {
  const positions = [];
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const local = {
      x: Math.cos(t) * radius,
      y: Math.sin(t) * radius,
      z: 0,
    };
    const axisOffset = Cesium.Cartesian3.add(
      Cesium.Cartesian3.multiplyByScalar(axesA, local.x, new Cesium.Cartesian3()),
      Cesium.Cartesian3.multiplyByScalar(axesB, local.y, new Cesium.Cartesian3()),
      new Cesium.Cartesian3()
    );
    positions.push(Cesium.Cartesian3.add(origin, axisOffset, axisOffset));
  }
  return positions;
}

function planeSquare(Cesium, origin, axisA, axisB, size) {
  const half = size * 0.5;
  const corners = [
    { x: 0, y: 0, z: 0 },
    { x: half, y: 0, z: 0 },
    { x: half, y: half, z: 0 },
    { x: 0, y: half, z: 0 },
  ];
  return corners.map((corner) =>
    Cesium.Cartesian3.add(
      origin,
      Cesium.Cartesian3.add(
        Cesium.Cartesian3.multiplyByScalar(axisA, corner.x * 2, new Cesium.Cartesian3()),
        Cesium.Cartesian3.multiplyByScalar(axisB, corner.y * 2, new Cesium.Cartesian3()),
        new Cesium.Cartesian3()
      ),
      new Cesium.Cartesian3()
    )
  );
}

export class GizmoPrimitive {
  constructor({ Cesium, viewer, colors = {}, size = {} }) {
    if (!Cesium) {
      throw new Error('Cesium namespace is required to create GizmoPrimitive.');
    }
    this.Cesium = Cesium;
    this.viewer = viewer;
    this.scene = viewer.scene;
    this.colors = {
      x: { ...AXIS_COLORS.x, ...colors.x },
      y: { ...AXIS_COLORS.y, ...colors.y },
      z: { ...AXIS_COLORS.z, ...colors.z },
      view: { ...AXIS_COLORS.view, ...colors.view },
    };
    this.size = { ...DEFAULT_SIZE, ...size };
    this.handles = new Map();
    this.entities = [];
    this.show = true;
    this.activeHandle = null;
    this.hoverHandle = null;
    this._createHandles();
  }

  _createHandles() {
    this._createTranslationAxes();
    this._createTranslationPlanes();
    this._createScaleHandles();
    this._createRotationRings();
    this._createUniformScale();
    this.mode = 'translate';
    this._applyVisibility();
  }

  _createEntity(handleId, options) {
    const entity = this.viewer.entities.add({
      id: handleId,
      show: true,
      ...options,
    });
    this.entities.push(entity);
    return entity;
  }

  _createTranslationAxes() {
    const Cesium = this.Cesium;
    ['x', 'y', 'z'].forEach((axis) => {
      const color = colorFromArray(Cesium, this.colors[axis].inactive);
      const entity = this._createEntity(`translate-${axis}`, {
        polyline: {
          positions: [Cesium.Cartesian3.ZERO, Cesium.Cartesian3.ZERO],
          width: 4,
          material: color,
          followSurface: false,
          clampToGround: false,
          arcType: Cesium.ArcType.NONE,
          classificationType: Cesium.ClassificationType.NONE,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        point: {
          pixelSize: 16,
          color,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      entity.properties = new Cesium.PropertyBag({
        axis,
        mode: 'translate',
        type: HANDLE_TYPES.TRANSLATE_AXIS,
      });
      this.handles.set(`translate-${axis}`, { entity, axis, mode: 'translate', type: HANDLE_TYPES.TRANSLATE_AXIS });
    });
  }

  _createTranslationPlanes() {
    const Cesium = this.Cesium;
    [['xy', 'z'], ['yz', 'x'], ['xz', 'y']].forEach(([plane, axis]) => {
      const color = colorFromArray(Cesium, this.colors[axis].inactive);
      const entity = this._createEntity(`translate-${plane}`, {
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy([Cesium.Cartesian3.ZERO, Cesium.Cartesian3.ZERO, Cesium.Cartesian3.ZERO, Cesium.Cartesian3.ZERO]),
          material: color.withAlpha(0.2),
          perPositionHeight: true,
          classificationType: Cesium.ClassificationType.NONE,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        polyline: {
          positions: [Cesium.Cartesian3.ZERO, Cesium.Cartesian3.ZERO, Cesium.Cartesian3.ZERO, Cesium.Cartesian3.ZERO, Cesium.Cartesian3.ZERO],
          width: 2,
          material: color,
          arcType: Cesium.ArcType.NONE,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      entity.properties = new Cesium.PropertyBag({
        mode: 'translate',
        plane,
        axis,
        type: HANDLE_TYPES.TRANSLATE_PLANE,
      });
      this.handles.set(`translate-${plane}`, { entity, plane, mode: 'translate', type: HANDLE_TYPES.TRANSLATE_PLANE });
    });
  }

  _createScaleHandles() {
    const Cesium = this.Cesium;
    ['x', 'y', 'z'].forEach((axis) => {
      const color = colorFromArray(Cesium, this.colors[axis].inactive);
      const entity = this._createEntity(`scale-${axis}`, {
        polyline: {
          positions: [Cesium.Cartesian3.ZERO, Cesium.Cartesian3.ZERO],
          width: 3,
          material: color,
          arcType: Cesium.ArcType.NONE,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        billboard: {
          image: this._createSquareTexture(color),
          width: 22,
          height: 22,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      entity.properties = new Cesium.PropertyBag({
        axis,
        mode: 'scale',
        type: HANDLE_TYPES.SCALE_AXIS,
      });
      this.handles.set(`scale-${axis}`, { entity, axis, mode: 'scale', type: HANDLE_TYPES.SCALE_AXIS });
    });
  }

  _createRotationRings() {
    const Cesium = this.Cesium;
    ['x', 'y', 'z'].forEach((axis) => {
      const color = colorFromArray(Cesium, this.colors[axis].inactive);
      const entity = this._createEntity(`rotate-${axis}`, {
        polyline: {
          positions: new Array(65).fill(Cesium.Cartesian3.ZERO),
          width: 2,
          material: color,
          arcType: Cesium.ArcType.NONE,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      entity.properties = new Cesium.PropertyBag({
        axis,
        mode: 'rotate',
        type: HANDLE_TYPES.ROTATE_AXIS,
      });
      this.handles.set(`rotate-${axis}`, { entity, axis, mode: 'rotate', type: HANDLE_TYPES.ROTATE_AXIS });
    });

    const viewColor = colorFromArray(Cesium, this.colors.view.inactive);
    const viewEntity = this._createEntity('rotate-view', {
      polyline: {
        positions: new Array(65).fill(Cesium.Cartesian3.ZERO),
        width: 2,
        material: viewColor,
        arcType: Cesium.ArcType.NONE,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    viewEntity.properties = new Cesium.PropertyBag({
      mode: 'rotate',
      type: HANDLE_TYPES.ROTATE_VIEW,
    });
    this.handles.set('rotate-view', { entity: viewEntity, mode: 'rotate', type: HANDLE_TYPES.ROTATE_VIEW });
  }

  _createUniformScale() {
    const Cesium = this.Cesium;
    const color = colorFromArray(Cesium, this.colors.view.inactive);
    const entity = this._createEntity('scale-uniform', {
      point: {
        pixelSize: 18,
        color,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    entity.properties = new Cesium.PropertyBag({
      mode: 'scale',
      type: HANDLE_TYPES.SCALE_UNIFORM,
    });
    this.handles.set('scale-uniform', { entity, mode: 'scale', type: HANDLE_TYPES.SCALE_UNIFORM });
  }

  _createSquareTexture(color) {
    const size = 32;
    if (typeof document === 'undefined') {
      return color.toCssColorString();
    }
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    context.fillStyle = color.toCssColorString();
    context.fillRect(0, 0, size, size);
    context.clearRect(6, 6, size - 12, size - 12);
    context.lineWidth = 2;
    context.strokeStyle = color.toCssColorString();
    context.strokeRect(4, 4, size - 8, size - 8);
    return canvas;
  }

  setShow(show) {
    this.show = show;
    this._applyVisibility();
  }

  setMode(mode) {
    this.mode = mode;
    this._applyVisibility();
  }

  _applyVisibility() {
    this.entities.forEach((entity) => {
      const handle = this.handles.get(entity.id);
      const isModeMatch = handle?.mode === this.mode;
      entity.show = Boolean(this.show && isModeMatch);
    });
  }

  update(frame, camera, options = {}) {
    if (!frame) return;
    const Cesium = this.Cesium;
    const origin = new Cesium.Cartesian3(frame.origin.x, frame.origin.y, frame.origin.z);
    const axes = {
      x: toCartesian3(Cesium, frame.axes.x),
      y: toCartesian3(Cesium, frame.axes.y),
      z: toCartesian3(Cesium, frame.axes.z),
    };
    const scaleSize = computeWorldScale(Cesium, this.scene, camera, origin, {
      ...this.size,
      ...options,
    });

    this._updateTranslationAxes(origin, axes, scaleSize);
    this._updateTranslationPlanes(origin, axes, scaleSize * 0.6);
    this._updateScaleHandles(origin, axes, scaleSize * 0.8);
    this._updateRotationRings(origin, axes, scaleSize);
    this._updateUniformScale(origin);
  }

  _updateTranslationAxes(origin, axes, length) {
    const Cesium = this.Cesium;
    ['x', 'y', 'z'].forEach((axis) => {
      const handle = this.handles.get(`translate-${axis}`);
      if (!handle) return;
      const entity = handle.entity;
      const axisVector = axes[axis];
      const end = Cesium.Cartesian3.add(
        origin,
        Cesium.Cartesian3.multiplyByScalar(axisVector, length, new Cesium.Cartesian3()),
        new Cesium.Cartesian3()
      );
      entity.polyline.positions = [origin, end];
      entity.point.position = end;
    });
  }

  _updateTranslationPlanes(origin, axes, size) {
    const Cesium = this.Cesium;
    const combos = {
      xy: ['x', 'y'],
      yz: ['y', 'z'],
      xz: ['x', 'z'],
    };
    Object.entries(combos).forEach(([plane, [axisA, axisB]]) => {
      const handle = this.handles.get(`translate-${plane}`);
      if (!handle) return;
      const entity = handle.entity;
      const a = axes[axisA];
      const b = axes[axisB];
      const corners = planeSquare(Cesium, origin, a, b, size);
      entity.polygon.hierarchy = new Cesium.PolygonHierarchy(corners);
      entity.polyline.positions = [...corners, corners[0]];
    });
  }

  _updateScaleHandles(origin, axes, length) {
    const Cesium = this.Cesium;
    ['x', 'y', 'z'].forEach((axis) => {
      const handle = this.handles.get(`scale-${axis}`);
      if (!handle) return;
      const entity = handle.entity;
      const axisVector = axes[axis];
      const end = Cesium.Cartesian3.add(
        origin,
        Cesium.Cartesian3.multiplyByScalar(axisVector, length, new Cesium.Cartesian3()),
        new Cesium.Cartesian3()
      );
      entity.polyline.positions = [origin, end];
      entity.billboard.position = end;
    });
  }

  _updateRotationRings(origin, axes, radius) {
    const Cesium = this.Cesium;
    const segments = 64;
    const combos = {
      x: ['y', 'z'],
      y: ['x', 'z'],
      z: ['x', 'y'],
    };
    Object.entries(combos).forEach(([axis, [a, b]]) => {
      const handle = this.handles.get(`rotate-${axis}`);
      if (!handle) return;
      const positions = unitCirclePoints(Cesium, axes[a], axes[b], origin, radius, segments);
      handle.entity.polyline.positions = positions;
    });
    const viewHandle = this.handles.get('rotate-view');
    if (viewHandle) {
      const positions = unitCirclePoints(
        Cesium,
        axes.x,
        axes.y,
        origin,
        radius * 1.05,
        segments
      );
      viewHandle.entity.polyline.positions = positions;
    }
  }

  _updateUniformScale(origin) {
    const handle = this.handles.get('scale-uniform');
    if (!handle) return;
    handle.entity.point.position = origin;
  }

  setHover(handleId) {
    this.hoverHandle = handleId;
    this._refreshColors();
  }

  setActive(handleId) {
    this.activeHandle = handleId;
    this._refreshColors();
  }

  _refreshColors() {
    const Cesium = this.Cesium;
    this.handles.forEach((handle, id) => {
      const entity = handle.entity;
      const axis = handle.axis ?? 'view';
      const palette = this.colors[axis] ?? this.colors.view;
      let colorArray = palette.inactive;
      if (this.activeHandle === id) {
        colorArray = palette.active ?? palette.hover ?? palette.inactive;
      } else if (this.hoverHandle === id) {
        colorArray = palette.hover ?? palette.inactive;
      }
      const color = colorFromArray(Cesium, colorArray);
      if (entity.polyline) {
        entity.polyline.material = color;
      }
      if (entity.point) {
        entity.point.color = color;
      }
      if (entity.billboard) {
        entity.billboard.color = color;
      }
      if (entity.polygon) {
        entity.polygon.material = color.withAlpha(0.2);
      }
    });
  }

  destroy() {
    this.entities.forEach((entity) => {
      this.viewer.entities.remove(entity);
    });
    this.entities.length = 0;
    this.handles.clear();
  }
}
