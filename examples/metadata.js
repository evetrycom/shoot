/**
 * Metadata Extraction Example
 * 
 * This script demonstrates how to use the /metadata endpoint to get
 * SEO and Social Media (Open Graph/Twitter) tags from a website.
 */

const axios = require('axios'); // or use fetch

const API_URL = 'http://localhost:3000/metadata';
const API_KEY = 'shoot-default-key'; // Replace with your actual key
const TARGET_URL = 'https://github.com/honojs/hono';

async function getMetadata() {
  try {
    console.log(`📡 Extracting metadata for: ${TARGET_URL}...`);

    const response = await axios.post(API_URL, {
      url: TARGET_URL,
      render: false // Set to true for pure SPAs
    }, {
      headers: {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Metadata Received:');
    console.log(JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('❌ Error fetching metadata:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

getMetadata();
