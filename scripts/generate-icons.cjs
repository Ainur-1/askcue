const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'assets/askcue-logo.svg'));

async function main() {
  const sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
  const images = new Map();
  fs.mkdirSync(path.join(root, 'assets/icons/png'), { recursive: true });
  fs.mkdirSync(path.join(root, 'assets/icons/win'), { recursive: true });
  for (const size of sizes) {
    const png = await sharp(source, { density: 192 }).resize(size, size).png().toBuffer();
    images.set(size, png);
    fs.writeFileSync(path.join(root, `assets/icons/png/icon_${size}x${size}.png`), png);
  }
  fs.writeFileSync(path.join(root, 'assets/icon.png'), images.get(1024));
  const icoSizes = sizes.filter(size => size <= 256);
  const header = Buffer.alloc(6 + icoSizes.length * 16);
  header.writeUInt16LE(1, 2); header.writeUInt16LE(icoSizes.length, 4);
  let offset = header.length;
  icoSizes.forEach((size, index) => {
    const entry = 6 + index * 16;
    header[entry] = size === 256 ? 0 : size; header[entry + 1] = header[entry];
    header.writeUInt16LE(1, entry + 4); header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(images.get(size).length, entry + 8); header.writeUInt32LE(offset, entry + 12);
    offset += images.get(size).length;
  });
  const ico = Buffer.concat([header, ...icoSizes.map(size => images.get(size))]);
  for (const file of ['assets/icon.ico', 'assets/icons/win/icon.ico', 'assets/icons/win/askcue.ico']) fs.writeFileSync(path.join(root, file), ico);
  const chunks = [['icp4', 16], ['icp5', 32], ['icp6', 64], ['ic07', 128], ['ic08', 256], ['ic09', 512], ['ic10', 1024]].map(([type, size]) => {
    const chunk = Buffer.alloc(8); chunk.write(type); chunk.writeUInt32BE(8 + images.get(size).length, 4);
    return Buffer.concat([chunk, images.get(size)]);
  });
  const icnsHeader = Buffer.alloc(8); icnsHeader.write('icns'); icnsHeader.writeUInt32BE(8 + chunks.reduce((sum, value) => sum + value.length, 0), 4);
  for (const file of ['assets/icon.icns', 'assets/askcue.icns', 'assets/icons/mac/icon.icns']) fs.writeFileSync(path.join(root, file), Buffer.concat([icnsHeader, ...chunks]));
  // Template images use alpha only in the macOS menu bar.
  const template = source.toString().replaceAll('#f3ead6', 'none').replaceAll('#993f32', '#000000');
  fs.writeFileSync(path.join(root, 'assets/iconTemplate.png'), await sharp(Buffer.from(template)).resize(36, 36).png().toBuffer());
  console.log('Generated PNG sizes, Windows ICO and macOS ICNS from one logo.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
