import CopyWebpackPlugin from 'copy-webpack-plugin';

import path from 'path';

const DIST_DIR = 'dist';

module.exports = {
  watchOptions: {},
  entry: 'src/ssm-text-panel/module.ts',
  cache: {
    type: 'filesystem',
    buildDependencies: {
      config: [__filename],
    },
  },
  context: path.join(process.cwd(), 'src'),
  devtool: false,
  mode: 'production',
  externals: [
    'lodash',
    'jquery',
    'moment',
    'app/plugins/sdk',
    'app/core/config',
    'app/core/utils/kbn',
    'app/core/app_events',
    'app/core/time_series2',
    'app/core/utils/datemath'
  ],
  optimization: {
    minimize: false
  },
  output: {
    clean: {
      keep: new RegExp(`(.*?_(amd64|arm(64)?)(.exe)?|go_plugin_build_manifest)`),
    },
    filename: 'module.js',
    path: path.resolve(process.cwd(), `${DIST_DIR}/ssm-text-panel/`),
    publicPath: '',
    library: {
      type: 'system'
    }
  },
  module: {
    rules: [
      {
        exclude: /(node_modules)/,
        test: /\.(js|jsx|ts|tsx)$/,
        use: {
          loader: 'babel-loader',
          options: {
            targets: "defaults",
            presets: [
              '@babel/preset-env', '@babel/preset-typescript',
            ],
            comments: false
          }
        },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.md$/, // matches imports with ?raw query
        type: 'asset/source', // tells webpack to load the content as a string
      },
      {
        parser: {
          system: false
        }
      }
    ],
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { from: `*.html`, to: '.', context: 'ssm-text-panel', noErrorOnMissing: true },
        { from: `ssm-text-panel/plugin.json`, to: '.' }, // TODO<Add an error for checking the basic structure of the repo>
      ],
    })
  ],

  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
    // handle resolving "rootDir" paths
    modules: [path.resolve(process.cwd()), 'node_modules'],
    unsafeCache: true,
  },
};
