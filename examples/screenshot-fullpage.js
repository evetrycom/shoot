const fetch = require('node-fetch'); // or use built-in fetch in Node 18+
const fs = require('fs');

const API_URL = 'http://localhost:3000/screenshot';
const API_KEY = 'your-secret-key';

async function captureScreenshot() {
  console.log('Capturing a high-quality JPEG for a dynamic page...');
  
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY
    },
    body: JSON.stringify({
      url: 'https://github.com',
      format: 'jpeg',
      quality: 100,
      width: 1920,
      height: 1080,
      fullPage: true,
      delay: 2000 // Wait 2s for animations or heavy elements to load
    })
  });

  if (!response.ok) {
    console.error('Failed to capture screenshot:', await response.text());
    return;
  }

  const arrayBuffer = await response.arrayBuffer();
  fs.writeFileSync('github-fullpage.jpg', Buffer.from(arrayBuffer));
  console.log('Finished capturing! Check github-fullpage.jpg');
}

captureScreenshot();
