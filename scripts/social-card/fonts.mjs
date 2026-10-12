// Finds the Ubuntu fonts the site already downloads, in Astro's font cache
// (`node_modules/.astro/fonts`, filled by `pnpm build` or `pnpm dev`). The cache names a file by a
// hash, so each file is identified by the family and style recorded in its own `name` table
// (WOFF2 stores that table uncompressed apart from Brotli, which Node ships).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

// WOFF2 "known table tags" that matter here, by index (https://www.w3.org/TR/WOFF2/#table_dir_format).
const TAG_NAME = 5;
const TAG_GLYF = 10;
const TAG_LOCA = 11;

function readBase128(buffer, offset) {
  let value = 0;
  for (let i = 0; i < 5; i++) {
    const byte = buffer[offset + i];
    value = value * 128 + (byte & 0x7f);
    if ((byte & 0x80) === 0) return { value, next: offset + i + 1 };
  }
  throw new Error('Invalid WOFF2 UIntBase128.');
}

/** The `name` table records of a WOFF2 file, as `{ id: text }` (Windows platform, UTF-16BE). */
function nameRecords(buffer) {
  if (buffer.toString('latin1', 0, 4) !== 'wOF2') {
    throw new Error('Not a WOFF2 file.');
  }
  const tableCount = buffer.readUInt16BE(12);
  const compressedSize = buffer.readUInt32BE(20);
  let offset = 48;
  let nameOffset = 0;
  let nameLength = 0;
  let streamOffset = 0;
  for (let i = 0; i < tableCount; i++) {
    const flags = buffer[offset++];
    const tagIndex = flags & 0x3f;
    const version = flags >> 6;
    if (tagIndex === 63) offset += 4;
    const original = readBase128(buffer, offset);
    offset = original.next;
    const transformed =
      tagIndex === TAG_GLYF || tagIndex === TAG_LOCA
        ? version !== 3
        : version !== 0;
    let length = original.value;
    if (transformed) {
      const transform = readBase128(buffer, offset);
      offset = transform.next;
      length = transform.value;
    }
    if (tagIndex === TAG_NAME) {
      nameOffset = streamOffset;
      nameLength = length;
    }
    streamOffset += length;
  }
  const stream = zlib.brotliDecompressSync(
    buffer.subarray(offset, offset + compressedSize),
  );
  const table = stream.subarray(nameOffset, nameOffset + nameLength);
  const count = table.readUInt16BE(2);
  const strings = table.readUInt16BE(4);
  const records = {};
  for (let i = 0; i < count; i++) {
    const at = 6 + i * 12;
    if (table.readUInt16BE(at) !== 3) continue;
    const id = table.readUInt16BE(at + 6);
    const length = table.readUInt16BE(at + 8);
    const start = strings + table.readUInt16BE(at + 10);
    records[id] = Buffer.from(table.subarray(start, start + length))
      .swap16()
      .toString('utf16le');
  }
  return records;
}

/**
 * The cached WOFF2 files by their full font name (name ID 4, e.g. "Ubuntu Bold",
 * "Ubuntu Mono"), as `{ name: absolute path }`.
 */
export function cachedFonts(repoRoot) {
  const dir = path.join(repoRoot, 'node_modules', '.astro', 'fonts');
  if (!fs.existsSync(dir)) {
    throw new Error(
      `No font cache at ${dir}. Run "pnpm build" once so Astro downloads the fonts.`,
    );
  }
  const fonts = {};
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.woff2')) continue;
    const full = path.join(dir, file);
    fonts[nameRecords(fs.readFileSync(full))[4]] = full;
  }
  return fonts;
}
