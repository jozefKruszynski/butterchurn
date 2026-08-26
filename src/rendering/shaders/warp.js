import ShaderUtils, { buildProgram, fill2, fill4 } from "./shaderUtils";
import {
  assignLocations,
  COMMON_FRAG_UNIFORMS,
  buildPlaneGeometry,
  COMMON_LOCATIONS,
  createMainSamplers,
} from "./shaderCommon";
import { getRNG } from "../../utils/rngContext";

export default class WarpShader {
  constructor(gl, noise, image, opts = {}) {
    this.gl = gl;
    this.noise = noise;
    this.image = image;
    this.rng = getRNG();

    this.texsizeX = opts.texsizeX;
    this.texsizeY = opts.texsizeY;
    this.mesh_width = opts.mesh_width;
    this.mesh_height = opts.mesh_height;
    this.aspectx = opts.aspectx;
    this.aspecty = opts.aspecty;
    this.invAspectx = 1.0 / this.aspectx;
    this.invAspecty = 1.0 / this.aspecty;

    this.buildPositions();

    this.indexBuf = gl.createBuffer();
    this.positionVertexBuf = this.gl.createBuffer();
    this.warpUvVertexBuf = this.gl.createBuffer();
    this.warpColorVertexBuf = this.gl.createBuffer();

    this.uploadStaticBuffers();

    this.scratch2 = new Float32Array(2);
    this.scratch4 = new Float32Array(4);

    this.floatPrecision = ShaderUtils.getFragmentFloatPrecision(this.gl);
    this.createShader();

    Object.assign(this, createMainSamplers(this.gl));
  }

  buildPositions() {
    const { vertices, indices } = buildPlaneGeometry(this.mesh_width, this.mesh_height);
    this.vertices = vertices;
    this.indices = indices;
  }

  updateGlobals(opts) {
    this.texsizeX = opts.texsizeX;
    this.texsizeY = opts.texsizeY;
    this.mesh_width = opts.mesh_width;
    this.mesh_height = opts.mesh_height;
    this.aspectx = opts.aspectx;
    this.aspecty = opts.aspecty;
    this.invAspectx = 1.0 / this.aspectx;
    this.invAspecty = 1.0 / this.aspecty;

    this.buildPositions();
    this.uploadStaticBuffers();
  }

  // mesh geometry only changes with the mesh itself, not per frame
  uploadStaticBuffers() {
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBuf);
    this.gl.bufferData(
      this.gl.ELEMENT_ARRAY_BUFFER,
      this.indices,
      this.gl.STATIC_DRAW
    );
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionVertexBuf);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      this.vertices,
      this.gl.STATIC_DRAW
    );
  }

  createShader(shaderText = "") {
    let fragShaderText;
    let fragShaderHeaderText;
    if (shaderText.length === 0) {
      fragShaderText = "ret = texture(sampler_main, uv).rgb * decay;";
      fragShaderHeaderText = "";
    } else {
      const shaderParts = ShaderUtils.getShaderParts(shaderText);
      fragShaderHeaderText = shaderParts[0];
      fragShaderText = shaderParts[1];
    }

    fragShaderText = fragShaderText.replace(/texture2D/g, "texture");
    fragShaderText = fragShaderText.replace(/texture3D/g, "texture");

    this.userTextures = ShaderUtils.getUserSamplers(fragShaderHeaderText);

    this.shaderProgram = buildProgram(
      this.gl,
      `
      #version 300 es
      precision ${this.floatPrecision} float;
      const vec2 halfmad = vec2(0.5);
      in vec2 aPos;
      in vec2 aWarpUv;
      in vec4 aWarpColor;
      out vec2 uv;
      out vec2 uv_orig;
      out vec4 vColor;
      void main(void) {
        gl_Position = vec4(aPos, 0.0, 1.0);
        uv_orig = aPos * halfmad + halfmad;
        uv = aWarpUv;
        vColor = aWarpColor;
      }
      `.trim(),
      `
      #version 300 es
      precision ${this.floatPrecision} float;
      precision highp int;
      precision mediump sampler2D;
      precision mediump sampler3D;

      in vec2 uv;
      in vec2 uv_orig;
      in vec4 vColor;
      out vec4 fragColor;
      uniform sampler2D sampler_main;
      uniform sampler2D sampler_fw_main;
      uniform sampler2D sampler_fc_main;
      uniform sampler2D sampler_pw_main;
      uniform sampler2D sampler_pc_main;
      uniform sampler2D sampler_blur1;
      uniform sampler2D sampler_blur2;
      uniform sampler2D sampler_blur3;
      uniform sampler2D sampler_noise_lq;
      uniform sampler2D sampler_noise_lq_lite;
      uniform sampler2D sampler_noise_mq;
      uniform sampler2D sampler_noise_hq;
      uniform sampler2D sampler_pw_noise_lq;
      uniform sampler3D sampler_noisevol_lq;
      uniform sampler3D sampler_noisevol_hq;
      uniform float time;
      uniform float decay;
${COMMON_FRAG_UNIFORMS}
      float PI = ${Math.PI};

      ${fragShaderHeaderText}

      void main(void) {
        vec3 ret;
        float rad = length(uv_orig - 0.5);
        float ang = atan(uv_orig.x - 0.5, uv_orig.y - 0.5);

        ${fragShaderText}

        fragColor = vec4(ret, 1.0) * vColor;
      }
      `.trim()
    );

    assignLocations(this, this.gl, this.shaderProgram, COMMON_LOCATIONS);
    this.warpUvLocation = this.gl.getAttribLocation(
      this.shaderProgram,
      "aWarpUv"
    );
    this.warpColorLocation = this.gl.getAttribLocation(
      this.shaderProgram,
      "aWarpColor"
    );
    this.decayLoc = this.gl.getUniformLocation(this.shaderProgram, "decay");

    for (let i = 0; i < this.userTextures.length; i++) {
      const userTexture = this.userTextures[i];
      userTexture.textureLoc = this.gl.getUniformLocation(
        this.shaderProgram,
        `sampler_${userTexture.sampler}`
      );
    }
  }

  updateShader(shaderText) {
    this.gl.deleteProgram(this.shaderProgram);
    this.createShader(shaderText);
  }

  bindBlurVals(blurMins, blurMaxs) {
    const blurMin1 = blurMins[0];
    const blurMin2 = blurMins[1];
    const blurMin3 = blurMins[2];
    const blurMax1 = blurMaxs[0];
    const blurMax2 = blurMaxs[1];
    const blurMax3 = blurMaxs[2];

    const scale1 = blurMax1 - blurMin1;
    const bias1 = blurMin1;

    const scale2 = blurMax2 - blurMin2;
    const bias2 = blurMin2;

    const scale3 = blurMax3 - blurMin3;
    const bias3 = blurMin3;

    this.gl.uniform1f(this.blur1MinLoc, blurMin1);
    this.gl.uniform1f(this.blur1MaxLoc, blurMax1);
    this.gl.uniform1f(this.blur2MinLoc, blurMin2);
    this.gl.uniform1f(this.blur2MaxLoc, blurMax2);
    this.gl.uniform1f(this.blur3MinLoc, blurMin3);
    this.gl.uniform1f(this.blur3MaxLoc, blurMax3);
    this.gl.uniform1f(this.scale1Loc, scale1);
    this.gl.uniform1f(this.scale2Loc, scale2);
    this.gl.uniform1f(this.scale3Loc, scale3);
    this.gl.uniform1f(this.bias1Loc, bias1);
    this.gl.uniform1f(this.bias2Loc, bias2);
    this.gl.uniform1f(this.bias3Loc, bias3);
  }

  renderQuadTexture(
    blending,
    texture,
    blurTexture1,
    blurTexture2,
    blurTexture3,
    blurMins,
    blurMaxs,
    mdVSFrame,
    mdVSQs,
    warpUVs,
    warpColor
  ) {
    this.gl.useProgram(this.shaderProgram);

    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBuf);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionVertexBuf);

    this.gl.vertexAttribPointer(
      this.positionLocation,
      3,
      this.gl.FLOAT,
      false,
      0,
      0
    );
    this.gl.enableVertexAttribArray(this.positionLocation);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.warpUvVertexBuf);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, warpUVs, this.gl.STATIC_DRAW);

    this.gl.vertexAttribPointer(
      this.warpUvLocation,
      2,
      this.gl.FLOAT,
      false,
      0,
      0
    );
    this.gl.enableVertexAttribArray(this.warpUvLocation);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.warpColorVertexBuf);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, warpColor, this.gl.STATIC_DRAW);

    this.gl.vertexAttribPointer(
      this.warpColorLocation,
      4,
      this.gl.FLOAT,
      false,
      0,
      0
    );
    this.gl.enableVertexAttribArray(this.warpColorLocation);

    const wrapping =
      mdVSFrame.wrap !== 0 ? this.gl.REPEAT : this.gl.CLAMP_TO_EDGE;
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

    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.bindSampler(0, this.mainSampler);
    this.gl.uniform1i(this.textureLoc, 0);

    this.gl.activeTexture(this.gl.TEXTURE1);
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.bindSampler(1, this.mainSamplerFW);
    this.gl.uniform1i(this.textureFWLoc, 1);

    this.gl.activeTexture(this.gl.TEXTURE2);
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.bindSampler(2, this.mainSamplerFC);
    this.gl.uniform1i(this.textureFCLoc, 2);

    this.gl.activeTexture(this.gl.TEXTURE3);
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.bindSampler(3, this.mainSamplerPW);
    this.gl.uniform1i(this.texturePWLoc, 3);

    this.gl.activeTexture(this.gl.TEXTURE4);
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.bindSampler(4, this.mainSamplerPC);
    this.gl.uniform1i(this.texturePCLoc, 4);

    this.gl.activeTexture(this.gl.TEXTURE5);
    this.gl.bindTexture(this.gl.TEXTURE_2D, blurTexture1);
    this.gl.uniform1i(this.blurTexture1Loc, 5);

    this.gl.activeTexture(this.gl.TEXTURE6);
    this.gl.bindTexture(this.gl.TEXTURE_2D, blurTexture2);
    this.gl.uniform1i(this.blurTexture2Loc, 6);

    this.gl.activeTexture(this.gl.TEXTURE7);
    this.gl.bindTexture(this.gl.TEXTURE_2D, blurTexture3);
    this.gl.uniform1i(this.blurTexture3Loc, 7);

    this.gl.activeTexture(this.gl.TEXTURE8);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.noise.noiseTexLQ);
    this.gl.uniform1i(this.noiseLQLoc, 8);

    this.gl.activeTexture(this.gl.TEXTURE9);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.noise.noiseTexMQ);
    this.gl.uniform1i(this.noiseMQLoc, 9);

    this.gl.activeTexture(this.gl.TEXTURE10);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.noise.noiseTexHQ);
    this.gl.uniform1i(this.noiseHQLoc, 10);

    this.gl.activeTexture(this.gl.TEXTURE11);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.noise.noiseTexLQLite);
    this.gl.uniform1i(this.noiseLQLiteLoc, 11);

    this.gl.activeTexture(this.gl.TEXTURE12);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.noise.noiseTexLQ);
    this.gl.bindSampler(12, this.noise.noiseTexPointLQ);
    this.gl.uniform1i(this.noisePointLQLoc, 12);

    this.gl.activeTexture(this.gl.TEXTURE13);
    this.gl.bindTexture(this.gl.TEXTURE_3D, this.noise.noiseTexVolLQ);
    this.gl.uniform1i(this.noiseVolLQLoc, 13);

    this.gl.activeTexture(this.gl.TEXTURE14);
    this.gl.bindTexture(this.gl.TEXTURE_3D, this.noise.noiseTexVolHQ);
    this.gl.uniform1i(this.noiseVolHQLoc, 14);

    for (let i = 0; i < this.userTextures.length; i++) {
      const userTexture = this.userTextures[i];
      this.gl.activeTexture(this.gl.TEXTURE15 + i);
      this.gl.bindTexture(
        this.gl.TEXTURE_2D,
        this.image.getTexture(userTexture.sampler)
      );
      this.gl.uniform1i(userTexture.textureLoc, 15 + i);
    }

    this.gl.uniform1f(this.decayLoc, mdVSFrame.decay);
    this.gl.uniform2fv(this.resolutionLoc, fill2(this.scratch2, this.texsizeX, this.texsizeY));
    this.gl.uniform4fv(this.aspectLoc, fill4(this.scratch4, 
      this.aspectx,
      this.aspecty,
      this.invAspectx,
      this.invAspecty,
    ));
    this.gl.uniform4fv(this.texsizeLoc, fill4(this.scratch4, 
      this.texsizeX,
      this.texsizeY,
      1.0 / this.texsizeX,
      1.0 / this.texsizeY,
    ));
    this.gl.uniform4fv(this.texsizeNoiseLQLoc, fill4(this.scratch4, 256, 256, 1 / 256, 1 / 256));
    this.gl.uniform4fv(this.texsizeNoiseMQLoc, fill4(this.scratch4, 256, 256, 1 / 256, 1 / 256));
    this.gl.uniform4fv(this.texsizeNoiseHQLoc, fill4(this.scratch4, 256, 256, 1 / 256, 1 / 256));
    this.gl.uniform4fv(this.texsizeNoiseLQLiteLoc, fill4(this.scratch4, 32, 32, 1 / 32, 1 / 32));
    this.gl.uniform4fv(this.texsizeNoiseVolLQLoc, fill4(this.scratch4, 32, 32, 1 / 32, 1 / 32));
    this.gl.uniform4fv(this.texsizeNoiseVolHQLoc, fill4(this.scratch4, 32, 32, 1 / 32, 1 / 32));

    this.gl.uniform1f(this.bassLoc, mdVSFrame.bass);
    this.gl.uniform1f(this.midLoc, mdVSFrame.mid);
    this.gl.uniform1f(this.trebLoc, mdVSFrame.treb);
    this.gl.uniform1f(
      this.volLoc,
      (mdVSFrame.bass + mdVSFrame.mid + mdVSFrame.treb) / 3
    );
    this.gl.uniform1f(this.bassAttLoc, mdVSFrame.bass_att);
    this.gl.uniform1f(this.midAttLoc, mdVSFrame.mid_att);
    this.gl.uniform1f(this.trebAttLoc, mdVSFrame.treb_att);
    this.gl.uniform1f(
      this.volAttLoc,
      (mdVSFrame.bass_att + mdVSFrame.mid_att + mdVSFrame.treb_att) / 3
    );
    this.gl.uniform1f(this.timeLoc, mdVSFrame.time);
    this.gl.uniform1f(this.frameLoc, mdVSFrame.frame);
    this.gl.uniform1f(this.fpsLoc, mdVSFrame.fps);
    this.gl.uniform4fv(this.randPresetLoc, mdVSFrame.rand_preset);
    this.gl.uniform4fv(this.randFrameLoc, fill4(this.scratch4, 
        this.rng.random(),
        this.rng.random(),
        this.rng.random(),
        this.rng.random(),
      ));

    this.gl.uniform4fv(this.qaLoc, fill4(this.scratch4, 
        mdVSQs.q1 || 0,
        mdVSQs.q2 || 0,
        mdVSQs.q3 || 0,
        mdVSQs.q4 || 0,
      ));
    this.gl.uniform4fv(this.qbLoc, fill4(this.scratch4, 
        mdVSQs.q5 || 0,
        mdVSQs.q6 || 0,
        mdVSQs.q7 || 0,
        mdVSQs.q8 || 0,
      ));
    this.gl.uniform4fv(this.qcLoc, fill4(this.scratch4, 
        mdVSQs.q9 || 0,
        mdVSQs.q10 || 0,
        mdVSQs.q11 || 0,
        mdVSQs.q12 || 0,
      ));
    this.gl.uniform4fv(this.qdLoc, fill4(this.scratch4, 
        mdVSQs.q13 || 0,
        mdVSQs.q14 || 0,
        mdVSQs.q15 || 0,
        mdVSQs.q16 || 0,
      ));
    this.gl.uniform4fv(this.qeLoc, fill4(this.scratch4, 
        mdVSQs.q17 || 0,
        mdVSQs.q18 || 0,
        mdVSQs.q19 || 0,
        mdVSQs.q20 || 0,
      ));
    this.gl.uniform4fv(this.qfLoc, fill4(this.scratch4, 
        mdVSQs.q21 || 0,
        mdVSQs.q22 || 0,
        mdVSQs.q23 || 0,
        mdVSQs.q24 || 0,
      ));
    this.gl.uniform4fv(this.qgLoc, fill4(this.scratch4, 
        mdVSQs.q25 || 0,
        mdVSQs.q26 || 0,
        mdVSQs.q27 || 0,
        mdVSQs.q28 || 0,
      ));
    this.gl.uniform4fv(this.qhLoc, fill4(this.scratch4, 
        mdVSQs.q29 || 0,
        mdVSQs.q30 || 0,
        mdVSQs.q31 || 0,
        mdVSQs.q32 || 0,
      ));
    this.gl.uniform4fv(this.slowRoamCosLoc, fill4(this.scratch4, 
      0.5 + 0.5 * Math.cos(mdVSFrame.time * 0.005),
      0.5 + 0.5 * Math.cos(mdVSFrame.time * 0.008),
      0.5 + 0.5 * Math.cos(mdVSFrame.time * 0.013),
      0.5 + 0.5 * Math.cos(mdVSFrame.time * 0.022),
    ));
    this.gl.uniform4fv(this.roamCosLoc, fill4(this.scratch4, 
      0.5 + 0.5 * Math.cos(mdVSFrame.time * 0.3),
      0.5 + 0.5 * Math.cos(mdVSFrame.time * 1.3),
      0.5 + 0.5 * Math.cos(mdVSFrame.time * 5.0),
      0.5 + 0.5 * Math.cos(mdVSFrame.time * 20.0),
    ));
    this.gl.uniform4fv(this.slowRoamSinLoc, fill4(this.scratch4, 
      0.5 + 0.5 * Math.sin(mdVSFrame.time * 0.005),
      0.5 + 0.5 * Math.sin(mdVSFrame.time * 0.008),
      0.5 + 0.5 * Math.sin(mdVSFrame.time * 0.013),
      0.5 + 0.5 * Math.sin(mdVSFrame.time * 0.022),
    ));
    this.gl.uniform4fv(this.roamSinLoc, fill4(this.scratch4, 
      0.5 + 0.5 * Math.sin(mdVSFrame.time * 0.3),
      0.5 + 0.5 * Math.sin(mdVSFrame.time * 1.3),
      0.5 + 0.5 * Math.sin(mdVSFrame.time * 5.0),
      0.5 + 0.5 * Math.sin(mdVSFrame.time * 20.0),
    ));

    this.bindBlurVals(blurMins, blurMaxs);

    if (blending) {
      this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
    } else {
      this.gl.disable(this.gl.BLEND);
    }

    this.gl.drawElements(
      this.gl.TRIANGLES,
      this.indices.length,
      this.gl.UNSIGNED_SHORT,
      0
    );

    if (!blending) {
      this.gl.enable(this.gl.BLEND);
    }
  }
}
