const path = require('path');
const sharp = require('sharp');

const source = 'C:/Users/Tadeo/Downloads/check-list-icon-vector-symbol-600nw-2477440299.webp';
const projectRoot = process.cwd();
const mipmaps = [
  { folder: 'mipmap-mdpi', size: 48 },
  { folder: 'mipmap-hdpi', size: 72 },
  { folder: 'mipmap-xhdpi', size: 96 },
  { folder: 'mipmap-xxhdpi', size: 144 },
  { folder: 'mipmap-xxxhdpi', size: 192 },
];

async function writeSquareIcon(folder, size, fileName) {
  const output = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res', folder, fileName);

  await sharp(source)
    .resize(size, size, {
      fit: 'contain',
      background: '#e5e7eb',
    })
    .png()
    .toFile(output);
}

async function main() {
  for (const { folder, size } of mipmaps) {
    await writeSquareIcon(folder, size, 'ic_launcher.png');
    await writeSquareIcon(folder, size, 'ic_launcher_round.png');
  }

  console.log('native-launcher-icons-updated');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
