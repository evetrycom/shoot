import fetch from 'node-fetch'; // or built-in fetch in Node 18+
import fs from 'fs';

const API_URL = 'http://localhost:3000/screenshot';
const API_KEY = 'your-secret-key';

async function generatePdf() {
  console.log('Generating PDF from HTML...');
  
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY
    },
    body: JSON.stringify({
      html: `
        <html>
          <body style="font-family: Arial, sans-serif; padding: 40px; background-color: #f4f4f9;">
            <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <h1 style="color: #333;">Invoice #12345</h1>
              <p>Thank you for using <strong>Evetry Shoot</strong>!</p>
              <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                <tr style="background: #eee;">
                  <th style="padding: 10px; border: 1px solid #ddd;">Item</th>
                  <th style="padding: 10px; border: 1px solid #ddd;">Price</th>
                </tr>
                <tr>
                  <td style="padding: 10px; border: 1px solid #ddd;">API Service</td>
                  <td style="padding: 10px; border: 1px solid #ddd;">$10.00</td>
                </tr>
              </table>
              <div style="margin-top: 30px; text-align: right; font-weight: bold;">
                Total: $10.00
              </div>
            </div>
          </body>
        </html>
      `,
      format: 'pdf',
      paper: 'A4',
      margin: { top: '0', bottom: '0', left: '0', right: '0' }
    })
  });

  if (!response.ok) {
    console.error('Failed to generate PDF:', await response.text());
    return;
  }

  const arrayBuffer = await response.arrayBuffer();
  fs.writeFileSync('invoice.pdf', Buffer.from(arrayBuffer));
  console.log('PDF saved as invoice.pdf');
}

generatePdf();
