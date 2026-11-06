import { readFile, writeFile } from 'node:fs/promises';

const source = new URL('../device/wedgie_actions.py', import.meta.resolve('wedgie-actions/server'));
const destination = new URL('../device/starproof_actions.py', import.meta.url);
const content = '# Vendored from wedgie-actions; update with npm run sync:device.\n' + await readFile(source, 'utf8');
if (process.argv.includes('--check')) {
  if (await readFile(destination, 'utf8') !== content) throw new Error('Device helper is out of sync. Run npm run sync:device.');
} else {
  await writeFile(destination, content);
  console.log('Updated device/starproof_actions.py from the installed toolkit.');
}
