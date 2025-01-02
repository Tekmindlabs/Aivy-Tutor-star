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
      // Client-side: Use ONNX runtime web
      config.resolve.alias = {
        ...config.resolve.alias,
        'onnxruntime-node': 'onnxruntime-web'
      };
      
      // Exclude onnxruntime-node from client bundle
      config.externals = [...(config.externals || []), 'onnxruntime-node'];
    } else {
      // Server-side: Configure node-loader with correct integer flags
      config.module.rules.push({
        test: /\.node$/,
        use: {
          loader: 'node-loader',
          options: {
            flags: 0 // Changed from '-r esm' to 0
          }
        }
      });
    }

    return config;
  }
};

module.exports = nextConfig;