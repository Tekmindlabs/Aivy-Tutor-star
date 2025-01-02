const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  webpack: (config, { isServer }) => {
    // Existing fallback configuration
    config.resolve.fallback = {
      ...config.resolve.fallback,
      crypto: require.resolve('crypto-browserify'),
      stream: require.resolve('stream-browserify'),
      http: require.resolve('stream-http'),
      https: require.resolve('https-browserify'), 
      zlib: require.resolve('browserify-zlib'),
      fs: false,
      path: false
    };

    // Handle ONNX runtime for different environments
    if (!isServer) {
      // Use ONNX runtime web for client-side
      config.resolve.alias = {
        ...config.resolve.alias,
        'onnxruntime-node': 'onnxruntime-web'
      };
    } else {
      // Configure node-loader for server-side
      config.module.rules.push({
        test: /\.node$/,
        loader: 'node-loader',
        options: {
          name: '[name].[ext]',
        },
      });
    }

    return config;
  }
};

module.exports = nextConfig;