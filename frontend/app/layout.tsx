import './globals.css'

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
      <body className="min-h-screen bg-beatscout-bg antialiased">
        {children}
      </body>
    </html>
  )
}
