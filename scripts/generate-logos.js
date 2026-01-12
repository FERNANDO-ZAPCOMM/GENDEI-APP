const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Register Borel font from project assets
const fontPath = path.join(__dirname, '../assets/fonts/Borel-Regular.ttf');
GlobalFonts.registerFromPath(fontPath, 'Borel');

const DARK_BLUE = '#1e3a5f'; // Dark blue for the logo

// Generate favicon with "G" letter - transparent background, black letter
// Render "Ge" and crop to just the "G" to get Borel uppercase
async function generateFavicon(size, outputPath) {
  const renderSize = 1024;
  const canvas = createCanvas(renderSize, renderSize);
  const ctx = canvas.getContext('2d');

  // Black "Ge" in Borel font - we'll crop to just G
  ctx.fillStyle = '#000000';
  const fontSize = renderSize * 0.4;
  ctx.font = `${fontSize}px Borel`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('Ge', renderSize * 0.2, renderSize / 2);

  const buffer = canvas.toBuffer('image/png');

  // Crop to just the "G"
  const gWidth = Math.round(fontSize * 0.55);
  await sharp(buffer)
    .extract({
      left: Math.round(renderSize * 0.2),
      top: Math.round(renderSize / 2 - fontSize * 0.6),
      width: gWidth,
      height: Math.round(fontSize * 1.2)
    })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toFile(outputPath);

  console.log(`Generated: ${outputPath}`);
}

// Generate logo with "Gendei" text
async function generateLogo(size, outputPath) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Transparent background (default)

  // Dark blue "Gendei" text in Borel font
  ctx.fillStyle = DARK_BLUE;
  ctx.font = `${size * 0.2}px Borel`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Gendei', size / 2, size / 2);

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);
  console.log(`Generated: ${outputPath}`);
}

// Generate icon with "G" (for app icons) - transparent background, black letter
// Render "Ge" and crop to just the "G" to get Borel uppercase
async function generateIcon(size, outputPath) {
  const renderSize = 1024;
  const canvas = createCanvas(renderSize, renderSize);
  const ctx = canvas.getContext('2d');

  // Black "Ge" in Borel font - we'll crop to just G
  ctx.fillStyle = '#000000';
  const fontSize = renderSize * 0.4;
  ctx.font = `${fontSize}px Borel`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('Ge', renderSize * 0.2, renderSize / 2);

  const buffer = canvas.toBuffer('image/png');

  // Crop to just the "G" - measure width of G
  const gWidth = Math.round(fontSize * 0.55);
  await sharp(buffer)
    .extract({
      left: Math.round(renderSize * 0.2),
      top: Math.round(renderSize / 2 - fontSize * 0.6),
      width: gWidth,
      height: Math.round(fontSize * 1.2)
    })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toFile(outputPath);

  console.log(`Generated: ${outputPath}`);
}

// Generate favicon.ico from PNG
async function generateIco(pngBuffer, outputPath) {
  // For simplicity, we'll create a 32x32 PNG as ico (browsers handle it well)
  await sharp(pngBuffer)
    .resize(32, 32)
    .toFile(outputPath.replace('.ico', '-temp.png'));

  // Copy as .ico (modern browsers handle PNG in ICO container)
  fs.copyFileSync(outputPath.replace('.ico', '-temp.png'), outputPath);
  fs.unlinkSync(outputPath.replace('.ico', '-temp.png'));
  console.log(`Generated: ${outputPath}`);
}

async function main() {
  const frontendAppDir = path.join(__dirname, '../apps/frontend/app');
  const rootDir = path.join(__dirname, '..');

  // Generate favicons
  await generateFavicon(16, path.join(frontendAppDir, 'favicon-16x16.png'));
  await generateFavicon(32, path.join(frontendAppDir, 'favicon-32x32.png'));

  // Generate favicon.ico from 32x32 PNG
  const png32Buffer = fs.readFileSync(path.join(frontendAppDir, 'favicon-32x32.png'));
  await generateIco(png32Buffer, path.join(frontendAppDir, 'favicon.ico'));

  // Generate app icons
  await generateIcon(192, path.join(frontendAppDir, 'icon-192.png'));
  await generateIcon(512, path.join(frontendAppDir, 'icon-512.png'));

  // Generate logos for root directory
  await generateLogo(512, path.join(rootDir, 'gendei-logo-512.png'));
  await generateLogo(1024, path.join(rootDir, 'gendei-logo-1024.png'));

  // Update website favicon.svg - transparent background, black "G" uppercase
  const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Borel&amp;display=swap');
  </style>
  <text x="50" y="65" font-family="Borel, cursive" font-size="80" fill="black" text-anchor="middle">G</text>
</svg>`;

  fs.writeFileSync(path.join(rootDir, 'website/public/favicon.svg'), faviconSvg);
  console.log('Generated: website/public/favicon.svg');

  console.log('\nAll logos and favicons generated successfully!');
}

main().catch(console.error);
