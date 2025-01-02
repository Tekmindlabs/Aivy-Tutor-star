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
      // Server-side: Configure node-loader with only valid options
      config.module.rules.push({
        test: /\.node$/,
        use: {
          loader: 'node-loader',
          options: {
            flags: '-r esm' // Optional: Add flags if needed
          }
        }
      });
    }

    return config;
  }
};

module.exports = nextConfig;