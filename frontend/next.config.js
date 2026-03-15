/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['i1.sndcdn.com', 'i2.sndcdn.com'],
  },
  async rewrites() {
    return [
      {
        source: '/api/backend/:path*',
        destination: 'http://backend:8000/api/:path*',
      },
      {
        source: '/api/auth/:path*',
        destination: 'http://backend:8000/api/auth/:path*',
      },
      {
        source: '/api/waitlist/:path*',
        destination: 'http://backend:8000/api/waitlist/:path*',
      },
    ]
  },
}

module.exports = nextConfig
