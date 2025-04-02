/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
      ppr: true,
    },
    images: {
      remotePatterns: [
        {
          protocol: 'https',
          hostname: 'chart.googleapis.com',
          port: '',
          pathname: '/chart/**',
        },
      ],
    },
    webpack: (config, { isServer }) => {
      if (!isServer) {
        // Don't resolve 'fs' module on the client to prevent this error
        config.resolve.fallback = {
          fs: false,
          net: false,
          tls: false,
          dns: false,
          child_process: false,
          os: false,
          path: false,
          perf_hooks: false,
          crypto: false,
          stream: false,
        };
      }
      return config;
    },
  };
  
  module.exports = nextConfig;