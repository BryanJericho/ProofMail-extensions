const path = require('path');
const webpack = require('webpack');

module.exports = {
  entry: './src/content.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'content.js',
  },
  mode: 'production',
  resolve: {
    fallback: {
      // "crypto": false,
      // "stream": false,
      "buffer": require.resolve("buffer/"),
    }
  },
  plugins: [
    // Work around for Buffer is undefined:
    // https://github.com/webpack/changelog-v5/issues/10
    new webpack.ProvidePlugin({
        Buffer: ['buffer', 'Buffer'],
    }),
    new webpack.ProvidePlugin({
        process: 'process/browser',
    }),
  ]
};
