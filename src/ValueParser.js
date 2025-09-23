const DISTANCE_UNITS = [
  { suffix: 'km', factor: 1000 },
  { suffix: 'cm', factor: 0.01 },
  { suffix: 'mm', factor: 0.001 },
  { suffix: 'm', factor: 1 },
];

function normalizeToken(token) {
  return token.replace(/\s+/g, '').toLowerCase();
}

export function parseDistanceInput(raw) {
  if (!raw) return null;
  let token = normalizeToken(raw);
  let factor = 1;
  for (const unit of DISTANCE_UNITS) {
    if (token.endsWith(unit.suffix)) {
      token = token.slice(0, -unit.suffix.length);
      factor = unit.factor;
      break;
    }
  }
  if (!token.length) {
    return null;
  }
  const value = Number(token);
  if (Number.isNaN(value)) {
    return null;
  }
  return { value: value * factor, unit: 'm' };
}

export function parsePlaneInput(raw) {
  if (!raw) return null;
  const matches = raw
    .replace(/,/g, ' ')
    .trim()
    .match(/[+-]?[0-9]*\.?[0-9]+(?:e[+-]?[0-9]+)?\s*(?:km|cm|mm|m)?/gi);
  if (!matches || matches.length !== 2) {
    return null;
  }
  const parsed = matches.map((token) => parseDistanceInput(token));
  if (parsed.some((entry) => !entry)) {
    return null;
  }
  return { values: parsed.map((entry) => entry.value), unit: 'm' };
}

export function parseAngleInput(raw) {
  if (!raw) return null;
  let token = raw.trim().toLowerCase();
  let mode = 'deg';
  if (token.endsWith('rad')) {
    token = token.slice(0, -3);
    mode = 'rad';
  } else if (token.endsWith('deg')) {
    token = token.slice(0, -3);
    mode = 'deg';
  } else if (token.endsWith('°')) {
    token = token.slice(0, -1);
    mode = 'deg';
  }
  if (!token.length) {
    return null;
  }
  const value = Number(token);
  if (Number.isNaN(value)) {
    return null;
  }
  return mode === 'deg' ? (value * Math.PI) / 180 : value;
}

export function parseScaleInput(raw) {
  if (!raw) return null;
  let token = raw.trim();
  let multiplier = 1;
  if (token.endsWith('%')) {
    token = token.slice(0, -1);
    multiplier = 0.01;
  }
  if (!token.length) {
    return null;
  }
  const value = Number(token);
  if (Number.isNaN(value)) {
    return null;
  }
  return value * multiplier;
}
