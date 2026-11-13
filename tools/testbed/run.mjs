// Drives the test bed built by setup.mjs: syncs the extension, starts the
// fake LLM server and the bed's SillyTavern on free ports, and in headless
// Chromium generates a theme, sees playback start, stops it, downloads the
// .mid, then makes the score call fail each way the fake can and records what
// the user is told. Writes a table to --out and prints a short summary; exits
// 1 when a check fails.
//
// Usage: node tools/testbed/run.mjs --bed <bed folder> --pw <folder whose
// node_modules holds playwright-core> [--out <results file>]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { startFakeLlm } from './fake-llm.mjs';
import { syncExtension } from './sync.mjs';

const { values } = parseArgs({
    options: { bed: { type: 'string' }, pw: { type: 'string' }, out: { type: 'string' } },
});
const bed = values.bed ?? process.env.LEITMOTIF_BED;
const pwFolder = values.pw ?? process.env.LEITMOTIF_PW;
if (!bed || !pwFolder) {
    console.error('Usage: node tools/testbed/run.mjs --bed <bed folder> --pw <playwright-core folder> [--out <file>]');
    process.exit(2);
}
const out = values.out ?? path.join(bed, 'results.txt');
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const user = path.join(bed, 'data', 'default-user');
const { chromium } = createRequire(path.join(pwFolder, 'package.json'))('playwright-core');

const IDLE_WITH_THEME = 'Theme ready. Generate another or download the MIDI.';
// What the extension's own toast must tell the user per failure. SillyTavern's
// server passes on only the provider's HTTP status text, never its body (its
// chat-completions endpoint), so that text is what the toast can name.
const FAILURES = [
    { mode: 'refused', toast: /Unauthorized/ },
    { mode: 'error500', toast: /Internal Server Error/ },
    { mode: 'cut', toast: /./ },
    { mode: 'invalid', toast: /./ },
];

const rows = [];
function check(name, ok, detail = '') {
    rows.push({ name, ok: Boolean(ok), detail: String(detail).replace(/\s+/g, ' ').slice(0, 300) });
}

function freePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.on('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address();
            server.close(() => resolve(port));
        });
    });
}

async function waitForHttp(url, timeoutMs) {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                return;
            }
        } catch {
            // Not listening yet: try again below.
        }
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    throw new Error(`${url} did not answer within ${timeoutMs} ms`);
}

async function toggleLabel(page) {
    return (await page.locator('#st_leitmotif_toggle').textContent())?.trim();
}

async function statusText(page) {
    return (await page.locator('.st-leitmotif-status').first().textContent())?.trim();
}

// Opens the Extensions (wand) menu and clicks the extension's entry, as a user would.
async function clickToggle(page) {
    if (!await page.locator('#st_leitmotif_toggle').isVisible()) {
        await page.locator('#extensionsMenuButton').click();
    }
    await page.locator('#st_leitmotif_toggle').click();
}

async function waitForLabel(page, label, timeoutMs) {
    await page.waitForFunction(
        text => document.querySelector('#st_leitmotif_toggle')?.textContent.trim() === text,
        label,
        { timeout: timeoutMs, polling: 250 },
    );
}

async function scenarios(page, fake) {
    await page.waitForFunction(() => globalThis.SillyTavern?.getContext?.().characters?.length > 0, null, { timeout: 60000 });
    await page.waitForSelector('#st_leitmotif_toggle', { state: 'attached', timeout: 30000 });
    await page.evaluate(async () => {
        const context = SillyTavern.getContext();
        await context.selectCharacterById(0);
    });
    await page.waitForFunction(() => SillyTavern.getContext().characterId !== undefined, null, { timeout: 30000 });

    // Generate, playback starts.
    fake.setMode('ok');
    await clickToggle(page);
    let playing = true;
    try {
        await waitForLabel(page, 'Stop Theme', 90000);
    } catch {
        playing = false;
    }
    const kinds = fake.calls.map(call => call.kind).join(',');
    check('generate: playback starts (toolbar reads Stop Theme)', playing, `status "${await statusText(page)}"; calls ${kinds}`);

    // Stop.
    await clickToggle(page);
    let stopped = true;
    try {
        await waitForLabel(page, 'Generate Theme', 10000);
    } catch {
        stopped = false;
    }
    check('stop: toolbar back to Generate Theme', stopped, `status "${await statusText(page)}"`);

    // Download the .mid.
    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
    await page.locator('#st_leitmotif_download').dispatchEvent('click');
    try {
        const download = await downloadPromise;
        const file = path.join(bed, 'theme.mid');
        await download.saveAs(file);
        const header = fs.readFileSync(file).subarray(0, 4).toString('latin1');
        check('download: a .mid file with a MIDI header', download.suggestedFilename().endsWith('.mid') && header === 'MThd',
            `${download.suggestedFilename()}, ${fs.statSync(file).size} bytes, header ${header}`);
    } catch (error) {
        check('download: a .mid file with a MIDI header', false, error.message);
    }

    // Each failure of the score call: what the user is told, and the theme
    // already made stays ready to download.
    for (const failure of FAILURES) {
        fake.setMode(failure.mode);
        await page.evaluate(() => globalThis.toastr?.clear());
        await page.waitForTimeout(500);
        await clickToggle(page);
        let toast = '';
        try {
            const own = page.locator('#toast-container .toast-error', { hasText: 'Leitmotif' });
            await own.first().waitFor({ timeout: 60000 });
            toast = (await own.first().textContent())?.trim() ?? '';
            await waitForLabel(page, 'Generate Theme', 10000);
        } catch (error) {
            toast ||= `(no error toast: ${error.message.split('\n')[0]})`;
        }
        const status = await statusText(page);
        check(`${failure.mode}: user is told why`, failure.toast.test(toast) && !toast.startsWith('(no error toast'), `toast "${toast}"`);
        check(`${failure.mode}: status keeps the loaded theme`, status === IDLE_WITH_THEME, `status "${status}"`);
    }
    fake.setMode('ok');
}

async function main() {
    syncExtension(repo, path.join(user, 'extensions', 'SillyTavern-Extension-Leitmotif'));
    const fake = await startFakeLlm(0);
    const template = fs.readFileSync(path.join(bed, 'settings.template.json'), 'utf8');
    fs.writeFileSync(path.join(user, 'settings.json'), template.replaceAll('{FAKE_PORT}', String(fake.port)));

    const port = await freePort();
    const log = fs.openSync(path.join(bed, 'sillytavern.log'), 'w');
    const server = spawn(process.execPath, [
        'server.js', '--port', String(port), '--listen', 'false', '--browserLaunchEnabled', 'false',
        '--dataRoot', path.join(bed, 'data'),
    ], { cwd: path.join(bed, 'SillyTavern'), stdio: ['ignore', log, log], windowsHide: true });

    let browser;
    const consoleErrors = [];
    try {
        await waitForHttp(`http://127.0.0.1:${port}/`, 120000);
        browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
        const context = await browser.newContext({ acceptDownloads: true });
        const page = await context.newPage();
        page.on('console', message => {
            if (message.type() === 'error' && message.text().includes('[Leitmotif]')) {
                consoleErrors.push(message.text());
            }
        });
        await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
        await scenarios(page, fake);
    } catch (error) {
        check('bed ran to the end', false, error.message.split('\n')[0]);
    } finally {
        await browser?.close();
        server.kill();
        await fake.close();
    }

    const table = rows.map(row => `${row.ok ? 'PASS' : 'FAIL'}\t${row.name}\t${row.detail}`).join('\n');
    fs.writeFileSync(out, `${table}\n\nLeitmotif console errors:\n${consoleErrors.join('\n')}\n`);
    const failed = rows.filter(row => !row.ok);
    console.log(`test bed: ${rows.length - failed.length}/${rows.length} checks pass; table in ${out}`);
    for (const row of failed.slice(0, 8)) {
        console.log(`FAIL ${row.name}: ${row.detail.slice(0, 160)}`);
    }
    process.exit(failed.length > 0 ? 1 : 0);
}

await main();
