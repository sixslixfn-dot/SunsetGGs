import { useEffect, useState } from 'react'
import type { MouseEvent } from 'react'
import AdminPage from './AdminPage'
import './merch.css'
import { defaultContent, type SiteContent } from './site-content'

const sectionRoutes: Record<string, string> = { '/story': 'story', '/journey': 'journey', '/join': 'join' }
let activeScrollFrame = 0

function smoothScrollToSection(targetId: string) {
  const target = document.getElementById(targetId)
  if (!target) return
  if (activeScrollFrame) window.cancelAnimationFrame(activeScrollFrame)

  const headerOffset = window.matchMedia('(max-width: 650px)').matches ? 68 : 82
  const start = window.scrollY
  const destination = Math.max(0, target.getBoundingClientRect().top + start - headerOffset)
  const distance = destination - start

  if (Math.abs(distance) < 4) {
    window.scrollTo({ top: destination, behavior: 'auto' })
    return
  }

  const duration = Math.min(1600, Math.max(850, Math.abs(distance) * 0.65))
  let startTime = 0
  const animate = (now: number) => {
    if (!startTime) startTime = now
    const progress = Math.min((now - startTime) / duration, 1)
    const eased = progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2
    window.scrollTo(0, start + distance * eased)
    if (progress < 1) activeScrollFrame = window.requestAnimationFrame(animate)
    else activeScrollFrame = 0
  }
  activeScrollFrame = window.requestAnimationFrame(animate)
}

function handleSectionNavigation(event: MouseEvent<HTMLAnchorElement>, path: string) {
  const targetId = sectionRoutes[path]
  if (!targetId || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  window.history.pushState({}, '', path)
  smoothScrollToSection(targetId)
}

function Brand({ content, footer = false, onClick }: { content: SiteContent; footer?: boolean; onClick?: () => void }) {
  return (
    <a className={`brand ${footer ? 'brand-footer' : ''}`} href="/" onClick={onClick} aria-label="Sunset Esports home">
      <img className="sunset-mark" src={footer ? '/images/sunset-mark.svg' : '/images/sunset-square-mark.jpg'} alt="" aria-hidden="true" />
      <span className="brand-name">{content.brand.name}<small>{content.brand.subtitle}</small></span>
    </a>
  )
}

function MerchPage({ content }: { content: SiteContent }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)

  return (
    <div className="merch-page">
      <header className="site-header">
        <Brand content={content} onClick={closeMenu} />
        <button className={`menu-toggle ${menuOpen ? 'is-open' : ''}`} type="button" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
          <span /><span />
        </button>
        <nav className={menuOpen ? 'nav-open' : ''} aria-label="Main navigation">
          <a href="/story" onClick={closeMenu}>{content.navigation.story}</a>
          <a href="/journey" onClick={closeMenu}>{content.navigation.journey}</a>
          <a href="/join" onClick={closeMenu}>{content.navigation.join}</a>
          <a href="/merch" aria-current="page" onClick={closeMenu}>{content.navigation.merch}</a>
          <a className="nav-cta" href="/join" onClick={closeMenu}>{content.navigation.cta} <span>↗</span></a>
        </nav>
      </header>
      <main className="merch-main">
        <div className="merch-background" aria-hidden="true" />
        <div className="merch-shade" aria-hidden="true" />
        <section className="merch-content" aria-labelledby="merch-title">
          <p className="merch-kicker"><span /> {content.merch.kicker} <span /></p>
          <img className="merch-emblem" src="/images/sunset-gold-logo.png" alt="" aria-hidden="true" />
          <p className="merch-status">{content.merch.status}</p>
          <h1 id="merch-title">{content.merch.headlineTop}<br /><em>{content.merch.headlineBottom}</em></h1>
          <p className="merch-description">{content.merch.description}</p>
          <a className="button button-primary" href="/">{content.merch.button} <span>↗</span></a>
        </section>
        <div className="merch-bottomline"><span>{content.merch.footer}</span><i /><span>{content.hero.established}</span></div>
      </main>
    </div>
  )
}

function SunsetSite({ content, contentReady }: { content: SiteContent; contentReady: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)

  useEffect(() => {
    const targetId = sectionRoutes[window.location.pathname]
    if (!targetId || !contentReady) return
    const firstFrame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => smoothScrollToSection(targetId))
    })
    return () => window.cancelAnimationFrame(firstFrame)
  }, [contentReady])

  useEffect(() => {
    const handlePopState = () => {
      const targetId = sectionRoutes[window.location.pathname]
      if (targetId) smoothScrollToSection(targetId)
      else if (window.location.pathname === '/') window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  return (
    <>
      <header className="site-header">
        <Brand content={content} onClick={closeMenu} />
        <button className={`menu-toggle ${menuOpen ? 'is-open' : ''}`} type="button" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
          <span /><span />
        </button>
        <nav className={menuOpen ? 'nav-open' : ''} aria-label="Main navigation">
          <a href="/story" onClick={(event) => { closeMenu(); handleSectionNavigation(event, '/story') }}>{content.navigation.story}</a>
          <a href="/journey" onClick={(event) => { closeMenu(); handleSectionNavigation(event, '/journey') }}>{content.navigation.journey}</a>
          <a href="/join" onClick={(event) => { closeMenu(); handleSectionNavigation(event, '/join') }}>{content.navigation.join}</a>
          <a href="/merch" onClick={closeMenu}>{content.navigation.merch}</a>
          <a className="nav-cta" href="/join" onClick={(event) => { closeMenu(); handleSectionNavigation(event, '/join') }}>{content.navigation.cta} <span>↗</span></a>
        </nav>
      </header>

      <main>
        <section className="hero" id="home" aria-labelledby="hero-title">
          <div className="hero-banner" aria-hidden="true" />
          <div className="hero-shade" aria-hidden="true" />
          <div className="hero-content">
            <div className="hero-lockup">
              <span className="hero-right-lockup">
                <img className="hero-gold-mark" src="/images/sunset-gold-logo.png" alt="Sunset Esports gold emblem" />
                <span className="hero-side-label hero-year">{content.hero.established}</span>
              </span>
            </div>
            <p className="hero-overline"><span /> {content.hero.organization} <span /></p>
            <h1 id="hero-title">{content.hero.headlineTop}<br /><span>{content.hero.headlineBottom}</span></h1>
            <p className="hero-copy">{content.hero.lineOne}<br />{content.hero.lineTwo}</p>
            <a className="button button-primary" href="/story" onClick={(event) => handleSectionNavigation(event, '/story')}>{content.hero.button} <span>↓</span></a>
          </div>
          <div className="hero-bottomline"><span>{content.hero.footerLeft}</span><i /><span>{content.hero.footerCenter}</span><i /><span>{content.hero.footerRight}</span></div>
          <a className="hero-scroll" href="/story" aria-label={content.hero.scroll} onClick={(event) => handleSectionNavigation(event, '/story')}><span>{content.hero.scroll}</span><i /></a>
        </section>

        <div className="ticker" aria-label="Sunset values">
          <div className="ticker-track">{[...content.ticker, ...content.ticker].map((item, index) => <span className="ticker-item" key={`${item}-${index}`}>{index > 0 && <i>✳</i>}{item}</span>)}</div>
        </div>

        <section className="story section-wrap" id="story">
          <div className="section-kicker"><span>{content.story.kicker}</span><span className="kicker-rule" /></div>
          <div className="story-layout">
            <div className="story-title"><span className="story-index">{content.story.index}</span><h2>{content.story.headlineTop}<br />TO <em>{content.story.headlineBottom}</em></h2></div>
            <div className="story-copy"><p className="lead">{content.story.lead}</p><p>{content.story.description}</p><a className="text-link" href="/journey" onClick={(event) => handleSectionNavigation(event, '/journey')}>{content.story.link} <span>↘</span></a></div>
          </div>
          <div className="principles">
            {content.principles.map((principle) => <article key={principle.eyebrow}><span className="principle-number">{principle.eyebrow}</span><h3>{principle.headlineTop}<br />{principle.headlineBottom}</h3><p>{principle.description}</p></article>)}
          </div>
        </section>

        <section className="journey section-wrap" id="journey">
          <div className="section-kicker"><span>{content.journey.kicker}</span><span className="kicker-rule" /></div>
          <div className="journey-heading"><h2>{content.journey.headlineTop}<br />IS <em>{content.journey.headlineBottom}</em></h2><p>{content.journey.descriptionTop}<br />{content.journey.descriptionBottom}</p></div>
          <div className="timeline">{content.milestones.map((milestone) => <article className="milestone" key={milestone.number}><div className="milestone-top"><span>{milestone.number}</span><i /></div><p className="milestone-date">{milestone.date}</p><h3>{milestone.headline}</h3><p className="milestone-copy">{milestone.description}</p></article>)}</div>
          <div className="journey-foot"><span>{content.journey.footer}</span></div>
        </section>

        <section className="join" id="join">
          <div className="join-inner">
            <div className="section-kicker"><span>{content.join.kicker}</span><span className="kicker-rule" /></div>
            <div className="join-layout"><div><p className="join-overline">{content.join.overline}</p><h2>{content.join.headlineTop}<br />AT <em>{content.join.headlineBottom}</em></h2></div><div className="join-aside"><p>{content.join.description}</p><a className="button button-primary" href="mailto:hello@sunsetesports.gg?subject=Sunset%20Esports%20interest">{content.join.button} <span>↗</span></a><small>{content.join.note}</small></div></div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-note">{content.footer.noteTop}<br />{content.footer.noteBottom}</div>
        <div className="footer-links"><a href="/story" onClick={(event) => handleSectionNavigation(event, '/story')}>{content.footer.about}</a><a href="/journey" onClick={(event) => handleSectionNavigation(event, '/journey')}>{content.footer.journey}</a><a href="/join" onClick={(event) => handleSectionNavigation(event, '/join')}>{content.footer.contact}</a></div>
        <div className="footer-social"><a href="/join">{content.footer.community} ↗</a><a href="/join">{content.footer.socials} ↗</a></div>
        <div className="footer-bottom"><span>{content.footer.copyright}</span><a href="/" onClick={(event) => { event.preventDefault(); window.history.pushState({}, '', '/'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>{content.footer.backToTop} ↑</a><span>{content.footer.tagline}</span></div>
      </footer>
    </>
  )
}

export default function App() {
  const [content, setContent] = useState<SiteContent>(defaultContent)
  const [contentReady, setContentReady] = useState(false)
  useEffect(() => {
    fetch('/api/site-content', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() as Promise<SiteContent> : Promise.reject(new Error('Content unavailable')))
      .then(setContent)
      .catch(() => undefined)
      .finally(() => setContentReady(true))
  }, [])
  useEffect(() => {
    document.title = content.seo.title
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (description) description.content = content.seo.description
  }, [content.seo.description, content.seo.title])
  if (window.location.pathname === '/tacos7') return <AdminPage />
  if (window.location.pathname === '/merch') return <MerchPage content={content} />
  return <SunsetSite content={content} contentReady={contentReady} />
}
