const fetch = require('node-fetch'); // or use built-in fetch in Node 18+
const fs = require('fs');

const API_URL = 'http://localhost:3000/screenshot';
const API_KEY = 'your-secret-key';
const TARGET_URL = 'https://google.com';

async function simpleCapture() {
  console.log(`Simple GET capture of ${TARGET_URL}...`);
  
  const response = await fetch(`${API_URL}?url=${encodeURIComponent(TARGET_URL)}&api_key=${API_KEY}&format=png`);

  if (!response.ok) {
    console.error('Failed to capture:', await response.text());
    return;
  }

  const arrayBuffer = await response.arrayBuffer();
  fs.writeFileSync('simple-google.png', Buffer.from(arrayBuffer));
  console.log('Capture saved successfully!');
}

simpleCapture();
