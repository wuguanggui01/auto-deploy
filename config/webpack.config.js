const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin')

module.exports = {
  target: 'node',
  mode: 'production',
  entry: './src/index.ts',
  // devtool: 'inline-source-map',
  output: {
    filename: 'deploy.js',
    path: path.resolve(__dirname, '../lib'),
    libraryTarget: "umd"
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.js$/,
        include: path.resolve(__dirname, "src"),
        exclude: /node_modules/,
        loader: "babel-loader"
      }
    ]
  },
  externals: {
    fs: 'fs',
    path: 'path',
    inquirer: 'inquirer',
    shelljs: 'shelljs',
    ora: 'ora',
    compressing: 'compressing',
    moment: 'moment',
    'node-ssh': 'node-ssh',
    'string-random': 'string-random'
  },
  plugins: [
    new CleanWebpackPlugin()
  ],
  node: {
    // dns: "mock",
    // fs: "empty",
    // path: true,
    // url: false,
    // console: true,
    // global: true,
    // process: true,
    // Buffer: true,
    // __filename: true,
    // __dirname: true,
  }
}