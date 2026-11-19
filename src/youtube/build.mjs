import * as esbuild from 'esbuild'

esbuild.buildSync({
  entryPoints: ['index.ts'],
  bundle: true,
  minify: true,
  inject: ['./lib/text-polyfill.mjs'],
  sourcemap: false,
  outfile: './dist/youtube.response.preview.js',
})
