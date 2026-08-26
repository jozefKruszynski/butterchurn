// Shared pieces of the warp and comp shader classes; they are twins by
// construction and every lockstep edit belongs here instead.

// based on https://github.com/mrdoob/three.js/blob/master/src/geometries/PlaneGeometry.js
export function buildPlaneGeometry(gridX, gridY) {
  const width = 2;
  const height = 2;

  const widthHalf = width / 2;
  const heightHalf = height / 2;

  const gridX1 = gridX + 1;
  const gridY1 = gridY + 1;

  const segmentWidth = width / gridX;
  const segmentHeight = height / gridY;

  const vertices = [];
  for (let iy = 0; iy < gridY1; iy++) {
    const y = iy * segmentHeight - heightHalf;
    for (let ix = 0; ix < gridX1; ix++) {
      const x = ix * segmentWidth - widthHalf;
      vertices.push(x, -y, 0);
    }
  }

  const indices = [];
  for (let iy = 0; iy < gridY; iy++) {
    for (let ix = 0; ix < gridX; ix++) {
      const a = ix + gridX1 * iy;
      const b = ix + gridX1 * (iy + 1);
      const c = ix + 1 + gridX1 * (iy + 1);
      const d = ix + 1 + gridX1 * iy;

      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  return {
    vertices: new Float32Array(vertices),
    indices: new Uint16Array(indices),
  };
}

export function createMainSamplers(gl) {
  const mainSampler = gl.createSampler();
  const mainSamplerFW = gl.createSampler();
  const mainSamplerFC = gl.createSampler();
  const mainSamplerPW = gl.createSampler();
  const mainSamplerPC = gl.createSampler();

  gl.samplerParameteri(
    mainSampler,
    gl.TEXTURE_MIN_FILTER,
    gl.LINEAR_MIPMAP_LINEAR
  );
  gl.samplerParameteri(mainSampler, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.samplerParameteri(mainSampler, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.samplerParameteri(mainSampler, gl.TEXTURE_WRAP_T, gl.REPEAT);

  gl.samplerParameteri(
    mainSamplerFW,
    gl.TEXTURE_MIN_FILTER,
    gl.LINEAR_MIPMAP_LINEAR
  );
  gl.samplerParameteri(mainSamplerFW, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.samplerParameteri(mainSamplerFW, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.samplerParameteri(mainSamplerFW, gl.TEXTURE_WRAP_T, gl.REPEAT);

  gl.samplerParameteri(
    mainSamplerFC,
    gl.TEXTURE_MIN_FILTER,
    gl.LINEAR_MIPMAP_LINEAR
  );
  gl.samplerParameteri(mainSamplerFC, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.samplerParameteri(
    mainSamplerFC,
    gl.TEXTURE_WRAP_S,
    gl.CLAMP_TO_EDGE
  );
  gl.samplerParameteri(
    mainSamplerFC,
    gl.TEXTURE_WRAP_T,
    gl.CLAMP_TO_EDGE
  );

  gl.samplerParameteri(
    mainSamplerPW,
    gl.TEXTURE_MIN_FILTER,
    gl.NEAREST_MIPMAP_NEAREST
  );
  gl.samplerParameteri(mainSamplerPW, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.samplerParameteri(mainSamplerPW, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.samplerParameteri(mainSamplerPW, gl.TEXTURE_WRAP_T, gl.REPEAT);

  gl.samplerParameteri(
    mainSamplerPC,
    gl.TEXTURE_MIN_FILTER,
    gl.NEAREST_MIPMAP_NEAREST
  );
  gl.samplerParameteri(mainSamplerPC, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.samplerParameteri(
    mainSamplerPC,
    gl.TEXTURE_WRAP_S,
    gl.CLAMP_TO_EDGE
  );
  gl.samplerParameteri(
    mainSamplerPC,
    gl.TEXTURE_WRAP_T,
    gl.CLAMP_TO_EDGE
  );
  return {
    mainSampler,
    mainSamplerFW,
    mainSamplerFC,
    mainSamplerPW,
    mainSamplerPC,
  };
}

// the 62 attribute/uniform locations the twin shaders share
export const COMMON_LOCATIONS = [
  ["positionLocation", "attrib", "aPos"],
  ["textureLoc", "uniform", "sampler_main"],
  ["textureFWLoc", "uniform", "sampler_fw_main"],
  ["textureFCLoc", "uniform", "sampler_fc_main"],
  ["texturePWLoc", "uniform", "sampler_pw_main"],
  ["texturePCLoc", "uniform", "sampler_pc_main"],
  ["blurTexture1Loc", "uniform", "sampler_blur1"],
  ["blurTexture2Loc", "uniform", "sampler_blur2"],
  ["blurTexture3Loc", "uniform", "sampler_blur3"],
  ["noiseLQLoc", "uniform", "sampler_noise_lq"],
  ["noiseMQLoc", "uniform", "sampler_noise_mq"],
  ["noiseHQLoc", "uniform", "sampler_noise_hq"],
  ["noiseLQLiteLoc", "uniform", "sampler_noise_lq_lite"],
  ["noisePointLQLoc", "uniform", "sampler_pw_noise_lq"],
  ["noiseVolLQLoc", "uniform", "sampler_noisevol_lq"],
  ["noiseVolHQLoc", "uniform", "sampler_noisevol_hq"],
  ["texsizeLoc", "uniform", "texsize"],
  ["texsizeNoiseLQLoc", "uniform", "texsize_noise_lq"],
  ["texsizeNoiseMQLoc", "uniform", "texsize_noise_mq"],
  ["texsizeNoiseHQLoc", "uniform", "texsize_noise_hq"],
  ["texsizeNoiseLQLiteLoc", "uniform", "texsize_noise_lq_lite"],
  ["texsizeNoiseVolLQLoc", "uniform", "texsize_noisevol_lq"],
  ["texsizeNoiseVolHQLoc", "uniform", "texsize_noisevol_hq"],
  ["resolutionLoc", "uniform", "resolution"],
  ["aspectLoc", "uniform", "aspect"],
  ["bassLoc", "uniform", "bass"],
  ["midLoc", "uniform", "mid"],
  ["trebLoc", "uniform", "treb"],
  ["volLoc", "uniform", "vol"],
  ["bassAttLoc", "uniform", "bass_att"],
  ["midAttLoc", "uniform", "mid_att"],
  ["trebAttLoc", "uniform", "treb_att"],
  ["volAttLoc", "uniform", "vol_att"],
  ["timeLoc", "uniform", "time"],
  ["frameLoc", "uniform", "frame"],
  ["fpsLoc", "uniform", "fps"],
  ["blur1MinLoc", "uniform", "blur1_min"],
  ["blur1MaxLoc", "uniform", "blur1_max"],
  ["blur2MinLoc", "uniform", "blur2_min"],
  ["blur2MaxLoc", "uniform", "blur2_max"],
  ["blur3MinLoc", "uniform", "blur3_min"],
  ["blur3MaxLoc", "uniform", "blur3_max"],
  ["scale1Loc", "uniform", "scale1"],
  ["scale2Loc", "uniform", "scale2"],
  ["scale3Loc", "uniform", "scale3"],
  ["bias1Loc", "uniform", "bias1"],
  ["bias2Loc", "uniform", "bias2"],
  ["bias3Loc", "uniform", "bias3"],
  ["randPresetLoc", "uniform", "rand_preset"],
  ["randFrameLoc", "uniform", "rand_frame"],
  ["qaLoc", "uniform", "_qa"],
  ["qbLoc", "uniform", "_qb"],
  ["qcLoc", "uniform", "_qc"],
  ["qdLoc", "uniform", "_qd"],
  ["qeLoc", "uniform", "_qe"],
  ["qfLoc", "uniform", "_qf"],
  ["qgLoc", "uniform", "_qg"],
  ["qhLoc", "uniform", "_qh"],
  ["slowRoamCosLoc", "uniform", "slow_roam_cos"],
  ["roamCosLoc", "uniform", "roam_cos"],
  ["slowRoamSinLoc", "uniform", "slow_roam_sin"],
  ["roamSinLoc", "uniform", "roam_sin"],
];

export function assignLocations(target, gl, program, locationEntries) {
  for (const [prop, kind, name] of locationEntries) {
    target[prop] =
      kind === "attrib"
        ? gl.getAttribLocation(program, name)
        : gl.getUniformLocation(program, name);
  }
}

// uniform/define block shared verbatim by the twin fragment shaders
// prettier-ignore
export const COMMON_FRAG_UNIFORMS = `      uniform vec2 resolution;
      uniform vec4 aspect;
      uniform vec4 texsize;
      uniform vec4 texsize_noise_lq;
      uniform vec4 texsize_noise_mq;
      uniform vec4 texsize_noise_hq;
      uniform vec4 texsize_noise_lq_lite;
      uniform vec4 texsize_noisevol_lq;
      uniform vec4 texsize_noisevol_hq;

      uniform float bass;
      uniform float mid;
      uniform float treb;
      uniform float vol;
      uniform float bass_att;
      uniform float mid_att;
      uniform float treb_att;
      uniform float vol_att;

      uniform float frame;
      uniform float fps;

      uniform vec4 _qa;
      uniform vec4 _qb;
      uniform vec4 _qc;
      uniform vec4 _qd;
      uniform vec4 _qe;
      uniform vec4 _qf;
      uniform vec4 _qg;
      uniform vec4 _qh;

      #define q1 _qa.x
      #define q2 _qa.y
      #define q3 _qa.z
      #define q4 _qa.w
      #define q5 _qb.x
      #define q6 _qb.y
      #define q7 _qb.z
      #define q8 _qb.w
      #define q9 _qc.x
      #define q10 _qc.y
      #define q11 _qc.z
      #define q12 _qc.w
      #define q13 _qd.x
      #define q14 _qd.y
      #define q15 _qd.z
      #define q16 _qd.w
      #define q17 _qe.x
      #define q18 _qe.y
      #define q19 _qe.z
      #define q20 _qe.w
      #define q21 _qf.x
      #define q22 _qf.y
      #define q23 _qf.z
      #define q24 _qf.w
      #define q25 _qg.x
      #define q26 _qg.y
      #define q27 _qg.z
      #define q28 _qg.w
      #define q29 _qh.x
      #define q30 _qh.y
      #define q31 _qh.z
      #define q32 _qh.w

      uniform vec4 slow_roam_cos;
      uniform vec4 roam_cos;
      uniform vec4 slow_roam_sin;
      uniform vec4 roam_sin;

      uniform float blur1_min;
      uniform float blur1_max;
      uniform float blur2_min;
      uniform float blur2_max;
      uniform float blur3_min;
      uniform float blur3_max;

      uniform float scale1;
      uniform float scale2;
      uniform float scale3;
      uniform float bias1;
      uniform float bias2;
      uniform float bias3;

      uniform vec4 rand_frame;
      uniform vec4 rand_preset;
`;
