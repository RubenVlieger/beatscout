/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['i1.sndcdn.com', 'i2.sndcdn.com'],
  },
  experimental: {
    optimizePackageImports: ['three', '@react-three/fiber', '@react-three/drei', '@react-three/postprocessing'],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://backend:8000/api/:path*',
      },
    ]
  },
}

module.exports = nextConfig
