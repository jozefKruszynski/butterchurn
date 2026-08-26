export const Q_KEYS = [...Array(32)].map((_, i) => `q${i + 1}`);
export const T_KEYS = [...Array(8)].map((_, i) => `t${i + 1}`);
export const REG_KEYS = [...Array(100)].map(
  (_, i) => `reg${String(i).padStart(2, "0")}`
);

export default class Utils {
  static atan2(x, y) {
    let a = Math.atan2(x, y);
    if (a < 0) {
      a += 2 * Math.PI;
    }
    return a;
  }

  static cloneVars(vars) {
    return Object.assign({}, vars);
  }

  static range(start, end) {
    if (end === undefined) {
      return [...Array(start).keys()];
    }

    return Array.from({ length: end - start }, (_, i) => i + start);
  }

  static pick(obj, keys) {
    const newObj = {};
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      newObj[key] = obj[key] || 0;
    }
    return newObj;
  }

  static omit(obj, keys) {
    const newObj = Object.assign({}, obj);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      delete newObj[key];
    }
    return newObj;
  }

  static setWasm(wasmGlobals, obj, keys) {
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
       
      wasmGlobals[key].value = obj[key];
    }
  }

  static pickWasm(wasmGlobals, keys) {
    const newObj = {};
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      newObj[key] = wasmGlobals[key].value;
    }
    return newObj;
  }
}
