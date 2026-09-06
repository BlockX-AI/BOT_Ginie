/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remove 'output: export' to enable server-side features
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  // Add API route configuration
  async rewrites() {
    if (process.env.NODE_ENV === 'production') {
      return [
        { source: '/api/:path*', destination: 'https://acadcodegen-production.up.railway.app/api/:path*' }
      ];
    }
    return [];
  },
  async redirects() {
    return [
      {
        source: '/pipeline',
        destination: '/smart-contract',
        permanent: false,
      },
    ];
  }
};

module.exports = nextConfig;
