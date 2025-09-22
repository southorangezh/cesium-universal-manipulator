const FORMATTERS = {
  translate: (value) => `${value.toFixed(3)} m`,
  rotate: (value) => `${(value * 180 / Math.PI).toFixed(1)}°`,
  scale: (value) => `${value.toFixed(3)}×`
};

export class HudOverlay {
  constructor(container) {
    if (typeof document === 'undefined') {
      this.element = null;
      return;
    }
    const targetContainer = container ?? document.body;
    this.element = document.createElement('div');
    this.element.className = 'universal-manipulator-hud';
    this.element.style.position = 'absolute';
    this.element.style.top = '10px';
    this.element.style.right = '10px';
    this.element.style.padding = '8px 12px';
    this.element.style.background = 'rgba(0,0,0,0.6)';
    this.element.style.color = '#fff';
    this.element.style.font = '12px/1.4 sans-serif';
    this.element.style.pointerEvents = 'none';
    this.element.style.borderRadius = '4px';
    this.element.style.display = 'none';
    targetContainer.appendChild(this.element);
  }

  update(info) {
    if (!this.element) {
      return;
    }
    if (!info) {
      this.element.style.display = 'none';
      return;
    }
    const lines = [];
    if (info.mode === 'translate' && info.delta) {
      lines.push(`ΔX ${FORMATTERS.translate(info.delta[0])}`);
      lines.push(`ΔY ${FORMATTERS.translate(info.delta[1])}`);
      lines.push(`ΔZ ${FORMATTERS.translate(info.delta[2])}`);
    } else if (info.mode === 'rotate') {
      lines.push(`Δθ ${FORMATTERS.rotate(info.angle ?? 0)}`);
    } else if (info.mode === 'scale') {
      lines.push(`ΔS ${FORMATTERS.scale(info.factor ?? 1)}`);
    }
    if (info.snap) {
      lines.push(`Snap ${info.snap}`);
    }
    this.element.innerHTML = lines.join('<br/>');
    this.element.style.display = lines.length ? 'block' : 'none';
  }

  destroy() {
    if (this.element && this.element.remove) {
      this.element.remove();
    }
  }
}

export default HudOverlay;
