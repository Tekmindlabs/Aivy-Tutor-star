/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      crypto: require.resolve('crypto-browserify'),
      stream: require.resolve('stream-browserify'),
      http: require.resolve('stream-http'),        // Add this line
      https: require.resolve('https-browserify'), 
      zlib: require.resolve('browserify-zlib'), // Add this line
      fs: false,
      path: false
    };
    return config;
  }
};

module.exports = nextConfig;