// The same projection is used by the drawn indicator and HUD visibility checks.
export function navigationGeometry(camera, target, radius) {
  const point = camera.matrix.transformPoint(target.x - camera.scrollX, target.y - camera.scrollY);
  const ring = { x: point.x, y: point.y,
    rx: radius * Math.hypot(camera.matrix.a, camera.matrix.c),
    ry: radius * Math.hypot(camera.matrix.b, camera.matrix.d) };
  const margin = 30;
  const cx = camera.x + camera.width / 2, cy = camera.y + camera.height / 2;
  let arrow = null;
  if (point.x <= camera.x + margin || point.x >= camera.x + camera.width - margin ||
      point.y <= camera.y + margin || point.y >= camera.y + camera.height - margin) {
    const dx = point.x - cx, dy = point.y - cy;
    const scale = Math.min(Math.max(0, camera.width / 2 - margin) / Math.max(1, Math.abs(dx)),
      Math.max(0, camera.height / 2 - margin) / Math.max(1, Math.abs(dy)));
    arrow = { x: cx + dx * scale, y: cy + dy * scale, rx: 23, ry: 23, angle: Math.atan2(dy, dx) };
  }
  return { ring, arrow };
}

export function indicatorObstructed(indicator, hud, canvas, size, padding = 10) {
  if (!indicator || !canvas.width || !canvas.height) return false;
  const sx = canvas.width / size.width, sy = canvas.height / size.height;
  const x = canvas.left + indicator.x * sx, y = canvas.top + indicator.y * sy;
  const rx = indicator.rx * sx + padding, ry = indicator.ry * sy + padding;
  // A circle/ellipse test avoids treating empty corners of its bounding box as a marker.
  const dx = x - Math.max(hud.left, Math.min(x, hud.right));
  const dy = y - Math.max(hud.top, Math.min(y, hud.bottom));
  return (dx / rx) ** 2 + (dy / ry) ** 2 <= 1 &&
    x + rx >= canvas.left && x - rx <= canvas.right &&
    y + ry >= canvas.top && y - ry <= canvas.bottom;
}

export class ManualNavigationOverride {
  expand(now, state) {
    this.until = now + 1800;
    this.baseline = state;
    this.cleared = false;
  }

  allowsCollapse(now, state, obstructed) {
    if (!this.baseline) return true;
    if (!obstructed) this.cleared = true;
    if (now < this.until) return false;
    const base = this.baseline;
    // A stationary, already obscured objective never immediately overrides inspection.
    return this.cleared || state.target !== base.target || state.order !== base.order ||
      state.status !== base.status || state.width !== base.width || state.height !== base.height ||
      state.zoom !== base.zoom || Math.hypot(state.x - base.x, state.y - base.y) >= 32 ||
      Math.hypot(state.scrollX - base.scrollX, state.scrollY - base.scrollY) * state.zoom >= 32;
  }
}
