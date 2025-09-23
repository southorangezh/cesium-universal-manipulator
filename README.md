# Cesium Universal Manipulator

A reusable translate / rotate / scale gizmo for CesiumJS 1.133 scenes. The manipulator renders high-visibility handles, supports axis/plane constraints, configurable snapping, multi-selection pivots, and HUD feedback. The code is framework-agnostic and works directly with the CesiumJS Viewer.

## Quick start

```bash
# clone the repository
npm install
npm run build
```

Open `examples/index.html` from a static server (for example `npx serve`) to play with the demo scene. The example loads Cesium from the public CDN and imports the library straight from `src/` for easy iteration.

## Usage

```js
import { UniversalManipulator } from 'cesium-universal-manipulator';

const manipulator = new UniversalManipulator({
  Cesium,
  viewer,
  target: entityOrArray,
  mode: 'translate',
  orientation: 'global',
  pivot: 'origin',
  snap: {
    translate: 1.0,           // meters
    rotate: Cesium.Math.toRadians(5),
    scale: 0.1,
  },
  size: {
    screenRadius: 110,
    minScale: 0.2,
    maxScale: 2.5,
  },
});
```

Call `manipulator.destroy()` to clean up when finished.

## API

### `new UniversalManipulator(options)`

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `Cesium` | `typeof Cesium` | required | Cesium namespace (e.g. the global `Cesium`). |
| `viewer` | `Cesium.Viewer` | required | Viewer hosting the gizmo. |
| `target` | `Transformable | Transformable[]` | `null` | Initial selection target(s). |
| `mode` | `'translate' | 'rotate' | 'scale'` | `'translate'` | Active manipulation mode. |
| `orientation` | `'global' | 'local' | 'view' | 'enu' | 'normal' | 'gimbal'` | `'global'` | Handle frame orientation. |
| `pivot` | `'origin' | 'median' | 'cursor' | 'individual'` | `'origin'` | Pivot policy for transforms. |
| `snap` | `{ translate?: number, rotate?: number, scale?: number }` | `{}` | Snapping step configuration. |
| `size` | `{ screenRadius?: number, minScale?: number, maxScale?: number }` | `{}` | Screen-size behaviour. |
| `hudContainer` | `HTMLElement` | `viewer.container` | DOM container for the delta HUD. |

Targets can be:

- Plain objects with a `matrix` or `modelMatrix` property (4×4 column-major array).
- Objects exposing `getWorldMatrix()` / `setMatrix(matrix)`.
- Wrappers around `Cesium.Entity` instances (the built-in adapter updates `position`, `orientation`, and `model.scale`).

### Instance methods

- `setTarget(target | target[])` — Update the current selection (single object or array).
- `setMode(mode)` — Switch between translate/rotate/scale. Respects `enable()` toggles.
- `setOrientation(orientation)` — Change orientation frame (global, local, view, ENU, normal, gimbal).
- `setPivot(pivot)` — Choose pivot behaviour (origin, median, cursor, individual).
- `enable({ translate?, rotate?, scale? })` — Enable/disable specific modes. Disabled modes throw if selected; the manipulator falls back to the first enabled mode.
- `setSnap(stepConfig)` — Update snapping step sizes (translate in meters, rotate in radians, scale factor).
- `setSize(screenRadius, minScale, maxScale)` — Control screen-space gizmo size behaviour.
- `destroy()` — Dispose the gizmo, controller, and HUD.
- `undo()` / `redo()` — Step through the command history recorded after each drag submission.

#### Orientation helpers

`setOrientation` accepts either a string or a configuration object:

```js
manipulator.setOrientation({
  type: 'normal',
  normal: { x: 0, y: 0, z: 1 }, // custom frame normal
});

manipulator.setOrientation({
  type: 'gimbal',
  gimbal: {
    yaw: Cesium.Math.toRadians(45),
    pitch: Cesium.Math.toRadians(20),
  },
});
```

Both helpers update the gizmo immediately and remain active while switching between targets and modes.

### Interaction features

- **Snapping & fine control** — Hold <kbd>Ctrl</kbd> to quantise translation/rotation/scale to the configured step. Hold <kbd>Shift</kbd> to reduce sensitivity for micro adjustments.
- **Numeric entry** — While dragging, type values like `2m`, `15cm`, `90`, or `0.5` and press <kbd>Enter</kbd> to commit the parsed distance/angle/scale. Units support metres/centimetres/kilometres, percentages, and degrees (`°`).
- **Cancellation** — Press <kbd>Esc</kbd> or right-click mid-drag to abandon the active operation and revert to the pre-drag transform.
- **Undo/redo** — Every drag submission records before/after matrices; call `undo()` / `redo()` (or use the demo buttons) to traverse the history.

### Properties

- `show` (getter/setter) — Toggle overall gizmo visibility without removing event handlers.

## Architecture overview

The library is modular and each component can be used independently:

- `GizmoPrimitive` — Renders handles as Cesium entities, manages colours, highlights, and size.
- `GizmoPicker` — Wraps `scene.pick`/`drillPick` to resolve handle metadata.
- `FrameBuilder` — Produces orientation frames (global, local, view, ENU, normal, gimbal).
- `PivotResolver` — Computes pivot positions for single and multi-selection modes.
- `TransformSolver` — Pure math helpers that map drag rays to translation/rotation/scale deltas.
- `Snapper` — Applies translate/rotate/scale snapping with modifier awareness.
- `ManipulatorController` — Event/state machine hooking into Cesium pointer events, applying transforms, updating the gizmo, and driving the HUD.
- `HudOverlay` — Lightweight DOM HUD for live delta readouts (auto-disabled in non-DOM environments).

## Testing

A lightweight test harness covers the math and transform solvers:

```bash
npm test
```

## License

MIT
