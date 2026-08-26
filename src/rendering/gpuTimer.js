/**
 * GPU section timing via EXT_disjoint_timer_query_webgl2.
 *
 * Sections are sequential: section() closes the previous query and opens the
 * next, frameEnd() closes the last and polls finished results into per-section
 * exponential moving averages. Everything no-ops when the extension is
 * unavailable, so callers never need to check support first.
 */
export default class GpuTimer {
  constructor(gl) {
    this.gl = gl;
    this.ext = gl.getExtension("EXT_disjoint_timer_query_webgl2");
    this.pending = [];
    this.active = null;
    this.ema = {};
  }

  get supported() {
    return !!this.ext;
  }

  section(name) {
    if (!this.ext) {return;}
    this.endSection();
    const query = this.gl.createQuery();
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, query);
    this.active = { query, name };
  }

  endSection() {
    if (!this.active) {return;}
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.pending.push(this.active);
    this.active = null;
  }

  frameEnd() {
    if (!this.ext) {return;}
    this.endSection();

    while (this.pending.length > 0) {
      const { query, name } = this.pending[0];
      if (!this.gl.getQueryParameter(query, this.gl.QUERY_RESULT_AVAILABLE)) {
        break;
      }
      if (!this.gl.getParameter(this.ext.GPU_DISJOINT_EXT)) {
        const ms = this.gl.getQueryParameter(query, this.gl.QUERY_RESULT) / 1e6;
        const prev = this.ema[name];
        this.ema[name] = prev === undefined ? ms : prev * 0.9 + ms * 0.1;
      }
      this.gl.deleteQuery(query);
      this.pending.shift();
    }

    // a stalled driver must not accumulate queries without bound
    if (this.pending.length > 30) {
      for (const entry of this.pending) {this.gl.deleteQuery(entry.query);}
      this.pending = [];
    }
  }

  timings() {
    return this.ext ? { ...this.ema } : null;
  }
}
