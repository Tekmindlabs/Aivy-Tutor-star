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

    // ONNX Runtime Configuration
    if (!isServer) {
      // Client-side: Use ONNX runtime web
      config.resolve.alias = {
        ...config.resolve.alias,
        'onnxruntime-node': 'onnxruntime-web'
      };
    } else {
      // Server-side: Use ONNX runtime node
      config.externals = [
        ...(config.externals || []),
        { 'onnxruntime-node': 'onnxruntime-node' }
      ];
      
      // Add proper node-loader configuration with unique names
      config.module.rules.push({
        test: /\.node$/,
        loader: 'node-loader',
        options: {
          name: '[name].[hash].[ext]', // Add hash to ensure unique filenames
        }
      });
    }

    // Prevent multiple compilations of the same asset
    config.output = {
      ...config.output,
      uniqueName: isServer ? 'server' : 'client',
    };

    return config;
  },
  // Add experimental features to handle native dependencies
  experimental: {
    serverComponentsExternalPackages: ['onnxruntime-node']
  }
};

module.exports = nextConfig;