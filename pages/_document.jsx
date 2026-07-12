import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Match system chrome to dark/light page background — prevents floaty nav on mobile */}
        <meta name="theme-color" content="#201E1C" media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content="#F8F6F4" media="(prefers-color-scheme: light)" />
        <meta name="robots" content="index, follow" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="apple-touch-icon" href="/social-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        {/* iOS PWA — required for full-screen standalone mode on iPhone/iPad */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="RatedNews" />
        {/* No fallback og:image here — _document tags can't be deduped by
            next/head, so a global one double-emitted alongside each page's own
            card, and some scrapers (LinkedIn/Telegram) take the last (generic)
            one. Every content page sets its own og:image; error/utility pages
            don't need a share card. */}
        {/* Preconnect to Supabase — saves DNS+TLS round trip on first data fetch */}
        <link rel="preconnect" href={process.env.VITE_SUPABASE_URL} />
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
      </Head>
      <body>
        {/* Runs before React hydrates — prevents dark mode flash */}
        {/* Default to dark mode — apply light only if user has explicitly chosen it */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('theme');var dark=t!=='light';var bg=dark?'#201E1C':'#F8F6F4';document.documentElement.setAttribute('data-theme',dark?'dark':'light');document.documentElement.style.background=bg;document.body.style.background=bg;}catch(e){}})()`  }} />
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
