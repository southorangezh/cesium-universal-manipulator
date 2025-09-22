import { Cartesian2, Cartesian3, Scene, SceneTransforms, Matrix3 } from 'cesium';
import type { Axis, FrameState, Mode } from '../core/types';

export interface GizmoHit {
  mode: Mode;
  axis: Axis;
  distance: number;
}

const MAX_PICK_DISTANCE = 30;

export class GizmoPicker {
  constructor(private readonly scene: Scene) {}

  public pick(windowPosition: Cartesian2, frame: FrameState, mode: Mode): GizmoHit | undefined {
    const camera = this.scene.camera;
    const axisCandidates: Axis[] = ['x', 'y', 'z'];
    let best: GizmoHit | undefined;
    axisCandidates.forEach((axis) => {
      const axisPoint = this.computeAxisEndpoint(frame, axis);
      const screenOrigin = SceneTransforms.worldToWindowCoordinates(this.scene, frame.origin);
      const screenEnd = SceneTransforms.worldToWindowCoordinates(this.scene, axisPoint);
      if (!screenOrigin || !screenEnd) {
        return;
      }
      const distance = distancePointToSegment(windowPosition, screenOrigin, screenEnd);
      if (distance < MAX_PICK_DISTANCE && (!best || distance < best.distance)) {
        best = { mode, axis, distance };
      }
    });
    return best;
  }

  private computeAxisEndpoint(frame: FrameState, axis: Axis): Cartesian3 {
    const axisIndex = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
    const axisVector = Cartesian3.normalize(
      Matrix3.getColumn(frame.axes, axisIndex, new Cartesian3()),
      new Cartesian3()
    );
    return Cartesian3.add(
      frame.origin,
      Cartesian3.multiplyByScalar(axisVector, 5.0, new Cartesian3()),
      new Cartesian3()
    );
  }
}

function distancePointToSegment(point: Cartesian2, start: Cartesian2, end: Cartesian2): number {
  const segment = Cartesian2.subtract(end, start, new Cartesian2());
  const lengthSquared = Cartesian2.dot(segment, segment);
  if (lengthSquared === 0) {
    return Cartesian2.distance(point, start);
  }
  const t = Math.max(0, Math.min(1, Cartesian2.dot(Cartesian2.subtract(point, start, new Cartesian2()), segment) / lengthSquared));
  const projection = Cartesian2.add(start, Cartesian2.multiplyByScalar(segment, t, new Cartesian2()), new Cartesian2());
  return Cartesian2.distance(point, projection);
}
