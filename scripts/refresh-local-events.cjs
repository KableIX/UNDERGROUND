const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
const Module = require('node:module');

const data = path.resolve(__dirname, '../apps/mobile/src/data');
const compiled = esbuild.buildSync({
  entryPoints: [path.join(data, 'local-events.ts')],
  platform: 'node',
  format: 'cjs',
  bundle: true,
  write: false,
});
const compiledModule = new Module(__filename);
compiledModule._compile(compiled.outputFiles[0].text, __filename);
const { sources, refreshOrganizer, initialFeeds, discoveryRows } = compiledModule.exports;

async function main() {
  discoveryRows(Date.now(), true);
  const updated = [];
  let refreshed = 0;
  for (const source of sources) {
    try {
      updated.push(await refreshOrganizer(source));
      refreshed++;
    } catch (error) {
      console.error(source.name, error.message);
      const cached = initialFeeds.find((feed) => feed.id === source.id);
      if (cached) updated.push(cached);
    }
  }
  if (!refreshed) throw new Error('All calendars unavailable; saved listings retained.');
  const file = path.join(data, 'local-event-snapshot.json');
  const tmp = file + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(updated, null, 2) + '\n');
  fs.renameSync(tmp, file);
  console.log(
    refreshed,
    'calendars refreshed.',
    updated.reduce((n, f) => n + f.events.length, 0),
    'upcoming listings.',
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
