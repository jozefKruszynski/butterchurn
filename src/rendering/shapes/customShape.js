import Utils from "../../utils";
import ShaderUtils, { buildProgram, fillThickOffset } from "../shaders/shaderUtils";

const SHAPE_INSTANCE_KEYS = [
  "a",
  "a2",
  "additive",
  "ang",
  "b",
  "b2",
  "border_a",
  "border_b",
  "border_g",
  "border_r",
  "g",
  "g2",
  "r",
  "r2",
  "rad",
  "sides",
  "tex_ang",
  "tex_zoom",
  "textured",
  "thickoutline",
  "x",
  "y",
];

const MAX_SIDES = 101;
const VERTS_PER_INSTANCE = MAX_SIDES + 2;
const INITIAL_BATCH_VERTS = 8 * VERTS_PER_INSTANCE;

export default class CustomShape {
  constructor(index, gl, opts) {
    this.index = index;
    this.gl = gl;

    this.borderPositions = new Float32Array((MAX_SIDES + 1) * 3);

    // instances sharing blend/texture state accumulate here and render as a
    // single indexed draw; instance-heavy presets otherwise flood the driver
    // with one buffer upload and draw call per instance
    this.batchCapacity = INITIAL_BATCH_VERTS;
    this.batchPositions = new Float32Array(this.batchCapacity * 3);
    this.batchColors = new Float32Array(this.batchCapacity * 4);
    this.batchUvs = new Float32Array(this.batchCapacity * 2);
    this.batchIndices = new Uint32Array(this.batchCapacity * 3);
    this.batchVertexCount = 0;
    this.batchIndexCount = 0;
    this.batchTextured = false;
    this.batchAdditive = false;
    this.batchTexture = null;
    this.gpuCapacity = 0;

    this.texsizeX = opts.texsizeX;
    this.texsizeY = opts.texsizeY;
    this.aspectx = opts.aspectx;
    this.aspecty = opts.aspecty;
    this.invAspectx = 1.0 / this.aspectx;
    this.invAspecty = 1.0 / this.aspecty;

    this.positionVertexBuf = this.gl.createBuffer();
    this.colorVertexBuf = this.gl.createBuffer();
    this.uvVertexBuf = this.gl.createBuffer();
    this.indexBuf = this.gl.createBuffer();
    this.borderPositionVertexBuf = this.gl.createBuffer();

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.borderPositionVertexBuf);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      this.borderPositions,
      this.gl.DYNAMIC_DRAW
    );

    this.scratch2 = new Float32Array(2);
    this.instanceValsScratch = {};

    this.floatPrecision = ShaderUtils.getFragmentFloatPrecision(this.gl);
    this.createShader();
    this.createBorderShader();

    this.mainSampler = this.gl.createSampler();

    gl.samplerParameteri(
      this.mainSampler,
      gl.TEXTURE_MIN_FILTER,
      gl.LINEAR_MIPMAP_LINEAR
    );
    gl.samplerParameteri(this.mainSampler, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.samplerParameteri(this.mainSampler, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.samplerParameteri(this.mainSampler, gl.TEXTURE_WRAP_T, gl.REPEAT);
  }

  updateGlobals(opts) {
    this.texsizeX = opts.texsizeX;
    this.texsizeY = opts.texsizeY;
    this.aspectx = opts.aspectx;
    this.aspecty = opts.aspecty;
    this.invAspectx = 1.0 / this.aspectx;
    this.invAspecty = 1.0 / this.aspecty;
  }

  createShader() {
    this.shaderProgram = buildProgram(
      this.gl,
      `
      #version 300 es
      in vec3 aPos;
      in vec4 aColor;
      in vec2 aUv;
      out vec4 vColor;
      out vec2 vUv;
      void main(void) {
        vColor = aColor;
        vUv = aUv;
        gl_Position = vec4(aPos, 1.0);
      }
      `.trim(),
      `
      #version 300 es
      precision ${this.floatPrecision} float;
      precision highp int;
      precision mediump sampler2D;
      uniform sampler2D uTexture;
      uniform float uTextured;
      in vec4 vColor;
      in vec2 vUv;
      out vec4 fragColor;
      void main(void) {
        if (uTextured != 0.0) {
          fragColor = texture(uTexture, vUv) * vColor;
        } else {
          fragColor = vColor;
        }
      }
      `.trim()
    );

    this.aPosLocation = this.gl.getAttribLocation(this.shaderProgram, "aPos");
    this.aColorLocation = this.gl.getAttribLocation(
      this.shaderProgram,
      "aColor"
    );
    this.aUvLocation = this.gl.getAttribLocation(this.shaderProgram, "aUv");

    this.texturedLoc = this.gl.getUniformLocation(
      this.shaderProgram,
      "uTextured"
    );
    this.textureLoc = this.gl.getUniformLocation(
      this.shaderProgram,
      "uTexture"
    );
  }

  createBorderShader() {
    this.borderShaderProgram = buildProgram(
      this.gl,
      `
      #version 300 es
      in vec3 aBorderPos;
      uniform vec2 thickOffset;
      void main(void) {
        gl_Position = vec4(aBorderPos +
                            vec3(thickOffset, 0.0), 1.0);
      }
      `.trim(),
      `
      #version 300 es
      precision ${this.floatPrecision} float;
      precision highp int;
      precision mediump sampler2D;
      out vec4 fragColor;
      uniform vec4 uBorderColor;
      void main(void) {
        fragColor = uBorderColor;
      }
      `.trim()
    );

    this.aBorderPosLoc = this.gl.getAttribLocation(
      this.borderShaderProgram,
      "aBorderPos"
    );

    this.uBorderColorLoc = this.gl.getUniformLocation(
      this.borderShaderProgram,
      "uBorderColor"
    );
    this.thickOffsetLoc = this.gl.getUniformLocation(
      this.borderShaderProgram,
      "thickOffset"
    );
  }

  drawCustomShape(
    blendProgress,
    globalVars,
    presetEquationRunner,
    shapeEqs,
    prevTexture
  ) {
    if (shapeEqs.baseVals.enabled !== 0) {
      if (!presetEquationRunner.preset.useWASM) {
        this.setupShapeBuffers(presetEquationRunner.mdVSFrame.wrap);

        let mdVSShape = Object.assign(
          {},
          presetEquationRunner.mdVSShapes[this.index],
          presetEquationRunner.mdVSFrameMapShapes[this.index],
          globalVars
        );

        // If we aren't setting these every instance, set them initially
        if (
          presetEquationRunner.preset.shapes[this.index].frame_eqs_str === ""
        ) {
          mdVSShape = Object.assign(
            mdVSShape,
            presetEquationRunner.mdVSQAfterFrame,
            presetEquationRunner.mdVSTShapeInits[this.index]
          );
        }

        const baseVals =
          presetEquationRunner.preset.shapes[this.index].baseVals;

        const numInst = Math.clamp(
          baseVals.num_inst,
          1,
          this.maxInstances ?? 1024
        );
        for (let j = 0; j < numInst; j++) {
          mdVSShape.instance = j;
          mdVSShape.x = baseVals.x;
          mdVSShape.y = baseVals.y;
          mdVSShape.rad = baseVals.rad;
          mdVSShape.ang = baseVals.ang;
          mdVSShape.r = baseVals.r;
          mdVSShape.g = baseVals.g;
          mdVSShape.b = baseVals.b;
          mdVSShape.a = baseVals.a;
          mdVSShape.r2 = baseVals.r2;
          mdVSShape.g2 = baseVals.g2;
          mdVSShape.b2 = baseVals.b2;
          mdVSShape.a2 = baseVals.a2;
          mdVSShape.border_r = baseVals.border_r;
          mdVSShape.border_g = baseVals.border_g;
          mdVSShape.border_b = baseVals.border_b;
          mdVSShape.border_a = baseVals.border_a;
          mdVSShape.thickoutline = baseVals.thickoutline;
          mdVSShape.textured = baseVals.textured;
          mdVSShape.tex_zoom = baseVals.tex_zoom;
          mdVSShape.tex_ang = baseVals.tex_ang;
          mdVSShape.additive = baseVals.additive;

          let mdVSShapeFrame;
          if (
            presetEquationRunner.preset.shapes[this.index].frame_eqs_str !== ""
          ) {
            mdVSShape = Object.assign(
              mdVSShape,
              presetEquationRunner.mdVSQAfterFrame,
              presetEquationRunner.mdVSTShapeInits[this.index]
            );

            mdVSShapeFrame = presetEquationRunner.runShapeFrameEquations(
              this.index,
              mdVSShape
            );
          } else {
            mdVSShapeFrame = mdVSShape;
          }

          this.mdVSShapeFrame = mdVSShapeFrame;

          this.buildAndDrawInstance(mdVSShapeFrame, blendProgress, prevTexture);
        }

        const mdVSUserKeysShape =
          presetEquationRunner.mdVSUserKeysShapes[this.index];
        const mdVSNewFrameMapShape = Utils.pick(
          this.mdVSShapeFrame,
          mdVSUserKeysShape
        );


        presetEquationRunner.mdVSFrameMapShapes[
          this.index
        ] = mdVSNewFrameMapShape;
      } else {

        this.setupShapeBuffers(
          presetEquationRunner.preset.globalPools.perFrame.wrap.value
        );

        const baseVals =
          presetEquationRunner.preset.shapes[this.index].baseVals;
        const varPool =
          presetEquationRunner.preset.globalPools[`shapePerFrame${this.index}`];
        Utils.setWasm(varPool, globalVars, presetEquationRunner.globalKeys);

        // If we aren't setting these every instance, set them initially
        if (!presetEquationRunner.preset.shapes[this.index].frame_eqs) {
          presetEquationRunner.preset.restore_qs();
        }

        Utils.setWasm(
          varPool,
          presetEquationRunner.mdVSTShapeInits[this.index],
          presetEquationRunner.ts
        );
        presetEquationRunner.preset.save_ts();

        varPool.x.value = baseVals.x;
        varPool.y.value = baseVals.y;
        varPool.rad.value = baseVals.rad;
        varPool.ang.value = baseVals.ang;
        varPool.r.value = baseVals.r;
        varPool.g.value = baseVals.g;
        varPool.b.value = baseVals.b;
        varPool.a.value = baseVals.a;
        varPool.r2.value = baseVals.r2;
        varPool.g2.value = baseVals.g2;
        varPool.b2.value = baseVals.b2;
        varPool.a2.value = baseVals.a2;
        varPool.border_r.value = baseVals.border_r;
        varPool.border_g.value = baseVals.border_g;
        varPool.border_b.value = baseVals.border_b;
        varPool.border_a.value = baseVals.border_a;
        varPool.thickoutline.value = baseVals.thickoutline;
        varPool.textured.value = baseVals.textured;
        varPool.tex_zoom.value = baseVals.tex_zoom;
        varPool.tex_ang.value = baseVals.tex_ang;
        varPool.additive.value = baseVals.additive;
        presetEquationRunner.preset.shapes[this.index].frame_eqs_save();

        const numInst = Math.clamp(
          baseVals.num_inst,
          1,
          this.maxInstances ?? 1024
        );
        for (let j = 0; j < numInst; j++) {
          varPool.instance.value = j;

          // this condition should check the JS equations because of comments
          if (presetEquationRunner.preset.shapes[this.index].frame_eqs) {
            presetEquationRunner.preset.shapes[this.index].frame_eqs_restore();
            presetEquationRunner.preset.restore_qs();
            presetEquationRunner.preset.restore_ts();
            presetEquationRunner.preset.shapes[this.index].frame_eqs();
          }

          const vals = this.instanceValsScratch;
          for (const key of SHAPE_INSTANCE_KEYS) {
            vals[key] = varPool[key].value;
          }
          this.buildAndDrawInstance(vals, blendProgress, prevTexture);
        }
      }

      this.flushBatch();
    }
  }

  setupShapeBuffers(wrap) {
    const wrapping = wrap !== 0 ? this.gl.REPEAT : this.gl.CLAMP_TO_EDGE;
    this.gl.samplerParameteri(
      this.mainSampler,
      this.gl.TEXTURE_WRAP_S,
      wrapping
    );
    this.gl.samplerParameteri(
      this.mainSampler,
      this.gl.TEXTURE_WRAP_T,
      wrapping
    );
  }

  ensureBatchCapacity(vertsNeeded) {
    if (this.batchVertexCount + vertsNeeded <= this.batchCapacity) {return;}
    let capacity = this.batchCapacity;
    while (this.batchVertexCount + vertsNeeded > capacity) {capacity *= 2;}
    const positions = new Float32Array(capacity * 3);
    positions.set(this.batchPositions);
    const colors = new Float32Array(capacity * 4);
    colors.set(this.batchColors);
    const uvs = new Float32Array(capacity * 2);
    uvs.set(this.batchUvs);
    const indices = new Uint32Array(capacity * 3);
    indices.set(this.batchIndices);
    this.batchPositions = positions;
    this.batchColors = colors;
    this.batchUvs = uvs;
    this.batchIndices = indices;
    this.batchCapacity = capacity;
  }

  // geometry for both equation paths; vals carries the raw per-instance
  // values each path produced. The fill is appended to the batch (deferred
  // draw); a border forces the batch out immediately to keep paint order.
  buildAndDrawInstance(vals, blendProgress, prevTexture) {
    let sides = vals.sides;
    sides = Math.clamp(sides, 3, 100);
    sides = Math.floor(sides);

    const rad = vals.rad;
    const ang = vals.ang;

    const x = vals.x * 2 - 1;
    const y = vals.y * -2 + 1;

    const r = vals.r;
    const g = vals.g;
    const b = vals.b;
    const a = vals.a;
    const r2 = vals.r2;
    const g2 = vals.g2;
    const b2 = vals.b2;
    const a2 = vals.a2;

    const borderR = vals.border_r;
    const borderG = vals.border_g;
    const borderB = vals.border_b;
    const borderA = vals.border_a;
    this.borderColor = [
      borderR,
      borderG,
      borderB,
      borderA * blendProgress,
    ];

    const thickoutline = vals.thickoutline;

    const textured = vals.textured;
    const texZoom = vals.tex_zoom;
    const texAng = vals.tex_ang;

    const additive = vals.additive;

    const hasBorder = this.borderColor[3] > 0;
    const isTextured = Math.abs(textured) >= 1;
    const isBorderThick = Math.abs(thickoutline) >= 1;
    const isAdditive = Math.abs(additive) >= 1;

    // blend mode and texturing are draw state, so a change ends the batch
    if (
      this.batchVertexCount > 0 &&
      (isTextured !== this.batchTextured || isAdditive !== this.batchAdditive)
    ) {
      this.flushBatch();
    }
    if (this.batchVertexCount === 0) {
      this.batchTextured = isTextured;
      this.batchAdditive = isAdditive;
      this.batchTexture = prevTexture;
    }

    this.ensureBatchCapacity(sides + 2);
    const base = this.batchVertexCount;
    const positions = this.batchPositions;
    const colors = this.batchColors;
    const uvs = this.batchUvs;

    positions[base * 3 + 0] = x;
    positions[base * 3 + 1] = y;
    positions[base * 3 + 2] = 0;

    colors[base * 4 + 0] = r;
    colors[base * 4 + 1] = g;
    colors[base * 4 + 2] = b;
    colors[base * 4 + 3] = a * blendProgress;

    if (isTextured) {
      uvs[base * 2 + 0] = 0.5;
      uvs[base * 2 + 1] = 0.5;
    }

    const quarterPi = Math.PI * 0.25;
    for (let k = 1; k <= sides + 1; k++) {
      const p = (k - 1) / sides;
      const pTwoPi = p * 2 * Math.PI;
      const v = base + k;

      const angSum = pTwoPi + ang + quarterPi;
      positions[v * 3 + 0] = x + rad * Math.cos(angSum) * this.aspecty;
      positions[v * 3 + 1] = y + rad * Math.sin(angSum);
      positions[v * 3 + 2] = 0;

      colors[v * 4 + 0] = r2;
      colors[v * 4 + 1] = g2;
      colors[v * 4 + 2] = b2;
      colors[v * 4 + 3] = a2 * blendProgress;

      if (isTextured) {
        const texAngSum = pTwoPi + texAng + quarterPi;
        uvs[v * 2 + 0] =
          0.5 + ((0.5 * Math.cos(texAngSum)) / texZoom) * this.aspecty;
        uvs[v * 2 + 1] = 0.5 + (0.5 * Math.sin(texAngSum)) / texZoom;
      }

      if (hasBorder) {
        this.borderPositions[(k - 1) * 3 + 0] = positions[v * 3 + 0];
        this.borderPositions[(k - 1) * 3 + 1] = positions[v * 3 + 1];
        this.borderPositions[(k - 1) * 3 + 2] = positions[v * 3 + 2];
      }
    }

    // fan triangle k is (center, ring k, ring k+1); indexed triangles keep
    // that exact primitive order, so blending matches the per-instance draws
    let idx = this.batchIndexCount;
    const indices = this.batchIndices;
    for (let k = 1; k <= sides; k++) {
      indices[idx++] = base;
      indices[idx++] = base + k;
      indices[idx++] = base + k + 1;
    }
    this.batchIndexCount = idx;
    this.batchVertexCount += sides + 2;

    if (hasBorder) {
      this.flushBatch();
      this.drawBorderInstance(sides, isBorderThick);
    }
  }

  flushBatch() {
    if (this.batchVertexCount === 0) {return;}
    const gl = this.gl;

    gl.useProgram(this.shaderProgram);

    const grown = this.gpuCapacity < this.batchCapacity;
    if (grown) {this.gpuCapacity = this.batchCapacity;}

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionVertexBuf);
    if (grown) {
      gl.bufferData(gl.ARRAY_BUFFER, this.batchPositions, gl.DYNAMIC_DRAW);
    } else {
      gl.bufferSubData(
        gl.ARRAY_BUFFER,
        0,
        this.batchPositions,
        0,
        this.batchVertexCount * 3
      );
    }
    gl.vertexAttribPointer(this.aPosLocation, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(this.aPosLocation);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorVertexBuf);
    if (grown) {
      gl.bufferData(gl.ARRAY_BUFFER, this.batchColors, gl.DYNAMIC_DRAW);
    } else {
      gl.bufferSubData(
        gl.ARRAY_BUFFER,
        0,
        this.batchColors,
        0,
        this.batchVertexCount * 4
      );
    }
    gl.vertexAttribPointer(this.aColorLocation, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(this.aColorLocation);

    // the uv buffer is bound (and kept at capacity) even untextured so the
    // enabled attribute never points past its storage
    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvVertexBuf);
    if (grown) {
      gl.bufferData(gl.ARRAY_BUFFER, this.batchUvs, gl.DYNAMIC_DRAW);
    } else if (this.batchTextured) {
      gl.bufferSubData(
        gl.ARRAY_BUFFER,
        0,
        this.batchUvs,
        0,
        this.batchVertexCount * 2
      );
    }
    gl.vertexAttribPointer(this.aUvLocation, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(this.aUvLocation);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuf);
    if (grown) {
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.batchIndices, gl.DYNAMIC_DRAW);
    } else {
      gl.bufferSubData(
        gl.ELEMENT_ARRAY_BUFFER,
        0,
        this.batchIndices,
        0,
        this.batchIndexCount
      );
    }

    gl.uniform1f(this.texturedLoc, this.batchTextured ? 1 : 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.batchTexture);
    gl.bindSampler(0, this.mainSampler);
    gl.uniform1i(this.textureLoc, 0);

    if (this.batchAdditive) {
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    } else {
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }

    gl.drawElements(gl.TRIANGLES, this.batchIndexCount, gl.UNSIGNED_INT, 0);

    this.batchVertexCount = 0;
    this.batchIndexCount = 0;
  }

  drawBorderInstance(sides, isBorderThick) {
    this.gl.useProgram(this.borderShaderProgram);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.borderPositionVertexBuf);
    this.gl.bufferSubData(
      this.gl.ARRAY_BUFFER,
      0,
      this.borderPositions,
      0,
      (sides + 1) * 3
    );

    this.gl.vertexAttribPointer(
      this.aBorderPosLoc,
      3,
      this.gl.FLOAT,
      false,
      0,
      0
    );
    this.gl.enableVertexAttribArray(this.aBorderPosLoc);

    this.gl.uniform4fv(this.uBorderColorLoc, this.borderColor);

    const instances = isBorderThick ? 4 : 1;
    for (let i = 0; i < instances; i++) {
      this.gl.uniform2fv(
        this.thickOffsetLoc,
        fillThickOffset(this.scratch2, i, this.texsizeX, this.texsizeY)
      );

      this.gl.drawArrays(this.gl.LINE_STRIP, 0, sides + 1);
    }
  }
}
