import ShaderUtils, { buildProgram } from "./shaderUtils";

// anchors of the luminance ramp; the shader array and the upload share this size
export const PALETTE_RAMP_SIZE = 5;

export default class OutputShader {
  constructor(gl, opts) {
    this.gl = gl;

    this.textureRatio = opts.textureRatio;
    this.texsizeX = opts.texsizeX;
    this.texsizeY = opts.texsizeY;

    this.positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);

    this.tintColor = [0, 0, 0];
    this.tintAmount = 0;

    this.paletteRampColors = new Float32Array(PALETTE_RAMP_SIZE * 3);
    this.paletteRampCount = 1;
    this.paletteRampAmount = 0;

    this.vertexBuf = this.gl.createBuffer();
    // the quad never changes; upload once
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuf);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      this.positions,
      this.gl.STATIC_DRAW
    );

    this.floatPrecision = ShaderUtils.getFragmentFloatPrecision(this.gl);
    if (this.useFXAA()) {
      this.createFXAAShader();
    } else {
      this.createShader();
    }
  }

  useFXAA() {
    return this.textureRatio <= 1;
  }

  updateGlobals(opts) {
    this.textureRatio = opts.textureRatio;
    this.texsizeX = opts.texsizeX;
    this.texsizeY = opts.texsizeY;

    this.gl.deleteProgram(this.shaderProgram);

    if (this.useFXAA()) {
      this.createFXAAShader();
    } else {
      this.createShader();
    }
  }

  // based on https://github.com/mattdesl/glsl-fxaa
  createFXAAShader() {
    this.shaderProgram = buildProgram(
      this.gl,
      `#version 300 es
       const vec2 halfmad = vec2(0.5);
       in vec2 aPos;
       out vec2 v_rgbM;
       out vec2 v_rgbNW;
       out vec2 v_rgbNE;
       out vec2 v_rgbSW;
       out vec2 v_rgbSE;
       uniform vec4 texsize;
       void main(void) {
         gl_Position = vec4(aPos, 0.0, 1.0);

         v_rgbM = aPos * halfmad + halfmad;
         v_rgbNW = v_rgbM + (vec2(-1.0, -1.0) * texsize.zx);
         v_rgbNE = v_rgbM + (vec2(1.0, -1.0) * texsize.zx);
         v_rgbSW = v_rgbM + (vec2(-1.0, 1.0) * texsize.zx);
         v_rgbSE = v_rgbM + (vec2(1.0, 1.0) * texsize.zx);
       }`,
      `#version 300 es
       precision ${this.floatPrecision} float;
       precision highp int;
       precision mediump sampler2D;

       in vec2 v_rgbM;
       in vec2 v_rgbNW;
       in vec2 v_rgbNE;
       in vec2 v_rgbSW;
       in vec2 v_rgbSE;
       out vec4 fragColor;
       uniform vec4 texsize;
       uniform sampler2D uTexture;

       uniform vec3 u_tint;
       uniform float u_tintAmount;
       float tintLum(vec3 c) { return dot(c, vec3(0.30, 0.59, 0.11)); }
       vec3 tintClip(vec3 c) {
         float l = tintLum(c);
         float n = min(min(c.r, c.g), c.b);
         float x = max(max(c.r, c.g), c.b);
         if (n < 0.0 && l > n) c = l + ((c - l) * l) / (l - n);
         if (x > 1.0 && x > l) c = l + ((c - l) * (1.0 - l)) / (x - l);
         return c;
       }
       // the CSS Compositing "color" blend: keep luminance, take tint hue/sat
       vec3 applyTint(vec3 rgb) {
         if (u_tintAmount <= 0.0) return rgb;
         vec3 blended = tintClip(u_tint + (tintLum(rgb) - tintLum(u_tint)));
         return mix(rgb, blended, u_tintAmount);
       }

       uniform vec3 u_paletteRamp[${PALETTE_RAMP_SIZE}];
       uniform float u_paletteRampAmount;
       uniform int u_paletteRampCount;
       // anchors run dark to light, evenly spaced over the luminance range
       vec3 rampColor(float lum) {
         int last = u_paletteRampCount - 1;
         if (last <= 0) return u_paletteRamp[0];
         float pos = clamp(lum, 0.0, 1.0) * float(last);
         float lowIdx = min(floor(pos), float(last - 1));
         int low = int(lowIdx);
         return mix(u_paletteRamp[low], u_paletteRamp[low + 1], pos - lowIdx);
       }
       // the tint blend again, but the target color comes from the ramp
       vec3 applyPaletteRamp(vec3 rgb) {
         if (u_paletteRampAmount <= 0.0) return rgb;
         float lum = tintLum(rgb);
         vec3 target = rampColor(lum);
         vec3 blended = tintClip(target + (lum - tintLum(target)));
         return mix(rgb, blended, u_paletteRampAmount);
       }

       #ifndef FXAA_REDUCE_MIN
         #define FXAA_REDUCE_MIN   (1.0/ 128.0)
       #endif
       #ifndef FXAA_REDUCE_MUL
         #define FXAA_REDUCE_MUL   (1.0 / 8.0)
       #endif
       #ifndef FXAA_SPAN_MAX
         #define FXAA_SPAN_MAX     8.0
       #endif

       void main(void) {
         vec4 color;
         vec3 rgbNW = textureLod(uTexture, v_rgbNW, 0.0).xyz;
         vec3 rgbNE = textureLod(uTexture, v_rgbNE, 0.0).xyz;
         vec3 rgbSW = textureLod(uTexture, v_rgbSW, 0.0).xyz;
         vec3 rgbSE = textureLod(uTexture, v_rgbSE, 0.0).xyz;
         vec3 rgbM  = textureLod(uTexture, v_rgbM, 0.0).xyz;
         vec3 luma = vec3(0.299, 0.587, 0.114);
         float lumaNW = dot(rgbNW, luma);
         float lumaNE = dot(rgbNE, luma);
         float lumaSW = dot(rgbSW, luma);
         float lumaSE = dot(rgbSE, luma);
         float lumaM  = dot(rgbM,  luma);
         float lumaMin = min(lumaM, min(min(lumaNW, lumaNE), min(lumaSW, lumaSE)));
         float lumaMax = max(lumaM, max(max(lumaNW, lumaNE), max(lumaSW, lumaSE)));

         mediump vec2 dir;
         dir.x = -((lumaNW + lumaNE) - (lumaSW + lumaSE));
         dir.y =  ((lumaNW + lumaSW) - (lumaNE + lumaSE));

         float dirReduce = max((lumaNW + lumaNE + lumaSW + lumaSE) *
                               (0.25 * FXAA_REDUCE_MUL), FXAA_REDUCE_MIN);

         float rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
         dir = min(vec2(FXAA_SPAN_MAX, FXAA_SPAN_MAX),
                   max(vec2(-FXAA_SPAN_MAX, -FXAA_SPAN_MAX),
                   dir * rcpDirMin)) * texsize.zw;

         vec3 rgbA = 0.5 * (
             textureLod(uTexture, v_rgbM + dir * (1.0 / 3.0 - 0.5), 0.0).xyz +
             textureLod(uTexture, v_rgbM + dir * (2.0 / 3.0 - 0.5), 0.0).xyz);
         vec3 rgbB = rgbA * 0.5 + 0.25 * (
             textureLod(uTexture, v_rgbM + dir * -0.5, 0.0).xyz +
             textureLod(uTexture, v_rgbM + dir * 0.5, 0.0).xyz);

         float lumaB = dot(rgbB, luma);
         if ((lumaB < lumaMin) || (lumaB > lumaMax))
           color = vec4(rgbA, 1.0);
         else
           color = vec4(rgbB, 1.0);

         color.rgb = applyPaletteRamp(applyTint(color.rgb));

         fragColor = color;
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
    this.tintLoc = this.gl.getUniformLocation(this.shaderProgram, "u_tint");
    this.tintAmountLoc = this.gl.getUniformLocation(
      this.shaderProgram,
      "u_tintAmount"
    );
    this.paletteRampLoc = this.gl.getUniformLocation(
      this.shaderProgram,
      "u_paletteRamp[0]"
    );
    this.paletteRampAmountLoc = this.gl.getUniformLocation(
      this.shaderProgram,
      "u_paletteRampAmount"
    );
    this.paletteRampCountLoc = this.gl.getUniformLocation(
      this.shaderProgram,
      "u_paletteRampCount"
    );
    this.texsizeLoc = this.gl.getUniformLocation(this.shaderProgram, "texsize");
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

       uniform vec3 u_tint;
       uniform float u_tintAmount;
       float tintLum(vec3 c) { return dot(c, vec3(0.30, 0.59, 0.11)); }
       vec3 tintClip(vec3 c) {
         float l = tintLum(c);
         float n = min(min(c.r, c.g), c.b);
         float x = max(max(c.r, c.g), c.b);
         if (n < 0.0 && l > n) c = l + ((c - l) * l) / (l - n);
         if (x > 1.0 && x > l) c = l + ((c - l) * (1.0 - l)) / (x - l);
         return c;
       }
       // the CSS Compositing "color" blend: keep luminance, take tint hue/sat
       vec3 applyTint(vec3 rgb) {
         if (u_tintAmount <= 0.0) return rgb;
         vec3 blended = tintClip(u_tint + (tintLum(rgb) - tintLum(u_tint)));
         return mix(rgb, blended, u_tintAmount);
       }

       uniform vec3 u_paletteRamp[${PALETTE_RAMP_SIZE}];
       uniform float u_paletteRampAmount;
       uniform int u_paletteRampCount;
       // anchors run dark to light, evenly spaced over the luminance range
       vec3 rampColor(float lum) {
         int last = u_paletteRampCount - 1;
         if (last <= 0) return u_paletteRamp[0];
         float pos = clamp(lum, 0.0, 1.0) * float(last);
         float lowIdx = min(floor(pos), float(last - 1));
         int low = int(lowIdx);
         return mix(u_paletteRamp[low], u_paletteRamp[low + 1], pos - lowIdx);
       }
       // the tint blend again, but the target color comes from the ramp
       vec3 applyPaletteRamp(vec3 rgb) {
         if (u_paletteRampAmount <= 0.0) return rgb;
         float lum = tintLum(rgb);
         vec3 target = rampColor(lum);
         vec3 blended = tintClip(target + (lum - tintLum(target)));
         return mix(rgb, blended, u_paletteRampAmount);
       }

       void main(void) {
         fragColor = vec4(
           applyPaletteRamp(applyTint(texture(uTexture, uv).rgb)),
           1.0
         );
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
    this.tintLoc = this.gl.getUniformLocation(this.shaderProgram, "u_tint");
    this.tintAmountLoc = this.gl.getUniformLocation(
      this.shaderProgram,
      "u_tintAmount"
    );
    this.paletteRampLoc = this.gl.getUniformLocation(
      this.shaderProgram,
      "u_paletteRamp[0]"
    );
    this.paletteRampAmountLoc = this.gl.getUniformLocation(
      this.shaderProgram,
      "u_paletteRampAmount"
    );
    this.paletteRampCountLoc = this.gl.getUniformLocation(
      this.shaderProgram,
      "u_paletteRampCount"
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

    this.gl.uniform1i(this.textureLoc, 0);
    this.gl.uniform3f(
      this.tintLoc,
      this.tintColor[0],
      this.tintColor[1],
      this.tintColor[2]
    );
    this.gl.uniform1f(this.tintAmountLoc, this.tintAmount);
    this.gl.uniform3fv(this.paletteRampLoc, this.paletteRampColors);
    this.gl.uniform1i(this.paletteRampCountLoc, this.paletteRampCount);
    this.gl.uniform1f(this.paletteRampAmountLoc, this.paletteRampAmount);

    if (this.useFXAA()) {
      this.gl.uniform4fv(
        this.texsizeLoc,
        new Float32Array([
          this.texsizeX,
          this.texsizeY,
          1.0 / this.texsizeX,
          1.0 / this.texsizeY,
        ])
      );
    }

    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  }
}
