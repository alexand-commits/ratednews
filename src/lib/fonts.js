import { Playfair_Display, Lato } from 'next/font/google'

export const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-playfair',
  display: 'swap',
})

export const lato = Lato({
  subsets: ['latin'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  variable: '--font-lato',
  display: 'swap',
})
