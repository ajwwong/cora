const { createCanvas } = require('canvas');
const fs = require('fs');

// Create directory if it doesn't exist
if (!fs.existsSync('./assets')) {
  fs.mkdirSync('./assets');
}

// Create a simple image
function createImage(filename, width, height) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Fill background
  ctx.fillStyle = '#4630EB'; // Expo blue
  ctx.fillRect(0, 0, width, height);
  
  // Add some text
  ctx.fillStyle = 'white';
  ctx.font = 'bold 30px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Mira', width/2, height/2);
  
  // Save to file
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(`./assets/${filename}`, buffer);
  console.log(`Created ${filename} (${width}x${height})`);
}

// Generate the required images
createImage('favicon.png', 32, 32);
createImage('icon.png', 512, 512);
createImage('splash.png', 1242, 2436);
createImage('adaptive-icon.png', 1024, 1024);
