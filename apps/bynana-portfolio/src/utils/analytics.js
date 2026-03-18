const GA_ID = import.meta.env.VITE_GA_ID
const ANALYTICS_SCRIPT_ID = 'bynana-ga-script'

export const initializeAnalytics = () => {
  if (!GA_ID || typeof window === 'undefined' || typeof document === 'undefined') {
    return
  }

  if (document.getElementById(ANALYTICS_SCRIPT_ID)) {
    return
  }

  const script = document.createElement('script')
  script.id = ANALYTICS_SCRIPT_ID
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`
  document.head.appendChild(script)

  window.dataLayer = window.dataLayer || []
  window.gtag =
    window.gtag ||
    function gtag() {
      window.dataLayer.push(arguments)
    }

  window.gtag('js', new Date())
  window.gtag('config', GA_ID)
}
