import "ecma-proposal-math-extensions";
import "./presetBase";
import Visualizer from "./visualizer";

export default class Butterchurn {
  // consumers pick the engine tint path before creating a context
  static supportsEngineTint = true;
  static supportsPaletteColors = true;
  static supportsPaletteRamp = true;

  static createVisualizer(context, canvas, opts) {
    return new Visualizer(context, canvas, opts);
  }
}
