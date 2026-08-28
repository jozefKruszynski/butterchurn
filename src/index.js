import "ecma-proposal-math-extensions";
import "./presetBase";
import Visualizer from "./visualizer";
import { PALETTE_RAMP_SIZE } from "./rendering/shaders/output";

export default class Butterchurn {
  // consumers pick the engine tint path before creating a context
  static supportsEngineTint = true;
  static supportsPaletteColors = true;
  static supportsPaletteRamp = true;
  // the ramp interpolates between at most this many anchors; a longer palette
  // is resampled down rather than rejected
  static maxPaletteRampColors = PALETTE_RAMP_SIZE;

  static createVisualizer(context, canvas, opts) {
    return new Visualizer(context, canvas, opts);
  }
}
