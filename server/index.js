import 'dotenv/config'
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import express from 'express'
import helmet from 'helmet'
import { rateLimit } from 'express-rate-limit'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scryptAsync = promisify(scrypt)
const app = express()
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = resolve(root, 'dist')
const defaultContentPath = resolve(root, 'content', 'site-content.json')
const editableContentPath = process.env.SITE_CONTENT_PATH ? resolve(process.env.SITE_CONTENT_PATH) : resolve(root, 'data', 'site-content.json')
const isProduction = process.env.NODE_ENV === 'production'
const port = Number(process.env.PORT || 3001)
const sessionCookie = isProduction ? '__Host-sunset-admin' : 'sunset-admin'
const sessionDuration = 4 * 60 * 60 * 1000
const sessions = new Map()

const credentials = (() => {
  const username = process.env.ADMIN_USERNAME
  const encodedHash = process.env.ADMIN_PASSWORD_HASH || ''
  const [algorithm, salt, passwordHash] = encodedHash.split('$')
  if (username !== 'admin432' || algorithm !== 'scrypt' || !/^[a-f0-9]{32,}$/i.test(salt || '') || !/^[a-f0-9]{128}$/i.test(passwordHash || '')) return null
  return { username, salt, passwordHash: Buffer.from(passwordHash, 'hex') }
})()

app.disable('x-powered-by')
app.use(helmet())
app.use(express.json({ limit: '64kb', strict: true }))
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store')
  next()
})

async function getSiteContent() {
  try {
    return JSON.parse(await readFile(editableContentPath, 'utf8'))
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    return JSON.parse(await readFile(defaultContentPath, 'utf8'))
  }
}

function validateContent(candidate, template, depth = 0) {
  if (depth > 8) return false
  if (typeof template === 'string') return typeof candidate === 'string' && candidate.length <= 600
  if (Array.isArray(template)) {
    return Array.isArray(candidate) && candidate.length === template.length && candidate.every((item, index) => validateContent(item, template[index], depth + 1))
  }
  if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) return false
  const expectedKeys = Object.keys(template)
  const candidateKeys = Object.keys(candidate)
  if (candidateKeys.length !== expectedKeys.length || candidateKeys.some((key) => !expectedKeys.includes(key))) return false
  return expectedKeys.every((key) => {
    const value = candidate[key]
    const expected = template[key]
    return validateContent(value, expected, depth + 1)
  })
}

function safeTextEqual(left, right) {
  const leftDigest = createHash('sha256').update(String(left)).digest()
  const rightDigest = createHash('sha256').update(String(right)).digest()
  return timingSafeEqual(leftDigest, rightDigest)
}

function hasSameOrigin(req, res) {
  if (req.get('origin') !== process.env.PUBLIC_ORIGIN) {
    res.status(403).json({ message: 'This request was blocked. Open the site directly and try again.' })
    return false
  }
  return true
}

function cookieValue(req, name) {
  const entry = (req.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))
  if (!entry) return ''
  try {
    return decodeURIComponent(entry.slice(name.length + 1))
  } catch {
    return ''
  }
}

function requireAdmin(req, res, next) {
  const token = cookieValue(req, sessionCookie)
  const expiresAt = sessions.get(token)
  if (!token || !expiresAt || expiresAt <= Date.now()) {
    if (token) sessions.delete(token)
    return res.status(401).json({ authenticated: false, message: 'Sign in to access the admin area.' })
  }
  req.adminSession = token
  next()
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({ message: 'Too many sign-in attempts. Please wait 15 minutes and try again.' }),
})

app.get('/api/admin/session', (req, res) => {
  const token = cookieValue(req, sessionCookie)
  const expiresAt = sessions.get(token)
  if (token && expiresAt > Date.now()) return res.json({ authenticated: true })
  if (token) sessions.delete(token)
  return res.status(credentials ? 401 : 503).json({ authenticated: false, message: credentials ? 'Sign in to access the admin area.' : 'Admin sign-in has not been set up on this server yet.' })
})

app.get('/api/site-content', async (_req, res, next) => {
  try {
    return res.json(await getSiteContent())
  } catch (error) {
    return next(error)
  }
})

app.post('/api/admin/login', loginLimiter, async (req, res, next) => {
  if (!hasSameOrigin(req, res)) return
  if (!credentials) return res.status(503).json({ message: 'Admin sign-in has not been set up on this server yet.' })

  const username = typeof req.body?.username === 'string' ? req.body.username.slice(0, 128) : ''
  const password = typeof req.body?.password === 'string' ? req.body.password.slice(0, 1024) : ''
  try {
    const suppliedHash = await scryptAsync(password, credentials.salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 })
    const usernameMatches = safeTextEqual(username, 'admin432') && safeTextEqual(username, credentials.username)
    const passwordMatches = timingSafeEqual(suppliedHash, credentials.passwordHash)
    if (!usernameMatches || !passwordMatches) return res.status(401).json({ message: 'Those sign-in details did not match.' })

    const token = randomBytes(32).toString('base64url')
    sessions.set(token, Date.now() + sessionDuration)
    const flags = `Path=/; Max-Age=${sessionDuration / 1000}; HttpOnly; SameSite=Strict${isProduction ? '; Secure' : ''}`
    res.setHeader('Set-Cookie', `${sessionCookie}=${encodeURIComponent(token)}; ${flags}`)
    return res.json({ authenticated: true })
  } catch (error) {
    return next(error)
  }
})

app.post('/api/admin/logout', (req, res) => {
  if (!hasSameOrigin(req, res)) return
  const token = cookieValue(req, sessionCookie)
  if (token) sessions.delete(token)
  res.setHeader('Set-Cookie', `${sessionCookie}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict${isProduction ? '; Secure' : ''}`)
  return res.json({ authenticated: false })
})

app.get('/api/admin/overview', requireAdmin, (_req, res) => {
  res.setHeader('Cache-Control', 'no-store')
  return res.json({ organization: 'Sunset Esports', established: 2026, sessionExpiresIn: '4 hours' })
})

app.get('/api/admin/site-content', requireAdmin, async (_req, res, next) => {
  try {
    return res.json(await getSiteContent())
  } catch (error) {
    return next(error)
  }
})

app.put('/api/admin/site-content', requireAdmin, async (req, res, next) => {
  if (!hasSameOrigin(req, res)) return
  try {
    const defaults = JSON.parse(await readFile(defaultContentPath, 'utf8'))
    if (!validateContent(req.body, defaults)) return res.status(400).json({ message: 'Content shape is invalid. Reload the editor and try again.' })
    await mkdir(dirname(editableContentPath), { recursive: true })
    const temporaryPath = `${editableContentPath}.${randomBytes(8).toString('hex')}.tmp`
    await writeFile(temporaryPath, `${JSON.stringify(req.body, null, 2)}\n`, { flag: 'wx', mode: 0o600 })
    await rename(temporaryPath, editableContentPath)
    return res.json({ saved: true })
  } catch (error) {
    return next(error)
  }
})

app.use('/api', (_req, res) => res.status(404).json({ message: 'Not found.' }))

if (isProduction) {
  app.use(express.static(dist, { index: false, dotfiles: 'deny', maxAge: '1h' }))
  app.use((_req, res, next) => res.sendFile(resolve(dist, 'index.html'), (error) => error && next(error)))
}

app.use((error, _req, res, _next) => {
  console.error('Admin server request failed:', error.message)
  return res.status(500).json({ message: 'The request could not be completed.' })
})

app.listen(port, process.env.HOST || '127.0.0.1', () => {
  console.log(`Sunset admin API listening on http://${process.env.HOST || '127.0.0.1'}:${port}${isProduction ? ' (production)' : ' (development)'}`)
})
