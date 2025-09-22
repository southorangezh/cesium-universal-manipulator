# Cesium Universal Manipulator

Reusable translate/rotate/scale gizmo designed for CesiumJS 1.133 scenes. The library exposes a `UniversalManipulator` class that mounts a full featured manipulator around Cesium entities, models or matrix aware objects and mirrors the ergonomics of DCC tools.

## Features

- Translate, rotate and scale with single-axis, dual-axis (plane) and uniform handles
- Global, local, view aligned, ENU, normal and gimbal reference frames
- Origin, median, cursor and individual pivot strategies with multi-target support
- Configurable snapping with modifier keys, pixel perfect HUD feedback and optional number entry hooks
- Robust transform solver that works purely from camera rays (no `pickPosition`) and keeps rotation/scale orthogonal
- Lightweight primitives that stay screen-space consistent and render on top of terrain
- Example scene plus unit tests that validate numerical stability

## Installation

The repository is dependency free. Clone it and reference the source module directly from your Cesium application:

```bash
npm install --save-dev cesium-universal-manipulator
```

or copy the `src` directory into your project.

## Quick start

```html
<link href="https://cesium.com/downloads/cesiumjs/releases/1.133/Build/Cesium/Widgets/widgets.css" rel="stylesheet" />
<script src="https://cesium.com/downloads/cesiumjs/releases/1.133/Build/Cesium/Cesium.js"></script>
<script type="module">
  import Manipulator from 'cesium-universal-manipulator/src/index.js';

  const viewer = new Cesium.Viewer('cesiumContainer', {
    timeline: false,
    animation: false
  });

  const entity = viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(-75.169, 39.952, 100),
    box: {
      dimensions: new Cesium.Cartesian3(20, 20, 20),
      material: Cesium.Color.CORNFLOWERBLUE
    }
  });

  const manipulator = new Manipulator(viewer, {
    target: entity,
    orientation: 'global',
    pivot: 'origin',
    size: { screenPixelRadius: 80 }
  });
</script>
```

See [`examples/index.html`](examples/index.html) for a runnable demo with configuration UI.

## API

### `new UniversalManipulator(viewer, options)`

- `viewer`: a `Cesium.Viewer` or `{ scene, canvas }` like object
- `options.target`: single target or array of targets. Targets may be `Cesium.Entity`, `Cesium.Model` or `{ matrix, setModelMatrix }` wrappers
- `options.orientation`: `'global' | 'local' | 'view' | 'enu' | 'normal' | 'gimbal'`
- `options.pivot`: `'origin' | 'median' | 'cursor' | 'individual'`
- `options.show`: initial visibility (default `true`)
- `options.size`: `{ screenPixelRadius, minScale, maxScale }`
- `options.snap`: `{ translationStep, rotationStep, scaleStep }`
- `options.colors`: override handle colors

### Instance methods

- `setTarget(target)` – change selection (single item or array)
- `setOrientation(orientation)`
- `setPivot(pivot)`
- `enable(mode, enabled)` – toggle `translate`, `rotate`, `scale`
- `setSnap(stepConfig)` – update snapping steps in meters / radians / scale factor
- `setSize(config)` – adjust on-screen size and scale bounds
- `destroy()` – remove primitives, events and HUD
- `show` (getter/setter) – toggle visibility

## Targets

A compatible target exposes either the Cesium Entity API (`position`, `orientation`, `scale`) or a `matrix` with optional `getModelMatrix` / `setModelMatrix` functions. The manipulator keeps TRS components orthogonal and preserves parent transforms when applying updates.

## Development

Run the unit tests and lint checks:

```bash
npm test
npm run lint
```

The project deliberately avoids npm dependencies so the repository can run in restricted environments. For production usage you can bundle the `src` directory with your existing tooling.

## Example coverage

The sample scene highlights:

- Switching between global/local/view/ENU frames
- Editing pivot (origin, median, cursor, individual)
- Translating, rotating and scaling a Cesium entity with snapping feedback
- HUD displaying live deltas and snap status

## Testing matrix

Unit tests (`node:test`) validate:

- Axis and plane translation deltas within `1e-6`
- Signed rotation angles and uniform scaling ratios
- Snapper behaviour across translation, rotation and scale
- Pivot resolver aggregation results

Add additional scene based tests (integration) when wiring into your application.

## License

MIT
