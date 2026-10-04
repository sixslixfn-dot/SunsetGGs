import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { randomBytes, scryptSync } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const serverPath = fileURLToPath(new URL('./index.js', import.meta.url))

test('admin auth keeps credentials server-side and protects sessions', async () => {
  const port = 33100 + Math.floor(Math.random() * 15000)
  const origin = 'https://sunset.test'
  const username = 'admin432'
  const password = randomBytes(24).toString('base64url')
  const salt = randomBytes(16).toString('hex')
  const passwordHash = scryptSync(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString('hex')
  const contentDirectory = await mkdtemp(`${tmpdir()}\\sunset-auth-test-`)
  const server = spawn(process.execPath, [serverPath], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: { ...process.env, NODE_ENV: 'production', PORT: String(port), HOST: '127.0.0.1', PUBLIC_ORIGIN: origin, SITE_CONTENT_PATH: `${contentDirectory}\\site-content.json`, ADMIN_USERNAME: username, ADMIN_PASSWORD_HASH: `scrypt$${salt}$${passwordHash}` },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let output = ''
  let readyResolved = false
  let resolveReady
  let rejectReady
  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve
    rejectReady = reject
  })
  server.stdout.setEncoding('utf8')
  server.stderr.setEncoding('utf8')
  server.stdout.on('data', (chunk) => {
    output += chunk
    if (!readyResolved && output.includes('listening on')) {
      readyResolved = true
      resolveReady()
    }
  })
  server.stderr.on('data', (chunk) => { output += chunk })
  server.once('error', rejectReady)
  server.once('exit', (code) => {
    if (!readyResolved) rejectReady(new Error(`Auth server exited before ready (${code}): ${output}`))
  })

  try {
    let readyTimeout
    await Promise.race([ready, new Promise((_, reject) => { readyTimeout = setTimeout(() => reject(new Error(`Auth server did not become ready: ${output}`)), 8000) })])
    clearTimeout(readyTimeout)
    const base = `http://127.0.0.1:${port}`
    const api = (path, init = {}) => fetch(`${base}${path}`, {
      ...init,
      headers: { Origin: origin, ...(init.headers || {}) },
      redirect: 'manual',
    })

    const anonymous = await api('/api/admin/overview')
    assert.equal(anonymous.status, 401)
    assert.equal(anonymous.headers.get('cache-control'), 'no-store')

    const rejectedOrigin = await api('/api/admin/login', {
      method: 'POST', headers: { Origin: 'https://attacker.test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    assert.equal(rejectedOrigin.status, 403)

    const rejectedUser = await api('/api/admin/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'someone-else', password }),
    })
    assert.equal(rejectedUser.status, 401)

    const badLogin = await api('/api/admin/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: 'incorrect password' }),
    })
    assert.equal(badLogin.status, 401)

    const login = await api('/api/admin/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    assert.equal(login.status, 200)
    assert.deepEqual(await login.json(), { authenticated: true })
    const setCookie = login.headers.getSetCookie()[0]
    assert.match(setCookie, /HttpOnly/)
    assert.match(setCookie, /Secure/)
    assert.match(setCookie, /SameSite=Strict/)
    const cookie = setCookie.split(';')[0]
    assert.doesNotMatch(setCookie, new RegExp(username))
    assert.doesNotMatch(setCookie, new RegExp(password))

    const overview = await api('/api/admin/overview', { headers: { Cookie: cookie } })
    assert.equal(overview.status, 200)
    assert.deepEqual(await overview.json(), { organization: 'Sunset Esports', established: 2026, sessionExpiresIn: '4 hours' })

    const adminContent = await api('/api/admin/site-content', { headers: { Cookie: cookie } })
    assert.equal(adminContent.status, 200)
    const content = await adminContent.json()
    assert.equal(content.hero.headlineTop, 'OWN THE')
    content.hero.headlineTop = 'OWN IT'
    content.milestones[0].date = 'THE OPENING CHAPTER'
    const savedContent = await api('/api/admin/site-content', { method: 'PUT', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(content) })
    assert.equal(savedContent.status, 200)
    const publicContent = await api('/api/site-content')
    const publishedContent = await publicContent.json()
    assert.equal(publishedContent.hero.headlineTop, 'OWN IT')
    assert.equal(publishedContent.milestones[0].date, 'THE OPENING CHAPTER')
    content.unexpectedKey = 'not allowed'
    const invalidContent = await api('/api/admin/site-content', { method: 'PUT', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(content) })
    assert.equal(invalidContent.status, 400)

    const logout = await api('/api/admin/logout', { method: 'POST', headers: { Cookie: cookie } })
    assert.equal(logout.status, 200)
    assert.match(logout.headers.getSetCookie()[0], /Max-Age=0/)
    const revokedSession = await api('/api/admin/overview', { headers: { Cookie: cookie } })
    assert.equal(revokedSession.status, 401)
  } finally {
    if (server.exitCode === null) {
      const exited = once(server, 'exit')
      server.kill()
      await exited
    }
    await rm(contentDirectory, { recursive: true, force: true })
  }
})
