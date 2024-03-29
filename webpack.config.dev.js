const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const CleanTerminalPlugin = require('clean-terminal-webpack-plugin');
const ReactRefreshPlugin = require('@pmmmwh/react-refresh-webpack-plugin');

module.exports = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.[contenthash].js',
    assetModuleFilename: 'assets/images/[hash][ext][query]'
  },
  resolve: {
    extensions: ['.js', '.jsx'],
  },
  mode: 'development',
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: 'babel-loader'
      },
      {
        test: /\.html$/,
        use: [{ loader: 'html-loader' }]
      },
      {
        test: /\.(s[ac]ss|css)$/,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader',
          'postcss-loader',
          'sass-loader'
        ]
      },

      {
        test: /\.png/,
        type: 'asset/resource'
      },
      {
        test: /\.(woff|woff2|ttf|svg|eot)$/,
        use: {
          loader: 'url-loader',
          options: {
            limit: 10000,
            name: '[name].[ext]',
            outputPath: './assets/fonts/',
            publicPath: './assets/fonts/',
            esModule: false
          }
        }
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      inject: true,
      template: './public/index.html',
      filename: './index.html'
    }),
    new MiniCssExtractPlugin({
      filename: '[name].css'
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, 'src', 'assets/images/'),
          to: 'assets/images'
        }
      ]
    }),
    new CleanTerminalPlugin(),
    new ReactRefreshPlugin()
  ],
  devServer: {
    open: true,
    static: {
      directory: path.join(__dirname, 'dist')
    },
    compress: true,
    port: 3006,
  }
};
