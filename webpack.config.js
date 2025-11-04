// webpack.config.js
const path = require('path');

module.exports = {
  mode: 'development', // or 'production' for optimization
  entry: './src/main.ts', // main entry file of your app
  devtool: 'source-map', // for easier debugging
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: '/dist/',
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
    // 👇 Fallbacks para módulos de Node.js que Cornerstone intenta usar
    fallback: {
      fs: false, // no existe en navegador, así que se ignora
      path: require.resolve('path-browserify'), // usa versión de navegador
    },
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  devServer: {
    static: path.join(__dirname, 'public'),
    compress: true,
    port: 8080,
    open: true,
  },
};
