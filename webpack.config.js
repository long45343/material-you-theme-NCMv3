const path = require("path");
const copyWebpackPlugin = require("copy-webpack-plugin");

module.exports = {
  entry: "./src/main.js",
  output: {
    path: path.resolve(__dirname, "dist"),
  },
  plugins: [
    new copyWebpackPlugin({
      patterns: [
        { from: path.resolve(__dirname, "src", "manifest.json"), to: path.resolve(__dirname, "dist", "manifest.json") },
        { from: path.resolve(__dirname, "src", "preview.gif"), to: path.resolve(__dirname, "dist", "preview.gif") },
      ],
    }),
  ],
  module: {
    rules: [
      { test: /\.(js|jsx)$/i, loader: "babel-loader" },
      { test: /\.css$/i, use: ["style-loader", "css-loader"] },
      { test: /\.s[ac]ss$/i, use: ["style-loader", "css-loader", "sass-loader"] },
      { test: /\.(eot|svg|ttf|woff|woff2|png|jpg|gif)$/i, type: "asset" },
    ],
  },
  performance: { hints: false },
};
