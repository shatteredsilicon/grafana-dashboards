import { globSync } from 'glob';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import builtins from 'rollup-plugin-node-builtins';

import rawAsset from './rollup-plugin-raw-asset.js';

export default {
  input: Object.fromEntries(
    globSync('src/**/*.ts').map(file => [
      path.relative(
        'src',
        file.slice(0, file.length - path.extname(file).length)
      ),
      fileURLToPath(new URL(file, import.meta.url))
    ])
  ),
  output: {
    format: 'system',
    dir: "./dist"
  },
  external: ['app/plugins/sdk', 'app/core/config', 'app/core/utils/kbn', 'app/core/app_events', 'app/core/time_series2', 'app/core/utils/datemath', 'lodash', 'jquery', 'moment'],
  plugins: [
    resolve({
      browser: true
    }),
    commonjs({}),
    typescript({
      tsconfig: './tsconfig.json'
    }),
    builtins(),
    rawAsset(['md'])
  ]
};
