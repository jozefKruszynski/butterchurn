# Butterchurn

Butterchurn is a WebGL implementation of the Milkdrop Visualizer


## [Try it out](https://butterchurnviz.com)

[![Butterchurn Screenshot](preview.png)](https://butterchurnviz.com)

## Usage

### Installation

With [pnpm](https://pnpm.io/), [yarn](https://yarnpkg.com/) or [npm](https://npmjs.org/) installed, run

    $ pnpm add butterchurn butterchurn-presets
    or
    $ yarn add butterchurn butterchurn-presets
    or
    $ npm install butterchurn butterchurn-presets

### Create a visualizer

```JavaScript
import butterchurn from 'butterchurn';
import butterchurnPresets from 'butterchurn-presets';

// initialize audioContext and get canvas

const visualizer = butterchurn.createVisualizer(audioContext, canvas, {
  width: 800,
  height: 600
});

// get audioNode from audio source or microphone

visualizer.connectAudio(audioNode);

// load a preset

const presets = butterchurnPresets.getPresets();
const preset = presets['Flexi, martin + geiss - dedicated to the sherwin maxawow'];

visualizer.loadPreset(preset, 0.0); // 2nd argument is the number of seconds to blend presets

// resize visualizer

visualizer.setRendererSize(1600, 1200);

// render a frame

visualizer.render();
```

### Artwork recoloring

Two independent ways to recolor a preset from a host-supplied palette, both inert until you call
them. Colors are `[r, g, b]` triples in the 0 to 255 range, and passing `null` fades the effect
back out.

```JavaScript
// remap the whole image through a dark-to-light ramp
visualizer.setPaletteRamp([[16, 12, 40], [166, 52, 92], [252, 220, 176]], 1);

// recolor the preset's own waveform, borders and motion vectors
visualizer.setPaletteColors([[16, 12, 40], [166, 52, 92], [252, 220, 176]]);
```

`setPaletteRamp(colors, strength)` runs on the final blit. Each pixel's luminance indexes the
ramp, and only hue and saturation change, so the preset's structure and motion survive intact.

`setPaletteColors(colors, strength)` blends the preset's own frame-level color scalars instead.
Those are drawn into the feedback texture, so unlike the ramp they also change how the preset
evolves and not only how it looks.

Both accept a palette of any length: shorter ones repeat their last color, longer ones are
resampled evenly across the available slots. `strength` runs from 0 to 1 and defaults to 1.
Changes ease in over 1.5 seconds, which `colorTransitionMs` on `createVisualizer` overrides;
pass 0 to apply them instantly.

Recoloring composes with `setTint(rgb)`, which shifts the whole image towards a single color.

Older builds lack these calls, so feature-detect before using them:

```JavaScript
if (butterchurn.supportsPaletteRamp) {
  // butterchurn.maxPaletteRampColors is how many ramp anchors are interpolated
}
```

### Browser Support

Butterchurn requires the [browser support WebGL 2](https://caniuse.com/#feat=webgl2).

You can test for support using our minimal isSupported script:

```Javacript
import isButterchurnSupported from "butterchurn/lib/isSupported.min";

if (isButterchurnSupported()) {
  // Load and use butterchurn
}
```

## Integrations
* [Webamp](https://github.com/captbaritone/webamp), the fantastic reimplementation of Winamp 2.9 in HTML5 and Javascript, built by [captbaritone](https://github.com/captbaritone)
* [Butterchurn Extension](https://chrome.google.com/webstore/detail/butterchurn-music-visuali/jfdmelgfepjcmlljpdeajbiiibkehnih), use Butterchurn to visualize the audio from any page
* [Rekt Networks](https://nightride.fm/#Mathdrop), Live DJs, Archives & Exclusive Releases, built by [Zei](https://twitter.com/TheRektNetwork)
* [mStream](http://mstream.io/), your personal music streaming server, built by [IrosTheBeggar](https://github.com/IrosTheBeggar)
* [pasteur](https://www.pasteur.cc/), trippy videos generated from your music, built by [markneub](https://github.com/markneub)
* [ChromeAudioVisualizerExtension](https://chrome.google.com/webstore/detail/audiovisualizer/bojhikphaecldnbdekplmadjkflgbkfh), put on some music and turn your browsing session into a party! built by [afreakk](https://github.com/afreakk)
* [Karaoke Forever](https://www.karaoke-forever.com), an open karaoke party system, built by [bhj](https://github.com/bhj)
* [Syqel](https://syqel.com/), the World's Best AI Powered Music Visualizer


## Thanks

* [Ryan Geiss](http://www.geisswerks.com/) for creating [MilkDrop](http://www.geisswerks.com/about_milkdrop.html)
* Nullsoft for creating [Winamp](http://www.winamp.com/)
* All the amazing preset creators, special thanks to [Flexi](https://twitter.com/Flexi23)


## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details
