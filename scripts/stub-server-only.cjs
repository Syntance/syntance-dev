/* eslint-disable @typescript-eslint/no-require-imports */
/** Wspólny stub server-only dla skryptów CLI (tsx nie przechodzi przez bundler Next). */
const Module = require("node:module");
const origLoad = Module._load;
Module._load = function (request) {
  if (request === "server-only") return {};
  return origLoad.apply(this, arguments);
};
