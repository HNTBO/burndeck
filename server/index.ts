import { createReadStream, existsSync } from 'node:fs'
import { promises as fs } from 'node:fs'
import { createServer, type ServerResponse } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { cwd, env } from 'node:process'
import { handleOpenAIRefresh } from './openai.js'

const port = Number(env.PORT ?? 6409)
const distDir = join(cwd(), 'dist')

const mimeTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
}

const sendJson = (response: ServerResponse, statusCode: number, payload: unknown) => {
  response.writeHead(statusCode, {
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Origin': env.CORS_ORIGIN ?? '*',
    'Content-Type': 'application/json; charset=utf-8',
  })
  response.end(JSON.stringify(payload))
}

const sendFile = async (response: ServerResponse, filePath: string) => {
  const extension = extname(filePath)

  response.writeHead(200, {
    'Content-Type': mimeTypes[extension] ?? 'application/octet-stream',
  })

  createReadStream(filePath).pipe(response)
}

const resolveStaticPath = (pathname: string) => {
  const safePath = normalize(pathname).replace(/^(\.\.[/\\])+/, '')
  const candidatePath = join(distDir, safePath)

  if (existsSync(candidatePath)) {
    return candidatePath
  }

  return join(distDir, 'index.html')
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)

  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Origin': env.CORS_ORIGIN ?? '*',
    })
    response.end()
    return
  }

  if (url.pathname === '/api/health' && request.method === 'GET') {
    sendJson(response, 200, {
      ok: true,
      openAIConfigured: Boolean(env.OPENAI_ADMIN_KEY),
    })
    return
  }

  if (url.pathname === '/api/refresh/openai' && request.method === 'POST') {
    try {
      const payload = await handleOpenAIRefresh(request)
      sendJson(response, 200, payload)
    } catch (error) {
      sendJson(response, 500, {
        error: error instanceof Error ? error.message : 'OpenAI refresh failed.',
      })
    }
    return
  }

  if (!existsSync(distDir)) {
    sendJson(response, 503, {
      error: 'Frontend build not found. Run npm run build before starting the server.',
    })
    return
  }

  try {
    const pathname = url.pathname === '/' ? '/index.html' : url.pathname
    const filePath = resolveStaticPath(pathname)
    await fs.access(filePath)
    await sendFile(response, filePath)
  } catch {
    sendJson(response, 404, {
      error: 'Not found.',
    })
  }
})

server.listen(port, () => {
  console.log(`BurnDeck server listening on http://0.0.0.0:${port}`)
})
