const lineMatcher = /uniform sampler2D sampler_(?:.+?);/g;
const samplerMatcher = /uniform sampler2D sampler_(.+?);/;


// uniform*fv copies at call time, so one shared scratch per instance is safe
export function fill2(arr, a, b) {
  arr[0] = a;
  arr[1] = b;
  return arr;
}

export function fill4(arr, a, b, c, d) {
  arr[0] = a;
  arr[1] = b;
  arr[2] = c;
  arr[3] = d;
  return arr;
}

// thick outlines draw 4 instances offset by up to one 2px texel step
export function fillThickOffset(arr, instance, texsizeX, texsizeY) {
  arr[0] = instance % 2 === 1 ? 2 / texsizeX : 0;
  arr[1] = instance >= 2 ? 2 / texsizeY : 0;
  return arr;
}

// compiles, links, and cleans up a program; failures finally get logged
export function buildProgram(gl, vertSrc, fragSrc) {
  const program = gl.createProgram();

  const vertShader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertShader, vertSrc);
  gl.compileShader(vertShader);

  const fragShader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fragShader, fragSrc);
  gl.compileShader(fragShader);

  gl.attachShader(program, vertShader);
  gl.attachShader(program, fragShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(
      "[butterchurn] shader link failed:",
      gl.getProgramInfoLog(program),
      gl.getShaderInfoLog(vertShader),
      gl.getShaderInfoLog(fragShader)
    );
  }

  // flagged for deletion now, freed with the program
  gl.deleteShader(vertShader);
  gl.deleteShader(fragShader);

  return program;
}

export default class ShaderUtils {
  static getShaderParts(t) {
    const sbIndex = t.indexOf("shader_body");
    if (t && sbIndex > -1) {
      const beforeShaderBody = t.substring(0, sbIndex);
      const afterShaderBody = t.substring(sbIndex);
      const firstCurly = afterShaderBody.indexOf("{");
      const lastCurly = afterShaderBody.lastIndexOf("}");
      const shaderBody = afterShaderBody.substring(firstCurly + 1, lastCurly);
      return [beforeShaderBody, shaderBody];
    }

    return ["", t];
  }

  static getFragmentFloatPrecision(gl) {
    if (
      gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT).precision >
      0
    ) {
      return "highp";
    } else if (
      gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.MEDIUM_FLOAT)
        .precision > 0
    ) {
      return "mediump";
    }
    return "lowp";
  }

  static getUserSamplers(text) {
    const samplers = [];
    const lineMatches = text.match(lineMatcher);
    if (lineMatches && lineMatches.length > 0) {
      for (let i = 0; i < lineMatches.length; i++) {
        const samplerMatches = lineMatches[i].match(samplerMatcher);
        if (samplerMatches && samplerMatches.length > 0) {
          const sampler = samplerMatches[1];
          samplers.push({ sampler });
        }
      }
    }
    return samplers;
  }
}
