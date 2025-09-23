#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const math = await import(resolve(__dirname, '../src/math.js'));
const solver = await import(resolve(__dirname, '../src/TransformSolver.js'));
const frameModule = await import(resolve(__dirname, '../src/FrameBuilder.js'));
const pivotModule = await import(resolve(__dirname, '../src/PivotResolver.js'));
const parser = await import(resolve(__dirname, '../src/ValueParser.js'));
const controllerModule = await import(resolve(__dirname, '../src/ManipulatorController.js'));
const pickerModule = await import(resolve(__dirname, '../src/GizmoPicker.js'));
const performanceModule = await import(resolve(__dirname, '../src/PerformanceMonitor.js'));

const results = [];

function test(name, fn) {
  try {
    fn();
    results.push({ name, status: 'passed' });
  } catch (error) {
    results.push({ name, status: 'failed', error });
  }
}

test('vector normalization', () => {
  const v = math.normalize({ x: 3, y: 4, z: 0 });
  assert.ok(Math.abs(v.x - 0.6) < 1e-12);
  assert.ok(Math.abs(v.y - 0.8) < 1e-12);
  assert.equal(v.z, 0);
});

test('matrix TRS decomposition', () => {
  const translation = { x: 10, y: -4, z: 3 };
  const rotation = math.fromAxisAngle({ x: 0, y: 0, z: 1 }, Math.PI / 4);
  const scale = { x: 2, y: 3, z: 4 };
  const matrix = math.composeTransform(translation, rotation, scale);
  const decomposed = math.decomposeTransform(matrix);
  assert.ok(math.equalsEpsilon(decomposed.translation, translation, 1e-9));
  assert.ok(math.equalsQuaternion(decomposed.rotation, rotation, 1e-9));
  assert.ok(math.equalsEpsilon(decomposed.scale, scale, 1e-9));
});

test('axis drag translation delta', () => {
  const axis = math.normalize({ x: 1, y: 0, z: 0 });
  const pivot = { x: 0, y: 0, z: 0 };
  const startRay = { origin: { x: 0, y: 0, z: 10 }, direction: math.normalize({ x: 0, y: 0, z: -1 }) };
  const currentRay = { origin: { x: 1, y: 0, z: 10 }, direction: math.normalize({ x: 0, y: 0, z: -1 }) };
  const session = solver.beginAxisTranslation({ axis, pivot, startRay, cameraDirection: { x: 0, y: 0, z: -1 } });
  const delta = solver.updateAxisTranslation(session, currentRay);
  assert.ok(Math.abs(delta.distance - 1) < 1e-6);
  assert.ok(math.equalsEpsilon(delta.vector, { x: 1, y: 0, z: 0 }, 1e-6));
});

test('frame builder extracts matrices from entities', () => {
  let receivedTime = null;
  const translation = { x: 12, y: 34, z: 56 };
  const rotation = math.IDENTITY_QUATERNION;
  const scale = { x: 1, y: 1, z: 1 };
  const matrix = math.composeTransform(translation, rotation, scale);
  const Cesium = {
    JulianDate: { now: () => ({}) },
    Cartesian3: { fromDegrees: () => ({ x: 1, y: 0, z: 0 }) },
  };
  const builder = new frameModule.FrameBuilder({ Cesium });
  const entity = {
    computeModelMatrix(time) {
      receivedTime = time;
      return matrix;
    },
  };
  const frame = builder.buildFrame({ target: entity });
  assert.ok(receivedTime, 'computeModelMatrix should be invoked with a JulianDate');
  assert.ok(math.equalsEpsilon(frame.origin, translation, 1e-9));
});

test('frame builder normal orientation respects provided vector', () => {
  const builder = new frameModule.FrameBuilder({});
  const frame = builder.buildFrame({
    target: { matrix: math.composeTransform({ x: 0, y: 0, z: 0 }, math.IDENTITY_QUATERNION, { x: 1, y: 1, z: 1 }) },
    orientation: 'normal',
    normal: { x: 0, y: 1, z: 0 },
  });
  assert.ok(math.equalsEpsilon(frame.axes.z, math.normalize({ x: 0, y: 1, z: 0 }), 1e-12));
});

test('frame builder gimbal orientation constructs expected axes', () => {
  const builder = new frameModule.FrameBuilder({});
  const yaw = Math.PI / 4;
  const pitch = Math.PI / 6;
  const frame = builder.buildFrame({
    target: { matrix: math.composeTransform({ x: 0, y: 0, z: 0 }, math.IDENTITY_QUATERNION, { x: 1, y: 1, z: 1 }) },
    orientation: 'gimbal',
    gimbalYaw: yaw,
    gimbalPitch: pitch,
  });
  const expectedYaw = math.normalize({ x: Math.cos(yaw), y: 0, z: Math.sin(yaw) });
  assert.ok(math.equalsEpsilon(frame.axes.x, expectedYaw, 1e-9));
  const expectedPitch = math.normalize({ x: 0, y: Math.cos(pitch), z: Math.sin(pitch) });
  const alignment = Math.abs(math.dot(frame.axes.y, expectedPitch));
  assert.ok(alignment > 0.8);
});

test('pivot resolver handles Cesium-style entity positions', () => {
  const resolver = new pivotModule.PivotResolver();
  const Cesium = { JulianDate: { now: () => ({}) } };
  let receivedTime = null;
  const entity = {
    position: {
      getValue(time) {
        receivedTime = time;
        return { x: 10, y: 20, z: 30 };
      },
    },
  };
  const result = resolver.resolve(entity, { Cesium, time: { t: 1 } });
  assert.ok(receivedTime);
  assert.deepEqual(result.pivot, { x: 10, y: 20, z: 30 });
});

test('value parser converts units and angles correctly', () => {
  const distance = parser.parseDistanceInput('5cm');
  assert.ok(Math.abs(distance.value - 0.05) < 1e-6);
  const plane = parser.parsePlaneInput('1m,2');
  assert.deepEqual(plane.values.map((v) => Number(v.toFixed(6))), [1, 2]);
  const angle = parser.parseAngleInput('90');
  assert.ok(Math.abs(angle - Math.PI / 2) < 1e-6);
  const scale = parser.parseScaleInput('150%');
  assert.ok(Math.abs(scale - 1.5) < 1e-12);
});

test('manipulator controller undo/redo restores matrices', () => {
  const Cesium = {
    ScreenSpaceEventHandler: class {
      constructor() {}
      setInputAction() {}
      destroy() {}
    },
    ScreenSpaceEventType: { MOUSE_MOVE: 0, LEFT_DOWN: 1, LEFT_UP: 2, RIGHT_DOWN: 3 },
  };
  const viewer = {
    scene: {
      canvas: {},
      camera: {
        direction: { x: 0, y: 0, z: -1 },
        getPickRay() {
          return null;
        },
      },
    },
    clock: { currentTime: { tick: 0 } },
    container: {},
  };
  const controller = new controllerModule.ManipulatorController({
    Cesium,
    viewer,
    gizmo: { setMode() {}, setHover() {}, setActive() {}, update() {}, setShow() {}, destroy() {} },
    picker: { pick() { return null; }, drillPick() { return null; } },
    frameBuilder: { buildFrame: () => ({ origin: { x: 0, y: 0, z: 0 }, axes: { x: { x: 1, y: 0, z: 0 }, y: { x: 0, y: 1, z: 0 }, z: { x: 0, y: 0, z: 1 } } }) },
    snapper: { setConfig() {}, snapTranslation: (v) => v, snapRotation: (v) => v, snapScale: (v) => v },
    pivotResolver: { setMode() {}, resolve: () => ({ pivot: { x: 0, y: 0, z: 0 }, perTarget: new Map() }) },
    hud: { setVisible() {}, update() {}, destroy() {} },
  });
  const target = {
    matrix: math.composeTransform({ x: 0, y: 0, z: 0 }, math.IDENTITY_QUATERNION, { x: 1, y: 1, z: 1 }),
  };
  controller.targets = [target];
  const startTransform = math.decomposeTransform(target.matrix);
  controller.dragSession = {
    startTransforms: [
      { target, matrix: target.matrix.slice(), transform: startTransform },
    ],
  };
  const movedMatrix = math.composeTransform({ x: 5, y: 0, z: 0 }, math.IDENTITY_QUATERNION, { x: 1, y: 1, z: 1 });
  target.matrix = movedMatrix.slice();
  controller._recordHistory();
  assert.equal(controller._history.undo.length, 1);
  controller.undo();
  assert.ok(math.equalsEpsilon(math.decomposeTransform(target.matrix).translation, { x: 0, y: 0, z: 0 }, 1e-9));
  controller.redo();
  assert.ok(math.equalsEpsilon(math.decomposeTransform(target.matrix).translation, { x: 5, y: 0, z: 0 }, 1e-9));
});

test('camera controls lock and restore during drag sessions', () => {
  const Cesium = {
    ScreenSpaceEventHandler: class {
      constructor() {}
      setInputAction() {}
      destroy() {}
    },
    ScreenSpaceEventType: { MOUSE_MOVE: 0, LEFT_DOWN: 1, LEFT_UP: 2, RIGHT_DOWN: 3 },
  };
  const controllerState = {
    enableRotate: true,
    enableTranslate: true,
    enableZoom: true,
    enableTilt: true,
    enableLook: true,
  };
  const viewer = {
    scene: {
      canvas: {},
      requestRender() {},
      camera: {
        direction: { x: 0, y: 0, z: -1 },
        getPickRay() {
          return null;
        },
      },
      screenSpaceCameraController: controllerState,
    },
    clock: { currentTime: { tick: 0 } },
    container: {},
  };
  const controller = new controllerModule.ManipulatorController({
    Cesium,
    viewer,
    gizmo: { setMode() {}, setHover() {}, setActive() {}, update() {}, setShow() {}, destroy() {} },
    picker: { pick() { return null; }, drillPick() { return null; } },
    frameBuilder: { buildFrame: () => ({ origin: { x: 0, y: 0, z: 0 }, axes: { x: { x: 1, y: 0, z: 0 }, y: { x: 0, y: 1, z: 0 }, z: { x: 0, y: 0, z: 1 } } }), ellipsoid: {} },
    snapper: { setConfig() {}, snapTranslation: (v) => v, snapRotation: (v) => v, snapScale: (v) => v },
    pivotResolver: { setMode() {}, resolve: () => ({ pivot: { x: 0, y: 0, z: 0 }, perTarget: new Map() }) },
    hud: { setVisible() {}, update() {}, destroy() {} },
  });

  controller._lockCamera();
  assert.equal(controllerState.enableRotate, false);
  assert.equal(controllerState.enableTranslate, false);
  assert.equal(controllerState.enableZoom, false);
  assert.equal(controllerState.enableTilt, false);
  assert.equal(controllerState.enableLook, false);

  controller._unlockCamera();
  assert.equal(controllerState.enableRotate, true);
  assert.equal(controllerState.enableTranslate, true);
  assert.equal(controllerState.enableZoom, true);
  assert.equal(controllerState.enableTilt, true);
  assert.equal(controllerState.enableLook, true);

  controller.destroy();
});

test('createEnuSpace maintains stability at high latitude', () => {
  const pivot = { x: 1113194.9, y: 0, z: 6356752.3 };
  const Cesium = {
    Transforms: {
      eastNorthUpToFixedFrame() {
        return [
          0, 0, 1, 0,
          1, 0, 0, 0,
          0, -1, 0, 0,
          pivot.x, pivot.y, pivot.z, 1,
        ];
      },
    },
  };
  const space = controllerModule.__test.createEnuSpace(Cesium, pivot, {});
  const vector = { x: 10, y: -5, z: 2 };
  const enu = space.toDirection(vector);
  const restored = space.fromDirection(enu);
  assert.ok(math.equalsEpsilon(restored, vector, 1e-9));
  const point = { x: 3, y: -4, z: 5 };
  const worldPoint = space.fromPoint(point);
  const back = space.toPoint(worldPoint);
  assert.ok(math.equalsEpsilon(back, point, 1e-9));
});

test('gizmo picker prioritizes axis handles from drillPick', () => {
  const axisEntity = {
    id: 'axis',
    polyline: { positions: [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }] },
  };
  const planeEntity = {
    id: 'plane',
    polygon: {
      hierarchy: {
        positions: [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
          { x: 1, y: 1, z: 0 },
          { x: 0, y: 0, z: 0 },
        ],
      },
    },
  };
  const scene = {
    drillPick() {
      return [{ id: planeEntity }, { id: axisEntity }];
    },
    cartesianToCanvasCoordinates() {
      return { x: 42, y: 24 };
    },
  };
  const gizmo = {
    Cesium: null,
    handles: new Map([
      ['plane', { type: 'translate-plane', mode: 'translate', plane: 'xy', entity: planeEntity }],
      ['axis', { type: 'translate-axis', mode: 'translate', axis: 'x', entity: axisEntity }],
    ]),
  };
  const picker = new pickerModule.GizmoPicker(scene, gizmo);
  const result = picker.drillPick({ x: 0, y: 0 });
  assert.equal(result.id, 'axis');
  assert.ok(result.priority > 0);
  assert.deepEqual(result.screenPosition, { x: 42, y: 24 });
});

test('axis translation handles near-parallel camera directions', () => {
  const axis = { x: 0, y: 0, z: 1 };
  const pivot = { x: 0, y: 0, z: 0 };
  const startRay = { origin: { x: 0, y: 0, z: 10 }, direction: { x: 0, y: 0, z: -1 } };
  const cameraDirection = { x: 0, y: 0, z: -1 };
  const session = solver.beginAxisTranslation({ axis, pivot, startRay, cameraDirection });
  const normalMagnitude = math.magnitude(session.planeNormal);
  assert.ok(Math.abs(normalMagnitude - 1) < 1e-6);
  const update = solver.updateAxisTranslation(session, {
    origin: { x: 0, y: 0.5, z: 10 },
    direction: { x: 0, y: 0, z: -1 },
  });
  assert.ok(Number.isFinite(update.distance));
});

test('controller requests render when applying transforms', () => {
  class ConstantProperty {
    constructor(value) {
      this._value = value;
    }
    getValue() {
      return this._value;
    }
    setValue(value) {
      this._value = value;
    }
  }
  const Cesium = {
    ScreenSpaceEventHandler: class {
      constructor() {}
      setInputAction() {}
      destroy() {}
    },
    ScreenSpaceEventType: { MOUSE_MOVE: 0, LEFT_DOWN: 1, LEFT_UP: 2, RIGHT_DOWN: 3 },
    ConstantProperty,
    ConstantPositionProperty: ConstantProperty,
    Cartesian3: class {
      constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
      }
    },
    Quaternion: class {
      constructor(x, y, z, w) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.w = w;
      }
    },
    JulianDate: { now: () => ({}) },
  };
  let requested = 0;
  const viewer = {
    scene: {
      canvas: {},
      requestRender() {
        requested++;
      },
      camera: {
        direction: { x: 0, y: 0, z: -1 },
        getPickRay() {
          return { origin: { x: 0, y: 0, z: 10 }, direction: { x: 0, y: 0, z: -1 } };
        },
      },
      screenSpaceCameraController: {
        enableRotate: true,
        enableTranslate: true,
        enableZoom: true,
        enableTilt: true,
        enableLook: true,
      },
    },
    clock: { currentTime: { tick: 0 } },
    container: {},
  };
  const controller = new controllerModule.ManipulatorController({
    Cesium,
    viewer,
    gizmo: { setMode() {}, setHover() {}, setActive() {}, update() {}, setShow() {}, destroy() {} },
    picker: { pick() { return null; }, drillPick() { return null; } },
    frameBuilder: { buildFrame: () => ({ origin: { x: 0, y: 0, z: 0 }, axes: { x: { x: 1, y: 0, z: 0 }, y: { x: 0, y: 1, z: 0 }, z: { x: 0, y: 0, z: 1 } } }) },
    snapper: { setConfig() {}, snapTranslation: (v) => v, snapRotation: (v) => v, snapScale: (v) => v },
    pivotResolver: { setMode() {}, resolve: () => ({ pivot: { x: 0, y: 0, z: 0 }, perTarget: new Map() }) },
    hud: { setVisible() {}, update() {}, destroy() {} },
  });

  const target = { matrix: math.composeTransform({ x: 0, y: 0, z: 0 }, math.IDENTITY_QUATERNION, { x: 1, y: 1, z: 1 }) };
  const transform = math.decomposeTransform(target.matrix);
  controller.dragSession = {
    startTransforms: [{ target, transform, matrix: target.matrix.slice() }],
  };
  controller.pivotData = { pivot: { x: 0, y: 0, z: 0 }, perTarget: new Map() };
  controller.frame = { axes: { x: { x: 1, y: 0, z: 0 }, y: { x: 0, y: 1, z: 0 }, z: { x: 0, y: 0, z: 1 } } };

  controller._applyUniformScale(1.5);
  assert.ok(requested > 0);
  controller.destroy();
});

test('negative scale toggles model back-face culling and restores', () => {
  class ConstantProperty {
    constructor(value) {
      this._value = value;
    }
    getValue() {
      return this._value;
    }
    setValue(value) {
      this._value = value;
    }
  }
  const Cesium = {
    ScreenSpaceEventHandler: class {
      constructor() {}
      setInputAction() {}
      destroy() {}
    },
    ScreenSpaceEventType: { MOUSE_MOVE: 0, LEFT_DOWN: 1, LEFT_UP: 2, RIGHT_DOWN: 3 },
    ConstantProperty,
    ConstantPositionProperty: ConstantProperty,
    Cartesian3: class {
      constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
      }
    },
    Quaternion: class {
      constructor(x, y, z, w) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.w = w;
      }
    },
    JulianDate: { now: () => ({}) },
  };
  const viewer = {
    scene: {
      canvas: {},
      requestRender() {},
      camera: {
        direction: { x: 0, y: 0, z: -1 },
        getPickRay() {
          return { origin: { x: 0, y: 0, z: 10 }, direction: { x: 0, y: 0, z: -1 } };
        },
      },
      screenSpaceCameraController: {
        enableRotate: true,
        enableTranslate: true,
        enableZoom: true,
        enableTilt: true,
        enableLook: true,
      },
    },
    clock: { currentTime: { tick: 0 } },
    container: {},
  };
  const controller = new controllerModule.ManipulatorController({
    Cesium,
    viewer,
    gizmo: { setMode() {}, setHover() {}, setActive() {}, update() {}, setShow() {}, destroy() {} },
    picker: { pick() { return null; }, drillPick() { return null; } },
    frameBuilder: { buildFrame: () => ({ origin: { x: 0, y: 0, z: 0 }, axes: { x: { x: 1, y: 0, z: 0 }, y: { x: 0, y: 1, z: 0 }, z: { x: 0, y: 0, z: 1 } } }) },
    snapper: { setConfig() {}, snapTranslation: (v) => v, snapRotation: (v) => v, snapScale: (v) => v },
    pivotResolver: { setMode() {}, resolve: () => ({ pivot: { x: 0, y: 0, z: 0 }, perTarget: new Map() }) },
    hud: { setVisible() {}, update() {}, destroy() {} },
  });

  const baseMatrix = math.composeTransform({ x: 0, y: 0, z: 0 }, math.IDENTITY_QUATERNION, { x: 1, y: 1, z: 1 });
  const entity = {
    computeModelMatrix() {
      return baseMatrix;
    },
    model: {
      scale: new ConstantProperty(1),
      backFaceCulling: true,
    },
  };
  const target = { entity };
  const transform = math.decomposeTransform(baseMatrix);
  controller.dragSession = {
    startTransforms: [{ target, transform, matrix: baseMatrix.slice() }],
  };
  controller.pivotData = { pivot: { x: 0, y: 0, z: 0 }, perTarget: new Map() };
  controller.frame = { axes: { x: { x: 1, y: 0, z: 0 }, y: { x: 0, y: 1, z: 0 }, z: { x: 0, y: 0, z: 1 } } };

  controller._applyAxisScale('x', -1, { x: 1, y: 0, z: 0 });
  const applied = entity.model.backFaceCulling;
  const appliedValue = typeof applied?.getValue === 'function' ? applied.getValue() : applied;
  assert.equal(appliedValue, false);

  controller._restoreStartTransforms();
  const restored = entity.model.backFaceCulling;
  const restoredValue = typeof restored?.getValue === 'function' ? restored.getValue() : restored;
  assert.equal(restoredValue, true);
  controller.destroy();
});

test('performance monitor collects frame and memory stats', () => {
  const frameTimes = [0, 16, 32, 48, 64];
  let frameIndex = 0;
  const now = () => frameTimes[frameIndex++];
  const memoryValues = [10_000_000, 10_500_000, 11_000_000, 11_500_000, 12_000_000];
  let memoryIndex = 0;
  const memory = () => memoryValues[memoryIndex < memoryValues.length ? memoryIndex++ : memoryValues.length - 1];
  const listeners = new Set();
  const event = {
    addEventListener(fn) {
      listeners.add(fn);
    },
    removeEventListener(fn) {
      listeners.delete(fn);
    },
  };
  const monitor = new performanceModule.PerformanceMonitor({ scene: { postRender: event }, now, memory });
  monitor.start();
  listeners.forEach((fn) => fn());
  listeners.forEach((fn) => fn());
  listeners.forEach((fn) => fn());
  listeners.forEach((fn) => fn());
  listeners.forEach((fn) => fn());
  monitor.stop();
  const metrics = monitor.getMetrics();
  assert.ok(metrics.frameSamples >= 4);
  assert.ok(metrics.fps > 60);
  assert.ok(metrics.averageFrameTime > 0);
  assert.ok(metrics.memorySamples >= 5);
  assert.ok(Math.abs(metrics.memoryDelta - (memoryValues[4] - memoryValues[0])) < 1e-6);
});

let failed = 0;
for (const result of results) {
  if (result.status === 'failed') {
    failed++;
    console.error(`\u274c ${result.name}`);
    console.error(result.error);
  } else {
    console.log(`\u2705 ${result.name}`);
  }
}

if (failed) {
  console.error(`\n${failed} test(s) failed.`);
  process.exit(1);
}

console.log(`\nAll ${results.length} tests passed.`);
