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
  projectOnVector,
  rotateVectorByQuaternion,
  scale as scaleVector,
  subtract,
  ZERO_VECTOR,
  quaternionMultiply,
} from './math.js';
import { HudOverlay } from './HudOverlay.js';

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

function cloneMatrix(matrix) {
  return matrix.slice();
}

function getTargetMatrix(target, Cesium) {
  if (!target) return null;
  if (target.matrix) {
    return target.matrix.slice();
  }
  if (target.modelMatrix) {
    return target.modelMatrix.slice();
  }
  if (typeof target.getWorldMatrix === 'function') {
    return cloneMatrix(target.getWorldMatrix());
  }
  if (target.entity && typeof target.entity.computeModelMatrix === 'function') {
    const time = Cesium?.JulianDate?.now ? Cesium.JulianDate.now() : undefined;
    return cloneMatrix(target.entity.computeModelMatrix(time));
  }
  return null;
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
  if (target.entity) {
    const translation = { x: matrix[3], y: matrix[7], z: matrix[11] };
    const rotationMatrix = [
      matrix[0], matrix[1], matrix[2],
      matrix[4], matrix[5], matrix[6],
      matrix[8], matrix[9], matrix[10],
    ];
    const scale = {
      x: Math.hypot(matrix[0], matrix[4], matrix[8]),
      y: Math.hypot(matrix[1], matrix[5], matrix[9]),
      z: Math.hypot(matrix[2], matrix[6], matrix[10]),
    };
    if (Cesium && target.entity.position) {
      target.entity.position = new Cesium.ConstantPositionProperty(
        new Cesium.Cartesian3(translation.x, translation.y, translation.z)
      );
    }
    if (Cesium && target.entity.orientation) {
      const quaternion = Cesium.Quaternion.fromRotationMatrix(
        Cesium.Matrix3.fromArray(rotationMatrix)
      );
      target.entity.orientation = new Cesium.ConstantProperty(quaternion);
    }
    if (target.entity.model) {
      target.entity.model.scale = (scale.x + scale.y + scale.z) / 3;
    }
  }
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
    this.orientation = 'global';
    this.targets = [];
    this.state = 'idle';
    this.currentHandle = null;
    this.dragSession = null;
    this.frame = null;
    this.pivotData = null;
    this.clock = viewer.clock;
    this._keyState = { ctrlKey: false, shiftKey: false, altKey: false };
    this._registerKeyEvents();
    this._createHandler();
  }

  _registerKeyEvents() {
    if (typeof document === 'undefined') return;
    this._keyDownListener = (event) => {
      this._keyState = {
        ctrlKey: event.ctrlKey || event.metaKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
      };
    };
    this._keyUpListener = (event) => {
      this._keyState = {
        ctrlKey: event.ctrlKey || event.metaKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
      };
    };
    document.addEventListener('keydown', this._keyDownListener);
    document.addEventListener('keyup', this._keyUpListener);
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

  setOrientation(orientation) {
    this.orientation = orientation;
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
    this.frame = this.frameBuilder.buildFrame({
      target: primary,
      orientation: this.orientation,
      camera: this.scene.camera,
    });
    this.gizmo.update(this.frame, this.scene.camera);
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
    const simpleRay = rayToSimple(ray);
    const cameraDirection = cartesianToVector(camera.direction);
    const pivot = this.pivotResolver.resolve(this.targets);
    this.pivotData = pivot;
    const startTransforms = this.targets.map((target) => {
      const matrix = getTargetMatrix(target, this.Cesium);
      const transform = decomposeTransform(matrix);
      return { target, matrix, transform };
    });
    this.dragSession = {
      handle,
      startRay: simpleRay,
      startTransforms,
      pivot,
    };

    switch (handle.type) {
      case 'translate-axis':
        this.dragSession.operation = beginAxisTranslation({
          axis: this.frame.axes[handle.axis],
          pivot: pivot.pivot,
          startRay: simpleRay,
          cameraDirection,
        });
        break;
      case 'translate-plane':
        this.dragSession.operation = beginPlaneTranslation({
          planeNormal: this._planeNormalForHandle(handle),
          pivot: pivot.pivot,
          startRay: simpleRay,
        });
        break;
      case 'rotate-axis':
        this.dragSession.operation = beginAxisRotation({
          axis: this.frame.axes[handle.axis],
          pivot: pivot.pivot,
          startRay: simpleRay,
        });
        break;
      case 'rotate-view':
        this.dragSession.operation = beginViewRotation({
          viewDirection: cameraDirection,
          pivot: pivot.pivot,
          startRay: simpleRay,
        });
        break;
      case 'scale-axis':
        this.dragSession.operation = beginAxisScale({
          axis: this.frame.axes[handle.axis],
          pivot: pivot.pivot,
          startRay: simpleRay,
          cameraDirection,
        });
        break;
      case 'scale-uniform':
        this.dragSession.operation = beginUniformScale({
          pivot: pivot.pivot,
          startRay: simpleRay,
          cameraDirection,
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
    const modifiers = this._keyState;
    const handle = this.dragSession.handle;
    let delta;
    switch (handle.type) {
      case 'translate-axis': {
        delta = updateAxisTranslation(this.dragSession.operation, simpleRay);
        const snapped = this.snapper.snapTranslation(delta.distance, modifiers);
        delta.vector = scaleVector(this.frame.axes[handle.axis], snapped);
        this._applyTranslation(delta.vector);
        this.hud.update({ mode: 'translate', axis: handle.axis, values: { [handle.axis]: snapped } });
        break;
      }
      case 'translate-plane': {
        delta = updatePlaneTranslation(this.dragSession.operation, simpleRay);
        this._applyTranslation(delta.vector);
        this.hud.update({ mode: 'translate', plane: handle.plane, values: delta.vector });
        break;
      }
      case 'rotate-axis': {
        delta = updateAxisRotation(this.dragSession.operation, simpleRay);
        const angle = this.snapper.snapRotation(delta.angle, modifiers);
        this._applyRotation(this.frame.axes[handle.axis], angle);
        this.hud.update({ mode: 'rotate', axis: handle.axis, values: angle });
        break;
      }
      case 'rotate-view': {
        delta = updateAxisRotation(this.dragSession.operation, simpleRay);
        const angle = this.snapper.snapRotation(delta.angle, modifiers);
        this._applyRotation(cartesianToVector(camera.direction), angle);
        this.hud.update({ mode: 'rotate', axis: 'view', values: angle });
        break;
      }
      case 'scale-axis': {
        delta = updateAxisScale(this.dragSession.operation, simpleRay);
        const factor = this.snapper.snapScale(delta.scale, modifiers);
        this._applyAxisScale(handle.axis, factor);
        this.hud.update({ mode: 'scale', axis: handle.axis, values: factor });
        break;
      }
      case 'scale-uniform': {
        delta = updateUniformScale(this.dragSession.operation, simpleRay);
        const factor = this.snapper.snapScale(delta.scale, modifiers);
        this._applyUniformScale(factor);
        this.hud.update({ mode: 'scale', axis: 'uniform', values: factor });
        break;
      }
      default:
        break;
    }
    this._updateFrame();
  }

  _applyTranslation(vector) {
    this.dragSession.startTransforms.forEach((entry) => {
      const translation = add(entry.transform.translation, vector);
      const matrix = composeTransform(translation, entry.transform.rotation, entry.transform.scale);
      setTargetMatrix(entry.target, matrix, this.Cesium);
    });
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
  }

  _applyAxisScale(axis, factor) {
    const axisVector = this.frame.axes[axis];
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
      this.state = 'idle';
      this.gizmo.setActive(null);
      this.hud.setVisible(false);
      this.dragSession = null;
    }
  }

  _cancelDrag() {
    this.state = 'idle';
    this.gizmo.setActive(null);
    this.hud.setVisible(false);
    this.dragSession = null;
  }

  destroy() {
    this.handler?.destroy();
    if (typeof document !== 'undefined') {
      document.removeEventListener('keydown', this._keyDownListener);
      document.removeEventListener('keyup', this._keyUpListener);
    }
    this.hud.destroy();
  }
}
