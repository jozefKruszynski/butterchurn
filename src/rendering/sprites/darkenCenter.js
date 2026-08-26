import ShaderUtils, { buildProgram } from "../shaders/shaderUtils";

export default class DarkenCenter {
  constructor(gl, opts) {
    this.gl = gl;

    this.aspectx = opts.aspectx;
    this.aspecty = opts.aspecty;

    this.generatePositions();

    this.colors = new Float32Array([
      0,
      0,
      0,
      3 / 32,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
    ]);

    this.positionVertexBuf = this.gl.createBuffer();
    this.colorVertexBuf = this.gl.createBuffer();

    // colors never change; upload once
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.colorVertexBuf);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, this.colors, this.gl.STATIC_DRAW);
    this.uploadPositions();

    this.floatPrecision = ShaderUtils.getFragmentFloatPrecision(this.gl);
    this.createShader();
  }

  updateGlobals(opts) {
    this.aspectx = opts.aspectx;
    this.aspecty = opts.aspecty;

    this.generatePositions();
    this.uploadPositions();
  }

  // positions change only with the aspect globals, not per frame
  uploadPositions() {
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionVertexBuf);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      this.positions,
      this.gl.STATIC_DRAW
    );
  }

  generatePositions() {
    const halfSize = 0.05;
    this.positions = new Float32Array([
      0,
      0,
      0,
      -halfSize * this.aspecty,
      0,
      0,
      0,
      -halfSize,
      0,
      halfSize * this.aspecty,
      0,
      0,
      0,
      halfSize,
      0,
      -halfSize * this.aspecty,
      0,
      0,
    ]);
  }

  createShader() {
    this.shaderProgram = buildProgram(
      this.gl,
      `
      #version 300 es
      in vec3 aPos;
      in vec4 aColor;
      out vec4 vColor;
      void main(void) {
        vColor = aColor;
        gl_Position = vec4(aPos, 1.0);
      }
      `.trim(),
      `
      #version 300 es
      precision ${this.floatPrecision} float;
      precision highp int;
      precision mediump sampler2D;
      in vec4 vColor;
      out vec4 fragColor;
      void main(void) {
        fragColor = vColor;
      }
      `.trim()
    );

    this.aPosLocation = this.gl.getAttribLocation(this.shaderProgram, "aPos");
    this.aColorLocation = this.gl.getAttribLocation(
      this.shaderProgram,
      "aColor"
    );
  }

  drawDarkenCenter(mdVSFrame) {
    if (mdVSFrame.darken_center !== 0) {
      this.gl.useProgram(this.shaderProgram);

      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionVertexBuf);

      this.gl.vertexAttribPointer(
        this.aPosLocation,
        3,
        this.gl.FLOAT,
        false,
        0,
        0
      );
      this.gl.enableVertexAttribArray(this.aPosLocation);

      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.colorVertexBuf);

      this.gl.vertexAttribPointer(
        this.aColorLocation,
        4,
        this.gl.FLOAT,
        false,
        0,
        0
      );
      this.gl.enableVertexAttribArray(this.aColorLocation);

      this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

      this.gl.drawArrays(this.gl.TRIANGLE_FAN, 0, this.positions.length / 3);
    }
  }
}
