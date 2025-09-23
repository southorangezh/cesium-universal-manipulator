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
    this.valueEl.style.whiteSpace = 'pre';
    this.root.appendChild(this.titleEl);
    this.root.appendChild(this.valueEl);
    this.container.appendChild(this.root);
  }

  setVisible(visible) {
    if (!this.enabled) return;
    this.root.style.display = visible ? 'block' : 'none';
  }

  update({ mode, axis, plane, values, units, input }) {
    if (!this.enabled) return;
    this.titleEl.textContent = `${mode.toUpperCase()} ${axis ?? plane ?? ''}`.trim();
    const lines = [];
    if (values !== undefined && values !== null) {
      const format = (value) => {
        let numeric = Number(value);
        if (!Number.isFinite(numeric)) {
          numeric = 0;
        }
        let unitLabel = units;
        if (units === 'rad') {
          numeric = (numeric * 180) / Math.PI;
          unitLabel = '°';
        }
        const suffix = unitLabel ? ` ${unitLabel}` : '';
        return `${numeric.toFixed(3)}${suffix}`;
      };
      if (typeof values === 'number') {
        lines.push(format(values));
      } else if (Array.isArray(values)) {
        lines.push(values.map((v) => format(v)).join(' , '));
      } else if (typeof values === 'object') {
        Object.entries(values).forEach(([key, value]) => {
          lines.push(`${key}: ${format(value)}`);
        });
      }
    }
    if (input) {
      lines.push(`Input: ${input}`);
    }
    this.valueEl.textContent = lines.join('\n');
  }

  destroy() {
    if (!this.enabled) return;
    this.root.remove();
  }
}
