export class HudOverlay {
  constructor({ container = null } = {}) {
    if (typeof document === 'undefined') {
      this.enabled = false;
      return;
    }
    this.enabled = true;
    this.container = container ?? document.body;
    this.root = document.createElement('div');
    this.root.className = 'universal-manipulator-hud';
    Object.assign(this.root.style, {
      position: 'absolute',
      top: '12px',
      right: '12px',
      padding: '8px 12px',
      borderRadius: '6px',
      background: 'rgba(0,0,0,0.6)',
      color: '#fff',
      fontFamily: 'sans-serif',
      fontSize: '12px',
      pointerEvents: 'none',
      minWidth: '160px',
      display: 'none',
      zIndex: 1000,
    });
    this.titleEl = document.createElement('div');
    this.valueEl = document.createElement('div');
    this.root.appendChild(this.titleEl);
    this.root.appendChild(this.valueEl);
    this.container.appendChild(this.root);
  }

  setVisible(visible) {
    if (!this.enabled) return;
    this.root.style.display = visible ? 'block' : 'none';
  }

  update({ mode, axis, plane, values }) {
    if (!this.enabled) return;
    this.titleEl.textContent = `${mode.toUpperCase()} ${axis ?? plane ?? ''}`.trim();
    if (!values) {
      this.valueEl.textContent = '';
      return;
    }
    if (typeof values === 'number') {
      this.valueEl.textContent = values.toFixed(3);
      return;
    }
    if (Array.isArray(values)) {
      this.valueEl.textContent = values.map((v) => v.toFixed(3)).join(' , ');
      return;
    }
    const parts = Object.entries(values).map(([key, value]) => `${key}: ${Number(value).toFixed(3)}`);
    this.valueEl.textContent = parts.join('  ');
  }

  destroy() {
    if (!this.enabled) return;
    this.root.remove();
  }
}
