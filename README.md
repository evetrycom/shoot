# Shoot 📸

**Shoot** is a high-performance, enterprise-grade Screenshot & PDF Generation API built with **Hono** and **Playwright Chromium**. Designed for speed, reliability, and ease of integration into the **Evetry** ecosystem.

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](./Dockerfile)
[![Framework](https://img.shields.io/badge/Framework-Hono-orange.svg)](https://hono.dev)

## ✨ Features

- 🖼️ **Multi-Format Output**: Generate PNG, JPEG, WEBP images or high-quality PDF documents.
- 🚀 **Performance Optimized**: Uses a **Browser Singleton** (warm browser) pattern for near-instant response times.
- 🌐 **Metadata Extraction**: Get website title, description, cover image, and icon with a hybrid Fast-Path/Render-Path engine.
- 📄 **Raw HTML Support**: Render screenshots/PDFs directly from HTML strings via POST requests.
- 🔐 **Secure by Default**: Built-in API Key authentication middleware.
- 🚦 **Concurrency Control**: Intelligent request queueing and limits to prevent server OOM (Out of Memory).
- 🛠️ **Advanced Options**: Custom viewports, full-page capture, delays, quality settings, and paper formats.
- 🐳 **Dockerized**: Ready-to-deploy multi-stage Docker image based on official Playwright images.

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Docker (optional, for containerized deployment)

### Local Setup

1. **Clone and Install**:
   ```bash
   npm install
   npx playwright install chromium
   ```

2. **Configure Environment**:
   Copy `.env.example` to `.env` and set your `API_KEY`.
   ```bash
   cp .env.example .env
   ```

3. **Run Development Server**:
   ```bash
   npm run dev
   ```

## 📡 API Documentation

### Authentication
All requests must include the API Key in the headers or as a query parameter.
- Header: `x-api-key: your-secret-key`
- Query: `?api_key=your-secret-key`

### Keep-Alive (Health Check)
`GET/POST/HEAD /health`
Returns the current status, uptime, and active request count.

### Capture Screenshot/PDF
`GET /screenshot` or `POST /screenshot`

#### Query Parameters (GET) / JSON Body (POST)
| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `url` | string | - | The URL to capture. |
| `html` | string | - | Raw HTML to render (POST only). |
| `format` | string | `png` | `png`, `jpeg`, `webp`, or `pdf`. |
| `width` | number | `1280` | Viewport width. |
| `height` | number | `720` | Viewport height. |
| `fullPage` | boolean | `false` | Capture the entire scrollable page. |
| `quality` | number | `80` | Image quality (0-100, JPEG/WEBP only). |
| `delay` | number | `0` | Wait time in ms before capture. |
| `paper` | string | `A4` | PDF paper format (A4, Letter, etc.). |

### Extract Website Metadata
`GET /metadata` or `POST /metadata`

Extracts standard and social metadata from any URL. It uses a **Hybrid Extraction Engine**:
1. **Fast Path**: Attempts to fetch tags directly using a Googlebot User-Agent.
2. **Render Path**: Fallbacks to a headless browser for SPAs or if explicitly requested.

#### Parameters
| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `url` | string | - | The URL to extract metadata from. |
| `render` | boolean | `false` | Force browser rendering (slower, but better for pure SPAs). |

#### Example Response
```json
{
  "title": "Evetry - Connect and Shoot",
  "description": "The ultimate platform for creators.",
  "image": "https://evetry.com/og-image.jpg",
  "icon": "https://evetry.com/favicon.ico",
  "url": "https://evetry.com"
}
```

### Security & CORS
You can restrict which domains can access this API by setting the `ALLOWED_ORIGINS` environment variable in your `.env` file.
- **Multiple Domains**: `ALLOWED_ORIGINS=https://domain1.com,https://domain2.com`
- **All Domains**: `ALLOWED_ORIGINS=*` (or leave empty)

#### Example (CURL)
```bash
curl -X POST http://localhost:3000/screenshot \
  -H "x-api-key: your-secret-key" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://google.com",
    "format": "pdf",
    "paper": "A4",
    "fullPage": true
  }' --output result.pdf
```

## 🧪 Examples

Check out the [examples/](./examples/) directory for more scripts:
- **[Capture PDF from Raw HTML](./examples/html-to-pdf.js)**: Demonstrates how to pass a custom HTML string and get a PDF back.
- **[Extract Website Metadata](./examples/metadata.js)**: Shows how to get SEO and OG metadata from any URL.
- **[Capture Full-Page Screenshot](./examples/screenshot-fullpage.js)**: Shows advanced options like high-quality JPEG and a custom rendering delay.
- **[Simple GET Capture](./examples/simple-get.js)**: Using query parameters for a quick screenshot.

## 🐳 Docker Deployment

### Use Pre-built Image (Recommended)
You can pull the latest image directly from GitHub Container Registry (GHCR):
```bash
docker pull ghcr.io/evetrycom/shoot:latest
```

Then run it:
```bash
docker run -p 3000:3000 \
  --env API_KEY=yoursecret \
  --env MAX_CONCURRENCY=5 \
  ghcr.io/evetrycom/shoot:latest
```

### Build Locally
If you want to build the container locally:
```bash
docker build -t shoot .
docker run -p 3000:3000 --env API_KEY=yoursecret shoot
```

## 📝 License

Licensed under the **Apache License 2.0**. See [LICENSE](./LICENSE) for more information.

---
Built with ❤️ for the **Evetry** ecosystem.
