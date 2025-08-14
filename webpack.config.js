// webpack.config.js
const path = require('path');

module.exports = {
  mode: 'development',
  entry: './src/main.ts',           // Ver nota más abajo sobre esta ruta
  devtool: 'source-map',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: '/dist/',
  },
  resolve: { extensions: ['.ts', '.tsx', '.js'] },
  module: {
    rules: [
      { test: /\.tsx?$/, use: 'ts-loader', exclude: /node_modules/ },
    ],
  },
  devServer: {
  static: { directory: path.join(__dirname, 'public') },
  port: 8080,
  open: true,
  proxy: [
    {
      context: ['/dicom-web', '/wado'],   // 👈 añade /wado
      target: 'http://localhost:8042',
      changeOrigin: true,
      secure: false,
      // opcional: logLevel: 'debug'
    },
  ],
  historyApiFallback: true,
},
};
