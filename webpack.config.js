module.exports = {
  entry : [`@babel/polyfill`, `./client/index.js`],
  output : {
    path : __dirname, // assumes your bundle.js will be in the root of your project folder
    filename : `./public/bundle.js`,
  },
  devtool : `source-maps`,
  module : {
    rules : [
      {
        test : /\.js$/,
        exclude : /node_modules/,
        use : {
          loader : `babel-loader`,
          options : {
            presets : [`@babel/preset-react`, `@babel/preset-env`],
            plugins : [`@babel/plugin-proposal-class-properties`],
          },
        },
      },
      {
        test : /\.css/,
        use : [
          `style-loader`,
          `css-loader`,
        ],
      },
    ],
  },
}
