// webpack.config.js
const path = require('path');

module.exports = {
  mode: 'development',
  entry: './src/main.ts',
  devtool: 'source-map',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: '/dist/', // importante para cargar los .wasm desde /dist/
  },

  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
    // ⬇️ Evita que Webpack 5 intente resolver módulos de Node en el navegador
    fallback: {
      fs: false,
      path: false,
      crypto: false,
      stream: false,
      buffer: false,
    },
  },

  module: {
    rules: [
      { test: /\.tsx?$/, use: 'ts-loader', exclude: /node_modules/ },

      // ⬇️ Deja que los codecs .wasm se emitan como ficheros
      { test: /\.wasm$/, type: 'asset/resource' },
    ],
  },

  // ⬇️ Necesario para cargar WASM de @cornerstonejs/* (codecs)
  experiments: {
    asyncWebAssembly: true,
    topLevelAwait: true,
  },

  devServer: {
    static: [
      { directory: path.join(__dirname, 'public') },
      { directory: path.join(__dirname, 'dist') }, // opcional pero útil en dev
    ],
    port: 8080,
    open: true,
    proxy: [
      {
        context: ['/dicom-web', '/wado'],
        target: 'http://localhost:8042',
        changeOrigin: true,
        secure: false,
        // logLevel: 'debug',
      },
    ],
    historyApiFallback: true,
    hot: true,
  },
};
