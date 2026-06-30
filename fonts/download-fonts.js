#!/usr/bin/env node
/**
 * Download Roboto fonts from Google Fonts
 * Run: node download-fonts.js
 * This is needed for Railway deployments where system fonts are not available
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const FONTS = [
  {
    url: 'https://fonts.gstatic.com/s/roboto/v51/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWubEbWmT.ttf',
    filename: 'Roboto-Regular.ttf',
  },
  {
    url: 'https://fonts.gstatic.com/s/roboto/v51/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWuYjammT.ttf',
    filename: 'Roboto-Bold.ttf',
  },
];

const fontsDir = __dirname;

function downloadFile(url, filename) {
  return new Promise((resolve, reject) => {
    const filepath = path.join(fontsDir, filename);
    const file = fs.createWriteStream(filepath);

    https
      .get(url, (response) => {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log(`✓ Downloaded ${filename}`);
          resolve();
        });
      })
      .on('error', (err) => {
        fs.unlink(filepath, () => {}); // Delete partially downloaded file
        reject(err);
      });
  });
}

async function main() {
  console.log('Downloading Roboto fonts from Google Fonts...\n');

  try {
    for (const font of FONTS) {
      await downloadFile(font.url, font.filename);
    }
    console.log('\n✓ All fonts downloaded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('✗ Error downloading fonts:', error.message);
    process.exit(1);
  }
}

main();
