import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { chromium, Browser, Page } from 'playwright-chromium'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors'
import { config } from 'dotenv'

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
app.use('/screenshot', async (c, next) => {
  const key = c.req.header('x-api-key') || c.req.query('api_key')
  if (key !== API_KEY) {
    return c.json({ error: 'Unauthorized: Invalid API Key' }, 401)
  }
  await next()
})

// Middleware: Concurrency Control
app.use('/screenshot', async (c, next) => {
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

// Routes
app.get('/screenshot', screenshotHandler)
app.post('/screenshot', screenshotHandler)

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
