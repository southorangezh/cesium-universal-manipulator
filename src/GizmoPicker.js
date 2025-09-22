export class GizmoPicker {
  constructor(scene, gizmo) {
    this.scene = scene;
    this.gizmo = gizmo;
  }

  pick(position) {
    if (!this.scene) return null;
    const picked = this.scene.pick(position);
    if (!picked) return null;
    const entity = picked.id ?? picked;
    const id = typeof entity === 'string' ? entity : entity.id;
    if (!id) return null;
    const handle = this.gizmo.handles.get(id);
    if (!handle) return null;
    return {
      id,
      mode: handle.mode,
      axis: handle.axis,
      plane: handle.plane,
      type: handle.type,
      entity,
    };
  }

  drillPick(position) {
    const picks = this.scene.drillPick(position, 5);
    for (const picked of picks) {
      const entity = picked.id ?? picked;
      const id = typeof entity === 'string' ? entity : entity.id;
      if (!id) continue;
      const handle = this.gizmo.handles.get(id);
      if (handle) {
        return {
          id,
          mode: handle.mode,
          axis: handle.axis,
          plane: handle.plane,
          type: handle.type,
          entity,
        };
      }
    }
    return null;
  }
}
