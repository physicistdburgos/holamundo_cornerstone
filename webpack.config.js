const path = require('path');

module.exports = {
  mode: 'development', // or 'production' for optimization
  entry: './src/main.ts', // main entry file of your app
  devtool: 'source-map', // for easier debugging
  output: {
    filename: 'bundle.js', // generated bundle file
    path: path.resolve(__dirname, 'dist'),
    publicPath: '/dist/'
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'], // file extensions
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/, // handle .ts and .tsx files
        use: 'ts-loader', // TypeScript loader
        exclude: /node_modules/,
      },
    ],
  },
  devServer: {
    static: path.join(__dirname, 'public'), // serves files from public folder
    compress: true,
    port: 8080,
    open: true, // auto-opens browser
  },
};
