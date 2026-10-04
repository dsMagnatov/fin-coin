const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/** A shared conveyor path with independent, inertial 3D rotation.
 * Pointer input never changes a coin's position or another coin's motion. */
export class CoinPhysics {
  constructor(bodies, bounds, { flowSpeed = 0 } = {}) {
    this.bodies = bodies;
    this.bounds = bounds;
    this.flowSpeed = flowSpeed;
    this.dragged = null;
    this.time = 0;
    // All coins use the same loop length so their spacing survives every wrap.
    const maxRadius = Math.max(...bodies.map(b => b.visualRadius ?? b.radius));
    this.margin = maxRadius + 0.1;
    this.minSpacing = maxRadius * 2 + 0.3;
    for (const b of bodies) this.contain(b);
  }

  get padding() {
    const width = this.bounds.right - this.bounds.left;
    return Math.max(this.margin, (this.minSpacing * this.bodies.length - width) / 2);
  }

  get loopStart() { return this.bounds.left - this.padding; }
  get loopEnd() { return this.bounds.right + this.padding; }

  resizeBounds(bounds, { radius, visualRadius } = {}) {
    const oldStart = this.loopStart;
    const oldSpan = this.loopEnd - oldStart;
    const old = this.bounds;
    for (const b of this.bodies) {
      if (radius !== undefined) b.radius = radius;
      if (visualRadius !== undefined) b.visualRadius = visualRadius;
    }
    const maxRadius = Math.max(...this.bodies.map(b => b.visualRadius ?? b.radius));
    this.margin = maxRadius + 0.1;
    this.minSpacing = maxRadius * 2 + 0.3;
    this.bounds = bounds;
    const newSpan = this.loopEnd - this.loopStart;
    const heightRatio = (bounds.top - bounds.bottom) / (old.top - old.bottom);
    for (const b of this.bodies) {
      b.x = this.loopStart + (b.x - oldStart) / oldSpan * newSpan;
      b.homeY = bounds.bottom + (b.homeY - old.bottom) * heightRatio;
      b.y = bounds.bottom + (b.y - old.bottom) * heightRatio;
      this.contain(b);
    }
  }

  grab(body) {
    this.dragged = body;
    body.spinX = 0;
    body.spinY = 0;
  }

  rotate(body, dx, dy, dt) {
    if (!body || ![dx, dy, dt].every(Number.isFinite) || dt <= 0) return;
    const held = body === this.dragged;
    const sensitivity = (held ? 1.25 : 0.45) / body.radius;
    const angleX = -dy * sensitivity;
    const angleY = dx * sensitivity;
    body.rx += angleX;
    body.ry += angleY;
    const blend = held ? 0.5 : 0.22;
    const limit = held ? 6 : 3;
    body.spinX += (clamp(angleX / dt, -limit, limit) - body.spinX) * blend;
    body.spinY += (clamp(angleY / dt, -limit, limit) - body.spinY) * blend;
  }

  release(cancelled = false) {
    if (cancelled && this.dragged) {
      this.dragged.spinX = 0;
      this.dragged.spinY = 0;
    }
    this.dragged = null;
  }

  step(dt, animate = true) {
    if (animate) this.time += dt;
    const turnSpeed = animate ? -this.flowSpeed / (this.bounds.right - this.bounds.left) * Math.PI * 2 : 0;
    for (const b of this.bodies) {
      b.vx = animate ? this.flowSpeed : 0;
      b.x += b.vx * dt;
      // Vertical float is part of the predetermined path, never a pointer force.
      if (animate) b.y = b.homeY + Math.sin(this.time * 0.8 + b.phase) * 0.09;
      const free = b !== this.dragged;
      b.rx += ((animate ? Math.sin(this.time * 0.42 + b.phase) * 0.035 : 0) + (free ? b.spinX : 0)) * dt;
      b.ry += (turnSpeed + (free ? b.spinY : 0)) * dt;
      b.rz += (animate ? -turnSpeed * 0.32 + Math.sin(this.time * 0.32 + b.phase) * 0.022 : 0) * dt;
      b.spinX *= Math.exp(-3.2 * dt);
      b.spinY *= Math.exp(-3.2 * dt);
      this.contain(b);
    }
  }

  contain(b) {
    const span = this.loopEnd - this.loopStart;
    if (b.x < this.loopStart || b.x > this.loopEnd) {
      b.x = this.loopStart + ((b.x - this.loopStart) % span + span) % span;
      b.passes = (b.passes || 0) + 1;
    }
    const radius = b.visualRadius ?? b.radius;
    b.y = clamp(b.y, this.bounds.bottom + radius, this.bounds.top - radius);
  }
}
