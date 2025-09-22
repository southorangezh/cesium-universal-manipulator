export class GizmoPicker {
  constructor(scene, primitive) {
    this.scene = scene;
    this.primitive = primitive;
    this.hoverId = null;
  }

  pick(screenPosition) {
    if (!this.scene || !this.scene.pick || !this.primitive) {
      return null;
    }
    const result = this.scene.pick(screenPosition);
    if (!result || !result.id) {
      return null;
    }
    const handle = this.primitive.getHandle(result.id);
    if (!handle) {
      return null;
    }
    return {
      id: handle.id,
      mode: handle.mode,
      type: handle.type,
      axis: handle.axis,
      axes: handle.axes
    };
  }
}

export default GizmoPicker;
