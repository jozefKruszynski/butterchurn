import asc from "assemblyscript/asc";
import { createFilter } from '@rollup/pluginutils';

function assemblyscriptPlugin(options = {}) {
  const filter = createFilter(options.include || /\.ts$/, options.exclude);

  return {
    name: 'assemblyscript',

    async transform(code, id) {
      if (!filter(id)) {
        return null;
      }

      // "stub" runtime: no GC, so pointers handed to JS stay valid, matching
      // the old runtime "none" semantics; exportRuntime keeps the loader's
      // array-view helpers working
      const { error, binary, stderr } = await asc.compileString(code, {
        optimize: true,
        optimizeLevel: 3,
        runtime: "stub",
        exportRuntime: true,
        pedantic: true,
      });

      if (error) {
        this.error(stderr.toString());
        return;
      }

      const output = `
var data = "${Buffer.from(binary).toString("base64")}";
export default () => data;
`;

      return {
        code: output,
        map: null
      };
    }
  };
}

export default assemblyscriptPlugin;
