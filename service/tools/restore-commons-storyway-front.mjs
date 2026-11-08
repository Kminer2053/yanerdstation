// Restore the right-hand central StoryWay photograph on its observed two triangles.
// The source U interval is one image wide, shifted by -1/16384 at the repeat seam.
// The shared atlas already has this image. Keep every unrelated byte of it intact.
// Usage from the service: node tools/restore-commons-storyway-front.mjs
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const sourceTile = 'B_1_22_15.bin';
const sourceDigest = '14d0784c7d2a90deccd595711b0287bdf11f4bb5fc9316335f919ae8d8664461';
const leftDetailId = '8c1fcc1bf1d5b41b4f69d389';
const rightDetailId = '05276e2b292ec548f517e3aa';
// F02WL058-S01, TD b00540045882300332204042300, mesh 2, primitive 0,
// source triangles 0 and 1, image I003. Coordinates are the builder's 1mm ENU grid.
// UVs are the source corners after removing the tiny repeat offset, in Three order.
const front = [
 {point: [-12.289, 0.048, 28.251], uv: [1, 0]},
 {point: [-12.289, 3.72, 28.251], uv: [1, 1]},
 {point: [-6.488, 3.72, 28.162], uv: [0, 1]},
 {point: [-6.488, 0.048, 28.162], uv: [0, 0]},
];
const roundUV = value => Math.round(value * 1e6) / 1e6;

export function restoreStorywayFront(manifest, binary, atlas) {
 const source = manifest.source.tiles.find(tile => tile.tile === sourceTile);
 const wall = manifest.groups.find(group => group.name === '2F:walls');
 const leftDetail = manifest.detailPages.find(page => page.id === leftDetailId);
 const detail = manifest.detailPages.find(page => page.id === rightDetailId);
 const part = detail?.parts.find(part => part.group === wall?.name);
 if (source?.sha256 !== sourceDigest || !wall || !leftDetail || !part) {
  throw Error('The verified F02WL058 source tile or photograph has changed. Review its front before rebuilding.');
 }

 const index = offset => binary.readUInt32LE(wall.indices.byteOffset + offset * 4);
 const corners = new Map();
 for (let vertex = 0; vertex < wall.vertexCount; vertex++) {
  const offset = wall.positions.byteOffset + vertex * 12;
  const corner = front.findIndex(({point}) => point.every((value, axis) =>
   Math.abs(binary.readFloatLE(offset + axis * 4) - value) < 0.00001));
  if (corner >= 0) corners.set(vertex, corner);
 }
 const triangles = new Map();
 const vertices = new Map();
 for (let offset = 0; offset < wall.indices.count; offset += 3) {
  const ids = [index(offset), index(offset + 1), index(offset + 2)];
  const signature = ids.map(id => corners.get(id)).sort().join(',');
  if (signature !== '0,1,2' && signature !== '0,2,3') continue;
  if (triangles.has(signature)) throw Error('More than one F02WL058 front triangle matches the source.');
  triangles.set(signature, offset);
  for (const id of ids) vertices.set(id, corners.get(id));
 }
 if (triangles.size !== 2 || vertices.size !== 4) throw Error('The two observed F02WL058 front triangles were not found.');
 const offsets = new Set(triangles.values());
 for (let i = 0; i < wall.indices.count; i++) {
  if (vertices.has(index(i)) && !offsets.has(i - i % 3)) {
   throw Error('A front vertex is shared with another face. Review the UV repair before changing it.');
  }
 }

 const {left, top, size} = detail.tile;
 const width = manifest.atlas.width;
 const writes = [...vertices].map(([vertex, corner]) => {
  const [u, v] = front[corner].uv;
  return {offset: wall.uv.byteOffset + vertex * 8, uv: [
   roundUV((left + u * size) / width),
   roundUV(1 - (top + (1 - v) * size) / width),
  ]};
 });
 const needsUV = writes.some(({offset, uv}) => uv.some((value, axis) =>
  Math.abs(binary.readFloatLE(offset + axis * 4) - value) > 1e-7));
 const mapped = [...offsets].filter(offset => part.ranges.some(([start, count]) => offset >= start && offset < start + count));
 const needsPair = [leftDetail, detail].some(page => page.detailPair !== 'central-storyway');
 if (!needsUV && mapped.length === 2 && !needsPair) return false;
 if (mapped.length === 1) throw Error('Only one of the paired F02WL058 triangles belongs to the detail page.');
 if (needsUV) {
  const [first] = writes;
  const isFlat = writes.every(({offset}) => [0, 4].every(axis =>
   binary.readFloatLE(offset + axis) === binary.readFloatLE(first.offset + axis)));
  if (!isFlat) throw Error('The F02WL058 front already has different texture coordinates. Review before replacing them.');
  for (const {offset, uv} of writes) {
   binary.writeFloatLE(uv[0], offset);
   binary.writeFloatLE(uv[1], offset + 4);
  }
 }
 if (!mapped.length) {
  const ranges = [...part.ranges, ...[...offsets].map(offset => [offset, 3])].sort((a, b) => a[0] - b[0]);
  part.ranges = [];
  for (const [start, count] of ranges) {
   const previous = part.ranges.at(-1);
   if (previous && previous[0] + previous[1] === start) previous[1] += count;
   else part.ranges.push([start, count]);
  }
  manifest.atlas.sourceImageReferences += 2;
  manifest.detailStats.triangles += 2;
  manifest.totals.texturedTriangles += 2;
  manifest.totals.repeatAverageTriangles -= 2;
 }
 leftDetail.detailPair = detail.detailPair = 'central-storyway';
 manifest.version = createHash('sha256').update(binary).update(atlas).update(JSON.stringify({
  metadata: manifest.groups, barriers: manifest.barriers, barriersByFloor: manifest.barriersByFloor,
 })).digest('hex').slice(0, 12);
 manifest.detailVersion = createHash('sha256').update(JSON.stringify(manifest.detailPages)).digest('hex').slice(0, 12);
 return true;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
 const directory = 'public/data/commons';
 const manifestPath = path.join(directory, 'architecture.json');
 const binaryPath = path.join(directory, 'architecture.bin');
 const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
 const binary = fs.readFileSync(binaryPath);
 const atlas = fs.readFileSync(path.join(directory, 'architecture-atlas.webp'));
 if (restoreStorywayFront(manifest, binary, atlas)) {
  fs.writeFileSync(binaryPath, binary);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
 }
 console.log(JSON.stringify({storywayFront: 'F02WL058-S01', version: manifest.version, detailVersion: manifest.detailVersion}));
}
