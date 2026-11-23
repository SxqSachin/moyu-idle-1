// Serve a user-uploaded avatar file via an API endpoint instead of direct static access.
// Filename pattern: user_<uuid>_<timestamp>_<suffix>.png stored under runtime-uploads/avatars
// Returns 404 if invalid filename or file missing. Adds basic caching headers.
// @ts-nocheck
import { defineEventHandler, getRouterParam, setHeader } from 'h3'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import crypto from 'node:crypto'

const AVATAR_DIR = path.resolve(process.cwd(), 'runtime-uploads/avatars')

function isValidFilename(name: string) {
  // Restrict to png currently produced by pipeline
  return /^user_[a-zA-Z0-9-]+_\d+_[a-z0-9]{8}\.png$/.test(name)
}

export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, 'name')
  if (!name || typeof name !== 'string' || !isValidFilename(name)) {
    return event.node.res.writeHead(404).end('Not Found')
  }
  const filePath = path.join(AVATAR_DIR, name)
  try {
    const buf = await fs.readFile(filePath)
    // ETag for caching
    const etag = 'W/"' + crypto.createHash('md5').update(buf).digest('hex') + '"'
    setHeader(event, 'Content-Type', 'image/png')
    setHeader(event, 'Cache-Control', 'public, max-age=3600')
    setHeader(event, 'ETag', etag)
    // Conditional GET support
    const ifNoneMatch = event.node.req.headers['if-none-match']
    if (ifNoneMatch && ifNoneMatch === etag) {
      event.node.res.statusCode = 304
      return ''
    }
    return buf
  } catch (e) {
    event.node.res.writeHead(404).end('Not Found')
  }
})
