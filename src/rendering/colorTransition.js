export const COLOR_TRANSITION_MS = 1500;

// Eased cross-fade shared by the tint, palette and palette-ramp paths: the
// colors and the strength ride one timeline, and a new target picks up
// wherever an interrupted one had reached.
export default class ColorTransition {
  constructor(size, durationMs = COLOR_TRANSITION_MS) {
    this.durationMs = durationMs;
    this.values = new Float32Array(size);
    this.from = new Float32Array(size);
    this.target = new Float32Array(size);
    this.amount = 0;
    this.fromAmount = 0;
    this.targetAmount = 0;
    this.startAt = null;
    this.started = false;
  }

  // a null `values` keeps the current colors and only fades the strength out
  to(values, amount) {
    this.from.set(this.values);
    this.fromAmount = this.amount;
    if (values) {
      this.target.set(values);
      // the first colors jump straight in; only the strength fades
      if (!this.started) {
        this.started = true;
        this.values.set(values);
        this.from.set(values);
      }
      this.targetAmount = amount;
    } else {
      this.targetAmount = 0;
    }
    if (this.durationMs > 0) {
      this.startAt = -1;
    } else {
      this.settle();
    }
  }

  tick(now) {
    if (this.startAt === -1) {this.startAt = now;}
    if (this.startAt === null) {return;}
    const t = Math.min((now - this.startAt) / this.durationMs, 1);
    // smoothstep approximates the CSS ease timing function
    const eased = t * t * (3 - 2 * t);
    for (let i = 0; i < this.values.length; i++) {
      this.values[i] = this.from[i] + (this.target[i] - this.from[i]) * eased;
    }
    this.amount =
      this.fromAmount + (this.targetAmount - this.fromAmount) * eased;
    if (t >= 1) {this.startAt = null;}
  }

  settle() {
    this.values.set(this.target);
    this.from.set(this.target);
    this.amount = this.targetAmount;
    this.fromAmount = this.targetAmount;
    this.startAt = null;
  }
}
