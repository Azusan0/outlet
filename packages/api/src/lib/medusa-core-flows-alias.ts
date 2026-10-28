const ModuleLoader = require("node:module") as {
  _resolveFilename: (
    request: string,
    parent: unknown,
    isMain: boolean,
    options?: unknown
  ) => string;
};

const originalResolveFilename = ModuleLoader._resolveFilename;
const canonicalCoreFlows = require.resolve("@medusajs/core-flows");

ModuleLoader._resolveFilename = function (
  request: string,
  parent: unknown,
  isMain: boolean,
  options?: unknown
) {
  if (
    request === "@medusajs/core-flows" ||
    request === "@medusajs/medusa/core-flows"
  ) {
    request = canonicalCoreFlows;
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};
