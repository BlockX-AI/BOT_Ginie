const path = require('path');
const webpack = require('webpack');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remove 'output: export' to enable server-side features
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  outputFileTracingRoot: path.join(__dirname),
  async redirects() {
    return [
      {
        source: '/pipeline',
        destination: '/smart-contract',
        permanent: false,
      },
    ];
  },
  webpack: (config, { isServer }) => {
    // Handle optional wagmi connector dependencies that aren't installed
    const optionalDeps = [
      '@coinbase/wallet-sdk',
      '@metamask/sdk',
      '@gemini-wallet/core',
      '@base-org/account',
      '@safe-global/safe-apps-sdk',
      '@safe-global/safe-apps-provider',
      '@walletconnect/ethereum-provider',
      'porto',
      'porto/internal',
    ];

    config.resolve.alias = config.resolve.alias || {};
    optionalDeps.forEach((dep) => {
      config.resolve.alias[dep] = false;
    });

    // Ignore warnings for porto module
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      {
        module: /node_modules\/@wagmi\/connectors/,
        message: /porto/,
      },
    ];

    // Add fallback for node modules in browser
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    return config;
  },
};

module.exports = nextConfig;
