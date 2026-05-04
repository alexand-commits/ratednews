import { Html, Head, Main, NextScript } from 'next/document'

const GA_ID = 'G-FK738TW9V4'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta name="theme-color" content="#D85A30" />
        <meta name="robots" content="index, follow" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="apple-touch-icon" href="/favicon.svg" />
        {/* Fallback OG image for any page that doesn't set its own */}
        <meta property="og:image"        content="https://ratednews.com/og-image.png" />
        <meta property="og:image:type"   content="image/png" />
        <meta property="og:image:width"  content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card"        content="summary_large_image" />
        <meta name="twitter:image"       content="https://ratednews.com/og-image.png" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:ital,wght@0,400;0,500;1,400&display=swap"
          rel="stylesheet"
        />
        {/* Google Analytics */}
        <script async src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_ID}', { page_path: window.location.pathname });
            `,
          }}
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
