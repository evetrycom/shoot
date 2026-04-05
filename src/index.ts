import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { chromium, Browser, Page } from 'playwright-chromium'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors'
import { config } from 'dotenv'
import * as cheerio from 'cheerio'

// Load environment variables
config()

const app = new Hono()

// Environment Variables
const API_KEY = process.env.API_KEY || 'shoot-default-key'
const MAX_CONCURRENCY = Number(process.env.MAX_CONCURRENCY) || 5
const PORT = Number(process.env.PORT) || 3000
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*'

// Middleware: Logger & CORS
app.use('*', logger())
app.use('*', cors({
  origin: ALLOWED_ORIGINS,
  allowMethods: ['GET', 'POST', 'HEAD', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'x-api-key'],
  maxAge: 600,
}))

// State: Browser Singleton & Concurrency Counter
let browserInstance: Browser | null = null
let activePages = 0

// Middleware: API Key Authentication
app.use('/:path{(screenshot|metadata)}', async (c, next) => {
  const key = c.req.header('x-api-key') || c.req.query('api_key')
  if (key !== API_KEY) {
    return c.json({ error: 'Unauthorized: Invalid API Key' }, 401)
  }
  await next()
})

// Middleware: Concurrency Control
app.use('/:path{(screenshot|metadata)}', async (c, next) => {
  if (activePages >= MAX_CONCURRENCY) {
    return c.json({ error: 'Server Busy: Too many concurrent requests' }, 503)
  }
  activePages++
  try {
    await next()
  } finally {
    activePages--
  }
})

// Browser Helper
async function getBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance
  }
  
  if (browserInstance) {
    await browserInstance.close().catch(() => {})
  }

  console.log('[Browser] Launching new instance...')
  browserInstance = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })
  
  return browserInstance
}

// Handlers
const screenshotHandler = async (c: any) => {
  let url: string | undefined
  let html: string | undefined
  let options: any = {}

  if (c.req.method === 'POST') {
    try {
      const body = await c.req.json()
      url = body.url
      html = body.html
      options = body
    } catch (e) {
      return c.json({ error: 'Invalid JSON body' }, 400)
    }
  } else {
    url = c.req.query('url')
    options = {
      url,
      format: c.req.query('format') || 'png',
      width: Number(c.req.query('width')) || 1280,
      height: Number(c.req.query('height')) || 720,
      fullPage: c.req.query('fullPage') === 'true',
      quality: Number(c.req.query('quality')) || 80,
      delay: Number(c.req.query('delay')) || 0,
      paper: c.req.query('paper') || 'A4'
    }
  }

  if (!url && !html) {
    return c.json({ error: 'Missing "url" or "html" parameter' }, 400)
  }

  const format = (options.format || 'png').toLowerCase()
  const isPdf = format === 'pdf'

  let page: Page | null = null
  try {
    const browser = await getBrowser()
    const context = await browser.newContext({
      viewport: { 
        width: options.width || 1280, 
        height: options.height || 720 
      }
    })
    page = await context.newPage()
    
    if (html) {
      await page.setContent(html, { waitUntil: 'networkidle' })
    } else {
      await page.goto(url!, { waitUntil: 'networkidle', timeout: 30000 })
    }

    if (options.delay > 0) {
      await page.waitForTimeout(options.delay)
    }

    let buffer: Buffer
    let contentType: string

    if (isPdf) {
      buffer = Buffer.from(await page.pdf({
        format: options.paper || 'A4',
        printBackground: options.printBackground !== false,
        margin: options.margin || { top: '20px', bottom: '20px', left: '20px', right: '20px' }
      }))
      contentType = 'application/pdf'
    } else {
      buffer = await page.screenshot({
        type: format === 'png' ? 'png' : 'jpeg',
        fullPage: !!options.fullPage,
        quality: format === 'jpeg' ? (options.quality || 80) : undefined
      })
      contentType = `image/${format}`
    }

    await page.close()
    await context.close()

    return c.body(buffer, 200, {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600'
    })
  } catch (error: any) {
    console.error('[Error]', error)
    if (page) await page.close().catch(() => {})
    return c.json({ error: 'Internal Server Error', message: error.message }, 500)
  }
}

const metadataHandler = async (c: any) => {
  let url: string | undefined
  let render = false

  if (c.req.method === 'POST') {
    try {
      const body = await c.req.json()
      url = body.url
      render = body.render === true
    } catch (e) {
      return c.json({ error: 'Invalid JSON body' }, 400)
    }
  } else {
    url = c.req.query('url')
    render = c.req.query('render') === 'true'
  }

  if (!url) {
    return c.json({ error: 'Missing "url" parameter' }, 400)
  }

  try {
    let metadata: any = null

    // 1. Fast Path (Fetch + Cheerio)
    if (!render) {
      console.log(`[Fast Path] Fetching metadata for ${url}...`)
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000)
        
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
          },
          signal: controller.signal
        })
        clearTimeout(timeoutId)

        if (response.ok) {
          const html = await response.text()
          const $ = cheerio.load(html)
          
          const getMeta = (names: string[]) => {
            for (const name of names) {
              const content = $(`meta[property="${name}"], meta[name="${name}"]`).attr('content')
              if (content) return content
            }
            return null
          }

          metadata = {
            title: getMeta(['og:title', 'twitter:title', 'title']) || $('title').text() || null,
            description: getMeta(['og:description', 'twitter:description', 'description']) || null,
            image: getMeta(['og:image', 'twitter:image', 'image_src', 'image']) || null,
            icon: $('link[rel="apple-touch-icon"]').attr('href') || 
                  $('link[rel="shortcut icon"]').attr('href') || 
                  $('link[rel="icon"]').attr('href') || 
                  '/favicon.ico',
            url: getMeta(['og:url']) || url
          }

          // Fallback image to first img in body if meta image is missing
          if (!metadata.image) {
            const firstImg = $('body img').first().attr('src')
            if (firstImg) {
              try {
                metadata.image = new URL(firstImg, url).href
              } catch (e) {
                metadata.image = firstImg
              }
            }
          }

          // Resolve absolute URLs
          const resolveFullUrl = (val: string | null | undefined) => {
            if (!val || typeof val !== 'string') return val
            if (val.startsWith('http')) return val
            try {
              return new URL(val, url!).href
            } catch (e) {
              return val
            }
          }

          metadata.icon = resolveFullUrl(metadata.icon)
          metadata.image = resolveFullUrl(metadata.image)

          // If results are "too empty", we might want to fallback to rendering (only if not explicit)
          if (!metadata.title && !metadata.description) {
            console.log('[Fast Path] Results too sparse, falling back to rendering...')
            metadata = null
          }
        }
      } catch (e) {
        console.warn(`[Fast Path] Failed: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    // 2. Full Render Path (Playwright)
    if (!metadata) {
      console.log(`[Render Path] Launching browser for ${url}...`)
      let page: Page | null = null
      try {
        const browser = await getBrowser()
        const context = await browser.newContext()
        page = await context.newPage()
        
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
        
        // Pass a string for the evaluation function to prevent esbuild/tsx from adding __name or other artifacts
        const script = `({ originalUrl }) => {
          const data = {};
          const metas = document.getElementsByTagName('meta');
          for (let i = 0; i < metas.length; i++) {
            const p = metas[i].getAttribute('property') || metas[i].getAttribute('name');
            const c = metas[i].getAttribute('content');
            if (p && c) data[p] = c;
          }
          
          const title = data['og:title'] || data['twitter:title'] || data['title'] || document.title || null;
          const description = data['og:description'] || data['twitter:description'] || data['description'] || null;
          let image = data['og:image'] || data['twitter:image'] || data['image_src'] || data['image'] || null;
          
          if (!image) {
            const img = document.querySelector('body img');
            if (img) image = (img).src || img.getAttribute('src');
          }

          const iconEl = document.querySelector('link[rel="apple-touch-icon"], link[rel="shortcut icon"], link[rel="icon"]');
          let icon = iconEl ? iconEl.getAttribute('href') : '/favicon.ico';

          const resolveUrl = (v) => {
            if (!v) return null;
            try { return new URL(v, originalUrl).href; } catch(e) { return v; }
          };

          return {
            title,
            description,
            image: resolveUrl(image),
            icon: resolveUrl(icon),
            url: data['og:url'] || originalUrl
          };
        }`;

        metadata = await page.evaluate(script, { originalUrl: url })

        await page.close()
        await context.close()
      } catch (err: any) {
        console.error('[Render Path Error]', err)
        if (page) await page.close().catch(() => {})
        throw new Error(`Render Path Failed: ${err.message}`)
      }
    }

    return c.json(metadata, 200, {
      'Cache-Control': 'public, max-age=3600'
    })
  } catch (error: any) {
    console.error('[Error Metadata]', error)
    return c.json({ error: 'Internal Server Error', message: error.message }, 500)
  }
}

// Routes
app.get('/screenshot', screenshotHandler)
app.post('/screenshot', screenshotHandler)

app.get('/metadata', metadataHandler)
app.post('/metadata', metadataHandler)

app.on(['GET', 'POST', 'HEAD'], '/health', (c) => {
  if (c.req.method === 'HEAD') return c.body(null, 204)
  return c.json({ 
    status: 'ok', 
    uptime: process.uptime(),
    activeRequests: activePages,
    maxConcurrency: MAX_CONCURRENCY,
    timestamp: new Date().toISOString()
  })
})

console.log(`[Server] Starting on port ${PORT}...`)
serve({ fetch: app.fetch, port: PORT })
