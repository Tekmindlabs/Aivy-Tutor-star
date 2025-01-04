const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  webpack: (config, { isServer }) => {
    // Fallback configuration
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

    // Combined alias configuration (from both webpack and former babel config)
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'onnxruntime-node': 'onnxruntime-web'
      };
    } else {
      // Server-side configuration
      config.externals = [
        ...(config.externals || []),
        { 'onnxruntime-node': 'onnxruntime-node' }
      ];
      
      config.module.rules.push({
        test: /\.node$/,
        loader: 'node-loader',
        options: {
          name: '[name].[hash].[ext]',
        }
      });
    }

    // Prevent multiple compilations
    config.output = {
      ...config.output,
      uniqueName: isServer ? 'server' : 'client',
    };

    return config;
  },
  // Experimental features
  experimental: {
    serverComponentsExternalPackages: ['langchain', '@langchain/community']
  },
  // Environment variables
  env: {
    JINA_API_KEY: process.env.JINA_API_KEY,
  }
};

module.exports = nextConfig;