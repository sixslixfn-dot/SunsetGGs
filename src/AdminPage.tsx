import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { defaultContent, type SiteContent } from './site-content'
import './admin.css'
import './admin-editor.css'

type ApiMessage = { authenticated?: boolean; message?: string }
type ContentField = { path: string[]; label: string; value: string }

function SunsetMark() {
  return <img className="sunset-mark" src="/images/sunset-mark.svg" alt="" aria-hidden="true" />
}

function flattenContent(value: unknown, path: string[] = []): ContentField[] {
  if (typeof value === 'string') {
    const label = path.map((part) => part.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' ')).join(' / ')
    return [{ path, label, value }]
  }
  if (Array.isArray(value)) return value.flatMap((item, index) => flattenContent(item, [...path, String(index + 1).padStart(2, '0')]))
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([key, child]) => flattenContent(child, [...path, key]))
  return []
}

function updateAtPath(content: SiteContent, path: string[], value: string): SiteContent {
  const next = structuredClone(content) as Record<string, unknown>
  let current: Record<string, unknown> | unknown[] = next
  for (const part of path.slice(0, -1)) {
    current = Array.isArray(current)
      ? current[Number(part) - 1] as Record<string, unknown> | unknown[]
      : current[part] as Record<string, unknown> | unknown[]
  }
  const last = path[path.length - 1]
  if (Array.isArray(current)) current[Number(last) - 1] = value
  else current[last] = value
  return next as SiteContent
}

async function getAdminContent(): Promise<SiteContent> {
  const response = await fetch('/api/admin/site-content', { credentials: 'same-origin', cache: 'no-store' })
  if (!response.ok) throw new Error('Could not load website copy. Please sign in again.')
  return response.json() as Promise<SiteContent>
}

export default function AdminPage() {
  const [signedIn, setSignedIn] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [siteContent, setSiteContent] = useState<SiteContent>(defaultContent)
  const [previewVersion, setPreviewVersion] = useState(0)

  const fields = useMemo(() => flattenContent(siteContent), [siteContent])
  const visibleFields = useMemo(() => {
    const query = search.trim().toLowerCase()
    return query ? fields.filter((field) => field.label.toLowerCase().includes(query) || field.value.toLowerCase().includes(query)) : fields
  }, [fields, search])

  const checkSession = useCallback(async () => {
    setCheckingSession(true)
    try {
      const response = await fetch('/api/admin/session', { credentials: 'same-origin', cache: 'no-store' })
      const result = await response.json() as ApiMessage
      if (response.ok && result.authenticated) {
        setSiteContent(await getAdminContent())
        setSignedIn(true)
        setMessage('')
      } else {
        setSignedIn(false)
        if (response.status === 503) setMessage(result.message ?? 'Admin sign-in is not configured yet.')
      }
    } catch {
      setMessage('The secure admin service could not be reached. Start the full development server and try again.')
    } finally {
      setCheckingSession(false)
    }
  }, [])

  useEffect(() => { void checkSession() }, [checkSession])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    const formData = new FormData(formElement)
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: formData.get('username'), password: formData.get('password') }),
      })
      const result = await response.json() as ApiMessage
      if (!response.ok) throw new Error(result.message ?? 'Sign-in failed. Please try again.')
      formElement.reset()
      setSiteContent(await getAdminContent())
      setSignedIn(true)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Sign-in failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function saveContent() {
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch('/api/admin/site-content', {
        method: 'PUT',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(siteContent),
      })
      const result = await response.json() as ApiMessage
      if (!response.ok) throw new Error(result.message ?? 'Changes could not be saved.')
      setMessage('Changes published to the website.')
      setPreviewVersion((version) => version + 1)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Changes could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  async function signOut() {
    setBusy(true)
    try {
      await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin', cache: 'no-store' })
    } finally {
      setSignedIn(false)
      setSiteContent(defaultContent)
      setMessage('')
      setBusy(false)
    }
  }

  if (checkingSession) {
    return <main className="admin-page"><div className="admin-atmosphere" /><header className="admin-topbar"><a className="admin-brand" href="/" aria-label="Return to Sunset Esports home"><img className="admin-home-logo" src="/images/sunset-square-mark.jpg" alt="" /><span>SUNSET<small>ESPORTS · EST. 2026</small></span></a></header><section className="admin-card"><div className="admin-card-mark"><SunsetMark /></div><p className="admin-overline">PRIVATE AREA · AUTHORIZED ACCESS ONLY</p><div className="admin-state"><span className="admin-spinner" />Checking your secure session…</div></section></main>
  }

  if (!signedIn) {
    return (
      <main className="admin-page">
        <div className="admin-atmosphere" aria-hidden="true" />
        <header className="admin-topbar"><a className="admin-brand" href="/" aria-label="Return to Sunset Esports home"><img className="admin-home-logo" src="/images/sunset-square-mark.jpg" alt="" /><span>SUNSET<small>ESPORTS · EST. 2026</small></span></a><a className="admin-return" href="/">Return to website <span>↗</span></a></header>
        <section className="admin-card" aria-labelledby="admin-title">
          <div className="admin-card-mark"><SunsetMark /></div><p className="admin-overline">PRIVATE AREA · AUTHORIZED ACCESS ONLY</p><p className="admin-eyebrow">SUNSET ESPORTS · ADMIN</p><h1 id="admin-title">SIGN <em>IN.</em></h1><p className="admin-description">Sign in with the private admin432 account to edit the public website.</p>
          <form className="admin-form" onSubmit={handleSubmit}>
            <label htmlFor="admin-username">USERNAME</label><input id="admin-username" name="username" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={64} />
            <label htmlFor="admin-password">PASSWORD</label><input id="admin-password" name="password" type="password" autoComplete="current-password" required maxLength={1024} />
            {message && <p className="admin-message" role="alert">{message}</p>}
            <button className="admin-button" type="submit" disabled={busy}>{busy ? 'Verifying…' : 'Secure sign in'} <span>↗</span></button>
          </form>
        </section>
        <footer className="admin-footer"><span>PRIVATE EDITOR · ADMIN432 ONLY</span><span>© 2026 SUNSET ESPORTS</span></footer>
      </main>
    )
  }

  return (
    <main className="admin-editor">
      <header className="editor-toolbar">
        <a className="admin-brand" href="/" aria-label="Return to Sunset Esports home"><img className="admin-home-logo" src="/images/sunset-square-mark.jpg" alt="" /><span>SUNSET<small>WEBSITE EDITOR</small></span></a>
        <div className="editor-toolbar-actions"><span className="editor-account">SIGNED IN · ADMIN432</span><button className="editor-save" type="button" onClick={saveContent} disabled={busy}>{busy ? 'Saving…' : 'Publish changes'} <span>↗</span></button><button className="editor-signout" type="button" onClick={signOut} disabled={busy}>Sign out</button></div>
      </header>
      <div className="editor-workspace">
        <section className="editor-preview" aria-label="Live website preview">
          <div className="editor-preview-label">LIVE WEBSITE PREVIEW <span>YOUR CHANGES APPEAR AFTER PUBLISH</span></div>
          <iframe key={previewVersion} title="Sunset website preview" src="/" />
        </section>
        <aside className="editor-panel" aria-label="Website text editor">
          <div className="editor-panel-heading"><p className="admin-eyebrow">PRIVATE CONTENT STUDIO</p><h1>EDIT THE<br /><em>WEBSITE.</em></h1><p>Change the copy below, then publish to update the live site. No products, layout or images are changed here.</p><div className="editor-count"><span>{fields.length} EDITABLE TEXT FIELDS</span><span>ONLY ADMIN432</span></div></div>
          {message && <p className="editor-message" role="status">{message}</p>}
          <label className="editor-search-label" htmlFor="editor-search">FIND WEBSITE TEXT</label><input className="editor-search" id="editor-search" type="search" placeholder="Search labels or copy" value={search} onChange={(event) => setSearch(event.target.value)} />
          <div className="editor-fields">{visibleFields.map((field) => <label className="editor-field" key={field.path.join('.')}><span>{field.label.replaceAll('.', ' · ')}</span>{field.value.length > 75 ? <textarea rows={4} value={field.value} onChange={(event) => setSiteContent((current) => updateAtPath(current, field.path, event.target.value))} /> : <input type="text" value={field.value} onChange={(event) => setSiteContent((current) => updateAtPath(current, field.path, event.target.value))} />}</label>)}</div>
          <button className="editor-save editor-save-bottom" type="button" onClick={saveContent} disabled={busy}>{busy ? 'Saving…' : 'Publish changes'} <span>↗</span></button>
        </aside>
      </div>
      <footer className="editor-footer"><span>PUBLIC PREVIEW · CHANGES ARE PUBLISHED ONLY WHEN YOU SELECT PUBLISH</span><button type="button" onClick={signOut}>SIGN OUT OF ADMIN432</button></footer>
    </main>
  )
}
