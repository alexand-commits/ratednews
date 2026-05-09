import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Match system chrome to dark/light page background — prevents floaty nav on mobile */}
        <meta name="theme-color" content="#111110" media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content="#F8F6F4" media="(prefers-color-scheme: light)" />
        <meta name="robots" content="index, follow" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="apple-touch-icon" href="/social-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        {/* Fallback OG image for any page that doesn't set its own */}
        <meta property="og:image"        content="https://ratednews.com/og-image.png" />
        <meta property="og:image:type"   content="image/png" />
        <meta property="og:image:width"  content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card"        content="summary_large_image" />
        <meta name="twitter:image"       content="https://ratednews.com/og-image.png" />
        {/* Preconnect to Supabase — saves DNS+TLS round trip on first data fetch */}
        <link rel="preconnect" href={process.env.VITE_SUPABASE_URL} />
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
      </Head>
      <body>
        {/* Runs before React hydrates — prevents dark mode flash */}
        {/* Default to dark mode — apply light only if user has explicitly chosen it */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('theme');var dark=t!=='light';var bg=dark?'#111110':'#F8F6F4';document.documentElement.setAttribute('data-theme',dark?'dark':'light');document.documentElement.style.background=bg;document.body.style.background=bg;}catch(e){}})()`  }} />
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
