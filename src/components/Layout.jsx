import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Nav from './Nav'
import Footer from './Footer'
import AltitudeRail from './AltitudeRail'

/** Reset scroll on route change — the router does not do this by default. */
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])
  return null
}

export default function Layout() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-100 focus:rounded-xs focus:bg-amber focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-void"
      >
        Skip to content
      </a>
      <ScrollToTop />
      <Nav />
      <AltitudeRail />
      <main id="main" className="min-h-dvh">
        <Outlet />
      </main>
      <Footer />
    </>
  )
}
