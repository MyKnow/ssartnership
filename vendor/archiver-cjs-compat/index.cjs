/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";

const { PassThrough } = require("node:stream");
const archiverCore = require("archiver-core");

function archiver(format, options) {
  // ExcelJS 4.x uses readable-stream while archiver 8 checks native Node
  // streams. Bridge those streams without changing the ExcelJS API.
  const archive = createArchive(format, options);
  const append = archive.append.bind(archive);
  archive.append = (source, entry) => {
    if (!Buffer.isBuffer(source) && source && typeof source.pipe === "function") {
      const bridge = new PassThrough();
      source.pipe(bridge);
      return append(bridge, entry);
    }
    return append(source, entry);
  };
  return archive;
}

function createArchive(format, options) {
  if (format === "zip") {
    return new archiverCore.ZipArchive(options);
  }
  if (format === "tar") {
    return new archiverCore.TarArchive(options);
  }
  if (format === "json") {
    return new archiverCore.JsonArchive(options);
  }
  throw new Error(`Unsupported archive format: ${format}`);
}

module.exports = Object.assign(archiver, archiverCore);
