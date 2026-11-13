// Builds the test bed once: a copy of an existing SillyTavern install (with
// its node_modules, without its data, config or git history; SillyTavern
// writes its default config on first start) in a folder
// outside the repo, a fresh data folder whose settings point the Chat
// Completion "Custom" source at the fake server, and this extension deployed
// as a user extension. run.mjs syncs the extension's code before every run.
//
// Usage: node tools/testbed/setup.mjs --st <SillyTavern folder> --bed <bed folder>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { syncExtension } from './sync.mjs';

const { values } = parseArgs({ options: { st: { type: 'string' }, bed: { type: 'string' } } });
const source = values.st ?? process.env.LEITMOTIF_ST_SOURCE;
const bed = values.bed ?? process.env.LEITMOTIF_BED;
if (!source || !bed) {
    console.error('Usage: node tools/testbed/setup.mjs --st <SillyTavern folder> --bed <bed folder>');
    process.exit(2);
}
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const target = path.join(bed, 'SillyTavern');
const skipped = new Set(['.git', 'backups', 'data', 'config.yaml']);

if (!fs.existsSync(path.join(target, 'server.js'))) {
    fs.cpSync(source, target, {
        recursive: true,
        filter: from => !skipped.has(path.relative(source, from).split(path.sep)[0]),
    });
}

const user = path.join(bed, 'data', 'default-user');
fs.mkdirSync(user, { recursive: true });
const settings = JSON.parse(fs.readFileSync(path.join(target, 'default', 'content', 'settings.json'), 'utf8'));
settings.firstRun = false;
settings.main_api = 'openai';
settings.oai_settings = {
    ...settings.oai_settings,
    chat_completion_source: 'custom',
    custom_url: 'http://127.0.0.1:{FAKE_PORT}/v1',
    custom_model: 'fake-model',
    stream_openai: false,
};
fs.writeFileSync(path.join(bed, 'settings.template.json'), JSON.stringify(settings, null, 4));

syncExtension(repo, path.join(user, 'extensions', 'SillyTavern-Extension-Leitmotif'));
console.log(`Test bed ready in ${bed}`);
