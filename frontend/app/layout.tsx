import './globals.css'
import { Inter, JetBrains_Mono } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

export const metadata = {
  title: 'BeatScout - AI-Powered Edit Discovery',
  description: 'Discover unique edits, remixes, and bootlegs through intelligent audio analysis.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${jetbrainsMono.variable} min-h-screen bg-beatscout-bg antialiased font-sans`}>
        {children}
      </body>
    </html>
  )
}
