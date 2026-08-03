import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

/* One self-contained dist/index.html. The worker is inlined as a string and
   started from a Blob URL, so the file runs from disk with no server. */
mkdirSync('dist', { recursive: true });

const rawLoader = {
  name: 'raw',
  setup(build) {
    build.onResolve({ filter: /\?raw$/ }, (a) => ({
      path: new URL(a.path.replace(/\?raw$/, ''), 'file://' + a.resolveDir + '/').pathname,
      namespace: 'raw',
    }));
    build.onLoad({ filter: /.*/, namespace: 'raw' }, async (a) => {
      const bundled = await esbuild.build({
        entryPoints: [a.path], bundle: true, write: false, format: 'iife',
        target: 'es2022', platform: 'browser', minify: false,
        loader: { '.ts': 'ts' },
      });
      return { contents: `export default ${JSON.stringify(bundled.outputFiles[0].text)};`, loader: 'js' };
    });
  },
};

const out = await esbuild.build({
  entryPoints: ['src/main.js'],
  bundle: true, write: false, format: 'iife', target: 'es2020',
  plugins: [rawLoader], minify: true, legalComments: 'none',
});

const css = readFileSync('src/styles.css', 'utf8');
const buildId = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const js = `globalThis.__BUILD_ID=${JSON.stringify(buildId)};\n` + out.outputFiles[0].text;
/* Replacement functions, not replacement strings.

   String.replace treats $&, $`, $', $1 ... specially *in the replacement*. The
   minifier is entitled to name a variable `$`, and the moment it emits `$&&$.x`
   the build silently substitutes the matched placeholder into the middle of the
   bundle and truncates the script. The page then renders as a black screen with
   a single SyntaxError, and every source-level test still passes, because they
   bundle from src and never touch this file.

   Passing a function disables that interpretation entirely. */
const html = readFileSync('src/index.html', 'utf8')
  .replace('<!--CSS-->', () => `<style>\n${css}\n</style>`)
  .replace('<!--JS-->', () => `<script>\n${js}\n</script>`);

/* The inlined script must not be able to terminate itself early. */
if (/<\/script/i.test(js)) throw new Error('bundle contains </script — it would truncate the page');
if (html.includes('<!--JS-->') || html.includes('<!--CSS-->')) {
  throw new Error('a placeholder survived into the output — replacement went wrong');
}

writeFileSync('dist/index.html', html);
console.log('dist/index.html', (html.length / 1024).toFixed(0) + ' KB');
