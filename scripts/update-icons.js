const sharp = require('sharp');

const source = 'C:/Users/Tadeo/Downloads/check-list-icon-vector-symbol-600nw-2477440299.webp';

async function main() {
  await sharp(source)
    .resize(860, 860, {
      fit: 'contain',
      background: '#e5e7eb',
    })
    .extend({
      top: 82,
      bottom: 82,
      left: 82,
      right: 82,
      background: '#e5e7eb',
    })
    .png()
    .toFile('assets/icon.png');

  await sharp(source)
    .resize(760, 760, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .extend({
      top: 132,
      bottom: 132,
      left: 132,
      right: 132,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile('assets/adaptive-icon.png');

  console.log('icons-updated');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
