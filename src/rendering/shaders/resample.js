import ShaderUtils, { buildProgram } from "./shaderUtils";

export default class ResampleShader {
  constructor(gl) {
    this.gl = gl;

    this.positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);

    this.vertexBuf = this.gl.createBuffer();
    // the quad never changes; upload once
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuf);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      this.positions,
      this.gl.STATIC_DRAW
    );

    this.floatPrecision = ShaderUtils.getFragmentFloatPrecision(this.gl);
    this.createShader();
  }

  createShader() {
    this.shaderProgram = buildProgram(
      this.gl,
      `#version 300 es
       const vec2 halfmad = vec2(0.5);
       in vec2 aPos;
       out vec2 uv;
       void main(void) {
         gl_Position = vec4(aPos, 0.0, 1.0);
         uv = aPos * halfmad + halfmad;
       }`,
      `#version 300 es
       precision ${this.floatPrecision} float;
       precision highp int;
       precision mediump sampler2D;

       in vec2 uv;
       out vec4 fragColor;
       uniform sampler2D uTexture;

       void main(void) {
         fragColor = vec4(texture(uTexture, uv).rgb, 1.0);
       }`
    );

    this.positionLocation = this.gl.getAttribLocation(
      this.shaderProgram,
      "aPos"
    );
    this.textureLoc = this.gl.getUniformLocation(
      this.shaderProgram,
      "uTexture"
    );
  }

  renderQuadTexture(texture) {
    this.gl.useProgram(this.shaderProgram);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuf);

    this.gl.vertexAttribPointer(
      this.positionLocation,
      2,
      this.gl.FLOAT,
      false,
      0,
      0
    );
    this.gl.enableVertexAttribArray(this.positionLocation);

    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.generateMipmap(this.gl.TEXTURE_2D);

    this.gl.uniform1i(this.textureLoc, 0);

    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  }
}
