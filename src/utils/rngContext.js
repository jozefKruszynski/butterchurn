import { createRNGContext, createDefaultRNGContext } from './seededRandom';

let globalRNG = null;
let originalRand = null;
let originalRandint = null;
let originalMathRandom = null;
// window.rand may not pre-exist; then cleanup must delete our override, not restore
let randOverridden = false;

function restoreGlobals() {
  if (randOverridden) {
    if (originalRand) {
      window.rand = originalRand;
      window.randint = originalRandint;
    } else {
      delete window.rand;
      delete window.randint;
    }
    originalRand = null;
    originalRandint = null;
    randOverridden = false;
  }

  if (originalMathRandom) {
    Math.random = originalMathRandom;
    originalMathRandom = null;
  }
}

export function initializeRNG(opts = {}) {
  if (opts.deterministic || opts.testMode) {
    globalRNG = createRNGContext(opts.seed || 12345);

    if (!randOverridden) {
      originalRand = window.rand || null;
      originalRandint = window.randint || null;
      randOverridden = true;
    }
    if (!originalMathRandom) {
      originalMathRandom = Math.random;
    }

    // Override globals with our RNG
    window.rand = (x) => globalRNG.rand(x);
    window.randint = (x) => globalRNG.randint(x);
    Math.random = () => globalRNG.random();
  } else {
    globalRNG = createDefaultRNGContext();
    // a later normal instance must not inherit a prior deterministic one's globals
    restoreGlobals();
  }

  return globalRNG;
}

export function getRNG() {
  if (!globalRNG) {
    globalRNG = createDefaultRNGContext();
  }
  return globalRNG;
}

export function cleanup() {
  restoreGlobals();
  globalRNG = null;
}
