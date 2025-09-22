# Cesium Universal Manipulator

A reusable translate / rotate / scale gizmo for [CesiumJS 1.133](https://cesium.com/learn/cesiumjs/ref-doc/). The library keeps the manipulator responsive in globe scenes, supports multiple coordinate frames and pivots, and exposes a high-level API for integrating with Cesium `Scene`, `Entity`, or custom objects.

## Features

- ✳️ Unified manipulator covering translate, rotate, and scale.
- 🎯 Robust picking in screen space without relying on `pickPosition`.
- 🧭 Orientation frames: global, local, view, ENU, normal, and gimbal.
- 📍 Pivots: origin, median, cursor, and individual multi-selection.
- 📐 Configurable snapping with Ctrl (step) and Shift (fine) support.
- 🧮 Numerically stable solvers operating in ENU frames with quaternion rotations.
- 🧩 Modular architecture (`FrameBuilder`, `TransformSolver`, `GizmoPrimitive`, `ManipulatorController`, `Snapper`, `PivotResolver`, `HudOverlay`).
- 🧪 Vitest coverage for solvers, frames, and pivots.
- 📘 Example application with interactive control panel and HUD overlay.

## Getting Started

### Installation

```bash
npm install cesium-universal-manipulator cesium
```

Ensure Cesium static assets are served alongside your application (see the [Cesium build guide](https://cesium.com/learn/cesiumjs-learn/cesiumjs-quickstart/)).

### Basic Usage

```ts
import { Viewer, Matrix4 } from 'cesium';
import { UniversalManipulator } from 'cesium-universal-manipulator';

const viewer = new Viewer('viewer');

// Wrap your Cesium target (Entity, Model, or custom matrix holder)
const target = {
  matrix: Matrix4.IDENTITY.clone(),
  setMatrix(next: Matrix4) {
    this.matrix = next;
  }
};

const manipulator = new UniversalManipulator({
  scene: viewer.scene,
  target,
  orientation: 'global',
  pivot: 'origin',
  snap: { translate: 0.5, rotate: Cesium.Math.toRadians(5), scale: 0.1 }
});

viewer.container.appendChild(manipulator.getHudElement());
```

Switch modes, orientation, and pivots at runtime:

```ts
manipulator.enable({ translate: true });
manipulator.setOrientation('local');
manipulator.setPivot('median');
manipulator.setSnap({ rotate: Cesium.Math.toRadians(1) });
```

Destroy the manipulator when it is no longer required:

```ts
manipulator.destroy();
```

### Multi-target support

Provide an array of targets when working with multiple objects. The manipulator resolves pivots (median, cursor, or individual) and applies transforms to each object while respecting its own local pivot.

```ts
manipulator.setTarget([targetA, targetB, targetC]);
manipulator.setPivot('individual');
```

## Example Application

Run the bundled demo with Vite to explore features such as multi-selection, snapping, and frame switching.

```bash
npm install
npm run dev
```

Open the logged local URL to see the viewer, control panel, and HUD overlay. Use the selection checkboxes to toggle which boxes participate in the transform.

## API Surface

### `UniversalManipulator`

| Method | Description |
| --- | --- |
| `setTarget(target | target[])` | Attach one or more transformation targets. |
| `setOrientation(orientation)` | Switch orientation frame (`global`, `local`, `view`, `enu`, `normal`, `gimbal`). |
| `setPivot(pivot)` | Choose pivot (`origin`, `median`, `cursor`, `individual`). |
| `enable({ translate?, rotate?, scale? })` | Activate one of the manipulation modes. |
| `setSnap(stepConfig)` | Configure snapping steps for translate, rotate, and scale. |
| `setSize(screenPixelRadius, minScale, maxScale)` | Control screen-space scaling for gizmo size. |
| `setShow(show)` | Toggle visibility. |
| `destroy()` | Clean up primitives, handlers, and DOM overlay. |

### Supporting Modules

- **`FrameBuilder`** — Resolves reference frames (global/local/view/ENU/normal/gimbal).
- **`TransformSolver`** — Converts cursor motion into axis/plane translations, rotations, and scaling with quaternion math.
- **`Snapper`** — Applies translate/rotate/scale snapping with modifier-aware fine control.
- **`PivotResolver`** — Handles multi-selection pivots and cursor-based pivots.
- **`GizmoPrimitive`** — Renders axis primitives with screen-space scaling and highlighting hooks.
- **`GizmoPicker`** — Implements screen-space picking against gizmo handles.
- **`ManipulatorController`** — Pointer event state machine (hover, drag, cancel).
- **`HudOverlay`** — DOM overlay for ΔX/ΔY/ΔZ, angles, and scale factors.

## Project Structure

```
src/
  core/              // math, frames, snapping, pivots, manipulator orchestration
  interaction/       // picker and controller
  render/            // Cesium primitives for gizmo visuals
  utils/             // helpers for Cesium math conversions
examples/            // Vite demo app with control panel
tests/               // Vitest unit tests (solvers, frames, pivots)
```

## Testing

```bash
npm install
npm run test
```

Vitest runs in Node and exercises math-heavy components (`TransformSolver`, `FrameBuilder`, `PivotResolver`).

## License

MIT
