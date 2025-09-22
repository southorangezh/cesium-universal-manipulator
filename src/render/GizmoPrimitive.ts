import { Cartesian3, Color, PolylineCollection, PrimitiveCollection, Scene, Matrix3 } from 'cesium';
import type { FrameState } from '../core/types';

const AXIS_LENGTH = 1.0;

export interface GizmoPrimitiveOptions {
  scene: Scene;
}

interface AxisVisual {
  axis: 'x' | 'y' | 'z';
  polyline: ReturnType<PolylineCollection['add']>;
  color: Color;
}

export class GizmoPrimitive {
  private readonly scene: Scene;
  private readonly collection: PrimitiveCollection;
  private readonly polylines: PolylineCollection;
  private readonly axes: AxisVisual[];
  private frame: FrameState | undefined;
  private show = true;

  constructor(options: GizmoPrimitiveOptions) {
    this.scene = options.scene;
    this.collection = new PrimitiveCollection();
    this.polylines = new PolylineCollection();
    this.axes = [];
    this.collection.add(this.polylines);
    this.scene.primitives.add(this.collection);
    this.createAxes();
  }

  public setShow(show: boolean): void {
    this.show = show;
    this.collection.show = show;
  }

  public update(frame: FrameState, scale: number): void {
    this.frame = frame;
    const origin = frame.origin;
    this.axes.forEach((axisInfo) => {
      const axisVector = Matrix3.getColumn(frame.axes, axisIndex(axisInfo.axis), new Cartesian3());
      const endPoint = Cartesian3.add(
        origin,
        Cartesian3.multiplyByScalar(Cartesian3.normalize(axisVector, axisVector), AXIS_LENGTH * scale, new Cartesian3()),
        new Cartesian3()
      );
      axisInfo.polyline.positions = [Cartesian3.clone(origin, new Cartesian3()), endPoint];
      axisInfo.polyline.width = 4;
      axisInfo.polyline.material = axisInfo.color;
    });
  }

  public destroy(): void {
    this.scene.primitives.remove(this.collection);
  }

  private createAxes(): void {
    const definitions: Array<{ axis: 'x' | 'y' | 'z'; color: Color }> = [
      { axis: 'x', color: Color.RED },
      { axis: 'y', color: Color.LIME },
      { axis: 'z', color: Color.BLUE }
    ];
    definitions.forEach((def) => {
      const polyline = this.polylines.add({
        positions: [Cartesian3.ZERO, Cartesian3.UNIT_X],
        width: 4,
        material: def.color
      });
      this.axes.push({ axis: def.axis, polyline, color: def.color });
    });
  }
}

function axisIndex(axis: 'x' | 'y' | 'z'): number {
  switch (axis) {
    case 'x':
      return 0;
    case 'y':
      return 1;
    case 'z':
    default:
      return 2;
  }
}
