const isSupported = () => {
  const canvas = document.createElement("canvas");
  let gl;
  try {
    gl = canvas.getContext("webgl2");
  } catch {
    gl = null;
  }

  const webGL2Supported = !!gl;
  // release the probe context; browsers cap live WebGL contexts and evict the oldest
  gl?.getExtension("WEBGL_lose_context")?.loseContext();
  const audioApiSupported = !!(
    window.AudioContext || window.webkitAudioContext
  );

  return webGL2Supported && audioApiSupported;
};

export default isSupported;
