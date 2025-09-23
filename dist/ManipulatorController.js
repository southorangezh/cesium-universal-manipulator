import {
  beginAxisTranslation,
  updateAxisTranslation,
  beginPlaneTranslation,
  updatePlaneTranslation,
  beginAxisRotation,
  updateAxisRotation,
  beginViewRotation,
  beginAxisScale,
  updateAxisScale,
  beginUniformScale,
  updateUniformScale,
} from './TransformSolver.js';
import { Snapper } from './Snapper.js';
import { PivotResolver } from './PivotResolver.js';
import { FrameBuilder } from './FrameBuilder.js';
import {
  add,
  composeTransform,
  decomposeTransform,
  dot,
  normalize,
  projectOnVector,
  rotateVectorByQuaternion,
  scale as scaleVector,
  subtract,
  ZERO_VECTOR,
  quaternionMultiply,
} from './math.js';
import { HudOverlay } from './HudOverlay.js';
import {
  parseDistanceInput,
  parseAngleInput,
  parseScaleInput,
  parsePlaneInput,
} from './ValueParser.js';

function cartesianToVector(cart) {
  if (!cart) return ZERO_VECTOR;
  return { x: cart.x, y: cart.y, z: cart.z };
}

function rayToSimple(ray) {
  return {
    origin: cartesianToVector(ray.origin),
    direction: cartesianToVector(ray.direction),
  };
}

function cloneMatrix(matrix, Cesium) {
  if (!matrix) {
    return null;
  }
  if (Array.isArray(matrix)) {
    return matrix.slice();
  }
  if (typeof matrix.length === 'number') {
    return Array.from(matrix);
  }
  if (Cesium?.Matrix4 && matrix instanceof Cesium.Matrix4) {
    const result = new Array(16);
    Cesium.Matrix4.toArray(matrix, result);
    return result;
  }
  if (matrix.elements && typeof matrix.elements.length === 'number') {
    return Array.from(matrix.elements);
  }
  if (typeof matrix.toArray === 'function') {
    const result = matrix.toArray();
    return Array.isArray(result) ? result.slice() : Array.from(result ?? []);
  }
  return null;
}

function getTargetMatrix(target, Cesium, time) {
  if (!target) return null;
  if (target.matrix) {
    return cloneMatrix(target.matrix, Cesium);
  }
  if (target.modelMatrix) {
    return cloneMatrix(target.modelMatrix, Cesium);
  }
  if (typeof target.getWorldMatrix === 'function') {
    const matrix = target.getWorldMatrix();
    return cloneMatrix(matrix, Cesium);
  }
  if (typeof target.computeModelMatrix === 'function') {
    const when = time ?? (Cesium?.JulianDate?.now ? Cesium.JulianDate.now() : undefined);
    if (when) {
      const matrix = target.computeModelMatrix(when);
      return cloneMatrix(matrix, Cesium);
    }
  }
  if (target.entity && target.entity !== target) {
    return getTargetMatrix(target.entity, Cesium, time);
  }
  return null;
}

function ensureConstantProperty(propertyCtor, current, value) {
  if (!current) {
    return new propertyCtor(value);
  }
  if (typeof current.setValue === 'function') {
    current.setValue(value);
    return current;
  }
  return new propertyCtor(value);
}

function setEntityTransform(entity, matrix, Cesium) {
  if (!Cesium) return;
  const components = decomposeTransform(matrix);
  const { translation, rotation, scale } = components;
  const Cartesian3 = Cesium.Cartesian3;
  const Quaternion = Cesium.Quaternion;
  if (Cartesian3 && entity.position !== undefined) {
    const cart = new Cartesian3(translation.x, translation.y, translation.z);
    const PositionProperty = Cesium.ConstantPositionProperty ?? Cesium.ConstantProperty;
    if (PositionProperty) {
      entity.position = ensureConstantProperty(PositionProperty, entity.position, cart);
    } else {
      entity.position = cart;
    }
  }
  if (Quaternion && entity.orientation !== undefined) {
    const quat = new Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
    const OrientationProperty = Cesium.ConstantProperty;
    if (OrientationProperty) {
      entity.orientation = ensureConstantProperty(OrientationProperty, entity.orientation, quat);
    } else {
      entity.orientation = quat;
    }
  }
  if (entity.model) {
    const uniform = (scale.x + scale.y + scale.z) / 3;
    const ScaleProperty = Cesium.ConstantProperty;
    if (ScaleProperty) {
      entity.model.scale = ensureConstantProperty(ScaleProperty, entity.model.scale, uniform);
    } else {
      entity.model.scale = uniform;
    }
  }
}

function setTargetMatrix(target, matrix, Cesium) {
  if (target.matrix) {
    target.matrix = matrix.slice();
    return;
  }
  if (target.modelMatrix) {
    target.modelMatrix = matrix.slice();
    return;
  }
  if (typeof target.setMatrix === 'function') {
    target.setMatrix(matrix);
    return;
  }
  const entity = target.entity ?? target;
  if (entity && typeof entity.computeModelMatrix === 'function') {
    setEntityTransform(entity, matrix, Cesium);
  }
}

function createEnuSpace(Cesium, pivot, ellipsoid) {
  const basisIdentity = {
    x: { x: 1, y: 0, z: 0 },
    y: { x: 0, y: 1, z: 0 },
    z: { x: 0, y: 0, z: 1 },
  };
  if (!Cesium?.Transforms?.eastNorthUpToFixedFrame || !Cesium?.Cartesian3) {
    return {
      pivot,
      basis: basisIdentity,
      toDirection: (vector) => ({ ...vector }),
      fromDirection: (vector) => ({ ...vector }),
      toPoint: (point) => subtract(point, pivot),
      fromPoint: (point) => add(pivot, point),
    };
  }
  const pivotCartesian = new Cesium.Cartesian3(pivot.x, pivot.y, pivot.z);
  const matrix = Cesium.Transforms.eastNorthUpToFixedFrame(pivotCartesian, ellipsoid);
  if (!matrix) {
    return {
      pivot,
      basis: basisIdentity,
      toDirection: (vector) => ({ ...vector }),
      fromDirection: (vector) => ({ ...vector }),
      toPoint: (point) => subtract(point, pivot),
      fromPoint: (point) => add(pivot, point),
    };
  }
  const basis = {
    x: { x: matrix[0], y: matrix[4], z: matrix[8] },
    y: { x: matrix[1], y: matrix[5], z: matrix[9] },
    z: { x: matrix[2], y: matrix[6], z: matrix[10] },
  };
  const toDirection = (vector) => ({
    x: dot(vector, basis.x),
    y: dot(vector, basis.y),
    z: dot(vector, basis.z),
  });
  const fromDirection = (vector) =>
    add(
      add(scaleVector(basis.x, vector.x), scaleVector(basis.y, vector.y)),
      scaleVector(basis.z, vector.z)
    );
  const toPoint = (point) => toDirection(subtract(point, pivot));
  const fromPoint = (point) => add(pivot, fromDirection(point));
  return { pivot, basis, toDirection, fromDirection, toPoint, fromPoint };
}

function matricesEqual(a, b, epsilon = 1e-8) {
  if (a === b) return true;
  if (!a || !b) return false;
  for (let i = 0; i < 16; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    if (Math.abs(ai - bi) > epsilon) {
      return false;
    }
  }
  return true;
}

export class ManipulatorController {
  constructor({ Cesium, viewer, gizmo, picker, frameBuilder, snapper, pivotResolver, hud }) {
    this.Cesium = Cesium;
    this.viewer = viewer;
    this.scene = viewer.scene;
    this.gizmo = gizmo;
    this.picker = picker;
    this.frameBuilder = frameBuilder ?? new FrameBuilder({ Cesium });
    this.snapper = snapper ?? new Snapper();
    this.pivotResolver = pivotResolver ?? new PivotResolver();
    this.hud = hud ?? new HudOverlay({ container: viewer.container });
    this.mode = 'translate';
    this.orientation = { type: 'global' };
    this.targets = [];
    this.state = 'idle';
    this.currentHandle = null;
    this.dragSession = null;
    this.frame = null;
    this.pivotData = null;
    this.clock = viewer.clock;
    this._keyState = { ctrlKey: false, shiftKey: false, altKey: false };
    this._typedInput = '';
    this._hudState = {};
    this._history = { undo: [], redo: [] };
    this._cameraControllerState = null;
    this._registerKeyEvents();
    this._createHandler();
  }

  _registerKeyEvents() {
    if (typeof document === 'undefined') return;
    this._keyDownListener = (event) => {
      this._updateModifierState(event);
      this._handleKeyDown(event);
    };
    this._keyUpListener = (event) => {
      this._updateModifierState(event);
    };
    document.addEventListener('keydown', this._keyDownListener);
    document.addEventListener('keyup', this._keyUpListener);
  }

  _updateModifierState(event) {
    this._keyState = {
      ctrlKey: event.ctrlKey || event.metaKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
    };
  }

  _handleKeyDown(event) {
    const key = event.key;
    const isUndoCombo = (event.ctrlKey || event.metaKey) && !event.shiftKey && key.toLowerCase() === 'z';
    const isRedoCombo =
      (event.ctrlKey || event.metaKey) &&
      ((event.shiftKey && key.toLowerCase() === 'z') || key.toLowerCase() === 'y');
    if (isUndoCombo) {
      event.preventDefault();
      this.undo();
      return;
    }
    if (isRedoCombo) {
      event.preventDefault();
      this.redo();
      return;
    }

    if (this.state !== 'dragging') {
      return;
    }

    if (key === 'Escape') {
      event.preventDefault();
      this._finishDrag(true);
      return;
    }
    if (key === 'Enter') {
      event.preventDefault();
      this._applyTypedInput();
      return;
    }
    if (key === 'Backspace') {
      event.preventDefault();
      if (this._typedInput.length) {
        this._typedInput = this._typedInput.slice(0, -1);
        this._refreshHud();
      }
      return;
    }
    if (key.length === 1 && !(event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      this._typedInput += key;
      this._refreshHud();
    }
  }

  _setHudState(partial) {
    this._hudState = { ...this._hudState, ...partial };
    this._refreshHud();
  }

  _refreshHud() {
    if (!this.hud) return;
    this.hud.update({ ...this._hudState, input: this._typedInput });
  }

  _createHandler() {
    const Cesium = this.Cesium;
    this.handler = new Cesium.ScreenSpaceEventHandler(this.scene.canvas);
    this.handler.setInputAction((movement) => {
      this._onPointerMove(movement.endPosition ?? movement.position);
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    this.handler.setInputAction((movement) => {
      this._onPointerDown(movement.position);
    }, Cesium.ScreenSpaceEventType.LEFT_DOWN);
    this.handler.setInputAction((movement) => {
      this._onPointerUp(movement.position);
    }, Cesium.ScreenSpaceEventType.LEFT_UP);
    this.handler.setInputAction(() => {
      this._cancelDrag();
    }, Cesium.ScreenSpaceEventType.RIGHT_DOWN);
  }

  setMode(mode) {
    this.mode = mode;
    this.gizmo.setMode(mode);
  }

  _requestRender() {
    const scene = this.scene ?? this.viewer?.scene;
    if (scene?.requestRender) {
      scene.requestRender();
    }
  }

  _lockCamera() {
    const controller = this.viewer?.scene?.screenSpaceCameraController;
    if (!controller || this._cameraControllerState) {
      return;
    }
    this._cameraControllerState = {
      enableRotate: controller.enableRotate,
      enableTranslate: controller.enableTranslate,
      enableZoom: controller.enableZoom,
      enableTilt: controller.enableTilt,
      enableLook: controller.enableLook,
    };
    controller.enableRotate = false;
    controller.enableTranslate = false;
    controller.enableZoom = false;
    controller.enableTilt = false;
    controller.enableLook = false;
  }

  _unlockCamera() {
    const controller = this.viewer?.scene?.screenSpaceCameraController;
    if (!controller || !this._cameraControllerState) {
      return;
    }
    controller.enableRotate = this._cameraControllerState.enableRotate;
    controller.enableTranslate = this._cameraControllerState.enableTranslate;
    controller.enableZoom = this._cameraControllerState.enableZoom;
    controller.enableTilt = this._cameraControllerState.enableTilt;
    controller.enableLook = this._cameraControllerState.enableLook;
    this._cameraControllerState = null;
  }

  setOrientation(orientation) {
    if (typeof orientation === 'string') {
      this.orientation = { type: orientation };
    } else if (orientation && typeof orientation === 'object') {
      const { type = 'global', normal = null, gimbal = {} } = orientation;
      this.orientation = {
        type,
        normal,
        gimbal: {
          yaw: gimbal.yaw ?? 0,
          pitch: gimbal.pitch ?? 0,
        },
      };
    } else {
      this.orientation = { type: 'global' };
    }
    this._updateFrame();
  }

  setPivot(pivot) {
    this.pivotResolver.setMode(pivot);
    this._updateFrame();
  }

  setTargets(targets) {
    this.targets = Array.isArray(targets) ? targets : targets ? [targets] : [];
    this._updateFrame();
  }

  setSnap(config) {
    this.snapper.setConfig(config);
  }

  enableHud(show) {
    this.hud.setVisible(show);
  }

  _updateFrame() {
    if (!this.targets.length) return;
    const primary = this.targets[0];
    const orientation = this.orientation?.type ?? 'global';
    const gimbal = this.orientation?.gimbal ?? {};
    this.frame = this.frameBuilder.buildFrame({
      target: primary,
      orientation,
      camera: this.scene.camera,
      normal: this.orientation?.normal ?? null,
      gimbalYaw: gimbal.yaw ?? 0,
      gimbalPitch: gimbal.pitch ?? 0,
    });
    this.gizmo.update(this.frame, this.scene.camera);
    this._requestRender();
  }

  _onPointerMove(position) {
    if (!position) return;
    if (this.state === 'dragging') {
      this._updateDrag(position);
      return;
    }
    const handle = this.picker.pick(position);
    if (handle) {
      this.gizmo.setHover(handle.id);
    } else {
      this.gizmo.setHover(null);
    }
  }

  _onPointerDown(position) {
    if (!position) return;
    const handle = this.picker.drillPick(position);
    if (!handle) return;
    this.currentHandle = handle;
    this.gizmo.setActive(handle.id);
    this.state = 'dragging';
    this.hud.setVisible(true);
    this._beginDrag(position, handle);
  }

  _beginDrag(position, handle) {
    const camera = this.scene.camera;
    const ray = camera.getPickRay(position);
    if (!ray) return;
    this._updateFrame();
    this._typedInput = '';
    this._hudState = {};
    const simpleRay = rayToSimple(ray);
    const cameraDirection = cartesianToVector(camera.direction);
    const time = this._currentTime();
    const pivot = this.pivotResolver.resolve(this.targets, { time, Cesium: this.Cesium });
    this.pivotData = pivot;
    const startTransforms = this.targets.map((target) => {
      const matrix = getTargetMatrix(target, this.Cesium, time);
      const transform = decomposeTransform(matrix);
      const baseMatrix = matrix ?? composeTransform(transform.translation, transform.rotation, transform.scale);
      return { target, matrix: baseMatrix, transform };
    });
    const space = createEnuSpace(this.Cesium, pivot.pivot, this.frameBuilder.ellipsoid);
    const startRayEnu = {
      origin: space.toPoint(simpleRay.origin),
      direction: space.toDirection(simpleRay.direction),
    };
    const cameraDirectionEnu = space.toDirection(cameraDirection);
    const axesEnu = {
      x: space.toDirection(this.frame.axes.x),
      y: space.toDirection(this.frame.axes.y),
      z: space.toDirection(this.frame.axes.z),
    };
    const planeBases = {
      xy: [axesEnu.x, axesEnu.y],
      yz: [axesEnu.y, axesEnu.z],
      xz: [axesEnu.x, axesEnu.z],
    };
    this.dragSession = {
      handle,
      startRay: simpleRay,
      startTransforms,
      pivot,
      space,
      axesEnu,
      planeBases,
    };

    this._lockCamera();

    switch (handle.type) {
      case 'translate-axis':
        this.dragSession.operation = beginAxisTranslation({
          axis: axesEnu[handle.axis],
          pivot: ZERO_VECTOR,
          startRay: startRayEnu,
          cameraDirection: cameraDirectionEnu,
        });
        break;
      case 'translate-plane':
        this.dragSession.operation = beginPlaneTranslation({
          planeNormal: space.toDirection(this._planeNormalForHandle(handle)),
          pivot: ZERO_VECTOR,
          startRay: startRayEnu,
        });
        break;
      case 'rotate-axis':
        this.dragSession.operation = beginAxisRotation({
          axis: axesEnu[handle.axis],
          pivot: ZERO_VECTOR,
          startRay: startRayEnu,
        });
        break;
      case 'rotate-view':
        this.dragSession.operation = beginViewRotation({
          viewDirection: cameraDirectionEnu,
          pivot: ZERO_VECTOR,
          startRay: startRayEnu,
        });
        break;
      case 'scale-axis':
        this.dragSession.operation = beginAxisScale({
          axis: axesEnu[handle.axis],
          pivot: ZERO_VECTOR,
          startRay: startRayEnu,
          cameraDirection: cameraDirectionEnu,
        });
        break;
      case 'scale-uniform':
        this.dragSession.operation = beginUniformScale({
          pivot: ZERO_VECTOR,
          startRay: startRayEnu,
          cameraDirection: cameraDirectionEnu,
        });
        break;
      default:
        break;
    }
  }

  _updateDrag(position) {
    if (!this.dragSession) return;
    const camera = this.scene.camera;
    const ray = camera.getPickRay(position);
    if (!ray) return;
    const simpleRay = rayToSimple(ray);
    const space = this.dragSession.space;
    const currentRayEnu = {
      origin: space.toPoint(simpleRay.origin),
      direction: space.toDirection(simpleRay.direction),
    };
    const modifiers = this._keyState;
    const handle = this.dragSession.handle;
    let hudState = null;
    switch (handle.type) {
      case 'translate-axis': {
        const delta = updateAxisTranslation(this.dragSession.operation, currentRayEnu);
        const snapped = this.snapper.snapTranslation(delta.distance, modifiers);
        const enuVector = scaleVector(this.dragSession.operation.axis, snapped);
        const worldVector = space.fromDirection(enuVector);
        this._applyTranslation(worldVector);
        hudState = { mode: 'translate', axis: handle.axis, values: { [handle.axis]: snapped }, units: 'm' };
        break;
      }
      case 'translate-plane': {
        const delta = updatePlaneTranslation(this.dragSession.operation, currentRayEnu);
        const worldVector = space.fromDirection(delta.vector);
        this._applyTranslation(worldVector);
        const labels = handle.plane.split('');
        const bases = this.dragSession.planeBases[handle.plane];
        const planeValues = {
          [labels[0]]: dot(delta.vector, bases[0]),
          [labels[1]]: dot(delta.vector, bases[1]),
        };
        hudState = { mode: 'translate', plane: handle.plane, values: planeValues, units: 'm' };
        break;
      }
      case 'rotate-axis': {
        const delta = updateAxisRotation(this.dragSession.operation, currentRayEnu);
        const angle = this.snapper.snapRotation(delta.angle, modifiers);
        const worldAxis = normalize(space.fromDirection(this.dragSession.operation.axis));
        this._applyRotation(worldAxis, angle);
        hudState = { mode: 'rotate', axis: handle.axis, values: angle, units: 'rad' };
        break;
      }
      case 'rotate-view': {
        const delta = updateAxisRotation(this.dragSession.operation, currentRayEnu);
        const angle = this.snapper.snapRotation(delta.angle, modifiers);
        const worldAxis = normalize(space.fromDirection(this.dragSession.operation.axis));
        this._applyRotation(worldAxis, angle);
        hudState = { mode: 'rotate', axis: 'view', values: angle, units: 'rad' };
        break;
      }
      case 'scale-axis': {
        const delta = updateAxisScale(this.dragSession.operation, currentRayEnu);
        const factor = this.snapper.snapScale(delta.scale, modifiers);
        const worldAxis = normalize(space.fromDirection(this.dragSession.operation.axis));
        this._applyAxisScale(handle.axis, factor, worldAxis);
        hudState = { mode: 'scale', axis: handle.axis, values: factor };
        break;
      }
      case 'scale-uniform': {
        const delta = updateUniformScale(this.dragSession.operation, currentRayEnu);
        const factor = this.snapper.snapScale(delta.scale, modifiers);
        this._applyUniformScale(factor);
        hudState = { mode: 'scale', axis: 'uniform', values: factor };
        break;
      }
      default:
        break;
    }
    if (hudState) {
      this._setHudState(hudState);
    }
    this._updateFrame();
    this._requestRender();
  }

  _applyTranslation(vector) {
    this.dragSession.startTransforms.forEach((entry) => {
      const translation = add(entry.transform.translation, vector);
      const matrix = composeTransform(translation, entry.transform.rotation, entry.transform.scale);
      setTargetMatrix(entry.target, matrix, this.Cesium);
    });
    this._requestRender();
  }

  _applyRotation(axisVector, angle) {
    const rotationQuaternion = {
      x: axisVector.x * Math.sin(angle / 2),
      y: axisVector.y * Math.sin(angle / 2),
      z: axisVector.z * Math.sin(angle / 2),
      w: Math.cos(angle / 2),
    };
    this.dragSession.startTransforms.forEach((entry) => {
      const pivot = this.pivotData.perTarget.get(entry.target) ?? this.pivotData.pivot;
      const relative = subtract(entry.transform.translation, pivot);
      const rotated = rotateVectorByQuaternion(relative, rotationQuaternion);
      const translation = add(pivot, rotated);
      const rotation = quaternionMultiply(rotationQuaternion, entry.transform.rotation);
      const matrix = composeTransform(translation, rotation, entry.transform.scale);
      setTargetMatrix(entry.target, matrix, this.Cesium);
    });
    this._requestRender();
  }

  _applyAxisScale(axis, factor, axisVectorOverride) {
    const axisVector = axisVectorOverride ?? this.frame.axes[axis];
    this.dragSession.startTransforms.forEach((entry) => {
      const pivot = this.pivotData.perTarget.get(entry.target) ?? this.pivotData.pivot;
      const relative = subtract(entry.transform.translation, pivot);
      const along = projectOnVector(relative, axisVector);
      const perpendicular = subtract(relative, along);
      const scaledAlong = scaleVector(along, factor);
      const translation = add(pivot, add(perpendicular, scaledAlong));
      const scale = {
        x: entry.transform.scale.x * (axis === 'x' ? factor : 1),
        y: entry.transform.scale.y * (axis === 'y' ? factor : 1),
        z: entry.transform.scale.z * (axis === 'z' ? factor : 1),
      };
      const matrix = composeTransform(translation, entry.transform.rotation, scale);
      setTargetMatrix(entry.target, matrix, this.Cesium);
    });
    this._requestRender();
  }

  _applyUniformScale(factor) {
    this.dragSession.startTransforms.forEach((entry) => {
      const pivot = this.pivotData.perTarget.get(entry.target) ?? this.pivotData.pivot;
      const relative = subtract(entry.transform.translation, pivot);
      const translation = add(pivot, scaleVector(relative, factor));
      const scale = {
        x: entry.transform.scale.x * factor,
        y: entry.transform.scale.y * factor,
        z: entry.transform.scale.z * factor,
      };
      const matrix = composeTransform(translation, entry.transform.rotation, scale);
      setTargetMatrix(entry.target, matrix, this.Cesium);
    });
    this._requestRender();
  }

  _planeNormalForHandle(handle) {
    switch (handle.plane) {
      case 'xy':
        return this.frame.axes.z;
      case 'yz':
        return this.frame.axes.x;
      case 'xz':
        return this.frame.axes.y;
      default:
        return this.frame.axes.z;
    }
  }

  _onPointerUp() {
    if (this.state === 'dragging') {
      this._finishDrag(false);
    }
  }

  _cancelDrag() {
    if (this.state === 'dragging') {
      this._finishDrag(true);
    }
  }

  _finishDrag(cancelled) {
    if (!this.dragSession) return;
    if (cancelled) {
      this._restoreStartTransforms();
    } else {
      this._recordHistory();
    }
    this._unlockCamera();
    this.state = 'idle';
    this.gizmo.setActive(null);
    this.hud.setVisible(false);
    this.dragSession = null;
    this.pivotData = null;
    this._typedInput = '';
    this._hudState = {};
    this.currentHandle = null;
    this._updateFrame();
    this._requestRender();
  }

  _restoreStartTransforms() {
    if (!this.dragSession?.startTransforms) return;
    this.dragSession.startTransforms.forEach((entry) => {
      if (entry.matrix) {
        setTargetMatrix(entry.target, entry.matrix.slice(), this.Cesium);
      }
    });
    this._requestRender();
  }

  _recordHistory() {
    if (!this.dragSession?.startTransforms) return;
    const time = this._currentTime();
    const items = this.dragSession.startTransforms.map((entry) => {
      const after = getTargetMatrix(entry.target, this.Cesium, time);
      return { target: entry.target, before: entry.matrix.slice(), after };
    });
    const changed = items.some((item) => !matricesEqual(item.before, item.after));
    if (!changed) {
      return;
    }
    this._history.undo.push({ items });
    this._history.redo = [];
  }

  _applyTypedInput() {
    if (!this.dragSession) return;
    const raw = this._typedInput.trim();
    if (!raw) return;
    const handle = this.dragSession.handle;
    const space = this.dragSession.space;
    let hudState = null;
    switch (handle.type) {
      case 'translate-axis': {
        const parsed = parseDistanceInput(raw);
        if (!parsed) return;
        const enuVector = scaleVector(this.dragSession.operation.axis, parsed.value);
        const worldVector = space.fromDirection(enuVector);
        this._applyTranslation(worldVector);
        hudState = {
          mode: 'translate',
          axis: handle.axis,
          values: { [handle.axis]: parsed.value },
          units: parsed.unit ?? 'm',
        };
        break;
      }
      case 'translate-plane': {
        const parsed = parsePlaneInput(raw);
        if (!parsed) return;
        const bases = this.dragSession.planeBases[handle.plane];
        if (!bases) return;
        const enuVector = add(scaleVector(bases[0], parsed.values[0]), scaleVector(bases[1], parsed.values[1]));
        const worldVector = space.fromDirection(enuVector);
        this._applyTranslation(worldVector);
        const labels = handle.plane.split('');
        hudState = {
          mode: 'translate',
          plane: handle.plane,
          values: { [labels[0]]: parsed.values[0], [labels[1]]: parsed.values[1] },
          units: parsed.unit ?? 'm',
        };
        break;
      }
      case 'rotate-axis':
      case 'rotate-view': {
        const parsed = parseAngleInput(raw);
        if (parsed == null) return;
        const worldAxis = normalize(space.fromDirection(this.dragSession.operation.axis));
        this._applyRotation(worldAxis, parsed);
        hudState = {
          mode: 'rotate',
          axis: handle.type === 'rotate-view' ? 'view' : handle.axis,
          values: parsed,
          units: 'rad',
        };
        break;
      }
      case 'scale-axis': {
        const parsed = parseScaleInput(raw);
        if (parsed == null) return;
        const worldAxis = normalize(space.fromDirection(this.dragSession.operation.axis));
        this._applyAxisScale(handle.axis, parsed, worldAxis);
        hudState = { mode: 'scale', axis: handle.axis, values: parsed };
        break;
      }
      case 'scale-uniform': {
        const parsed = parseScaleInput(raw);
        if (parsed == null) return;
        this._applyUniformScale(parsed);
        hudState = { mode: 'scale', axis: 'uniform', values: parsed };
        break;
      }
      default:
        return;
    }
    this._typedInput = '';
    if (hudState) {
      this._setHudState(hudState);
    }
    this._finishDrag(false);
  }

  _applyHistory(command, phase) {
    command.items.forEach((item) => {
      const matrix = phase === 'after' ? item.after : item.before;
      if (matrix) {
        setTargetMatrix(item.target, matrix.slice(), this.Cesium);
      }
    });
    this._updateFrame();
    this._requestRender();
  }

  _currentTime() {
    if (this.clock?.currentTime) {
      return this.clock.currentTime;
    }
    if (this.Cesium?.JulianDate?.now) {
      return this.Cesium.JulianDate.now();
    }
    return undefined;
  }

  undo() {
    if (this.state === 'dragging') return;
    const command = this._history.undo.pop();
    if (!command) return;
    this._applyHistory(command, 'before');
    this._history.redo.push(command);
  }

  redo() {
    if (this.state === 'dragging') return;
    const command = this._history.redo.pop();
    if (!command) return;
    this._applyHistory(command, 'after');
    this._history.undo.push(command);
  }

  destroy() {
    this._unlockCamera();
    this.handler?.destroy();
    if (typeof document !== 'undefined') {
      document.removeEventListener('keydown', this._keyDownListener);
      document.removeEventListener('keyup', this._keyUpListener);
    }
    this.hud.destroy();
  }
}
