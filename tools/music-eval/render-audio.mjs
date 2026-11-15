// Saves generated themes for listening: each score record from generate.mjs
// becomes a .mid written by the extension's MIDI export and a .wav rendered by
// the extension's own playback (shipped samples, drum synth, swing,
// humanisation, master chain) in an OfflineAudioContext, the loop played twice
// plus a short release tail. Runs in headless Chromium against a local static
// server over the repo, one theme at a time. Prints one line per theme with
// the peak and the duration against two loops.
//
// Usage: node tools/music-eval/render-audio.mjs --pw <folder whose node_modules
// holds playwright-core> --out <folder> <record.json> [<record.json>...]
// Each file is named <model>--<character>.mid / .wav after the record.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const { values, positionals } = parseArgs({
    options: { pw: { type: 'string' }, out: { type: 'string' } },
    allowPositionals: true,
});
if (!values.pw || !values.out || positionals.length === 0) {
    console.error('Usage: node render-audio.mjs --pw <playwright-core folder> --out <folder> <record.json>...');
    process.exit(2);
}
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { chromium } = createRequire(path.join(values.pw, 'package.json'))('playwright-core');
const SAMPLE_RATE = 44100;
const TAIL_SECONDS = 2;
const TYPES = { '.mjs': 'text/javascript', '.js': 'text/javascript', '.html': 'text/html' };

// Serves the repo read-only; the page itself is an empty document.
function startServer() {
    const server = http.createServer((request, response) => {
        const urlPath = decodeURIComponent(new URL(request.url, 'http://x').pathname);
        if (urlPath === '/') {
            response.writeHead(200, { 'content-type': 'text/html' }).end('<!doctype html><title>render</title>');
            return;
        }
        const file = path.join(repo, urlPath);
        if (!file.startsWith(repo + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
            response.writeHead(404).end();
            return;
        }
        response.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
        fs.createReadStream(file).pipe(response);
    });
    return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function loadScript(page, url) {
    return page.addScriptTag({ url });
}

// In the page: the MIDI export and the offline render of two passes.
async function renderInPage({ score, sampleRate, tailSeconds }) {
    const playback = await import('/src/playback.mjs');
    const midiExport = await import('/src/midi-export.mjs');
    const midi = new window.MidiWriter.Writer(midiExport.buildTracks(window.MidiWriter, score)).base64();
    const loopLength = score.loopBeats * (60 / score.tempo);
    const context = new OfflineAudioContext(2, Math.ceil((2 * loopLength + tailSeconds) * sampleRate), sampleRate);
    const master = playback.createMasterChain(context);
    const players = await playback.loadScorePlayers(window.Soundfont, context, score, {
        sampleUrlBase: new URL('/samples/', location.href).href,
        destination: master,
        logTag: '[render]',
    });
    const random = playback.createHumanizer();
    playback.schedulePass(score, players, { startTime: 0, random });
    playback.schedulePass(score, players, { startTime: loopLength, random });
    const buffer = await context.startRendering();
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);
    const pcm = new Int16Array(left.length * 2);
    let peak = 0;
    for (let i = 0; i < left.length; i += 1) {
        for (const [channel, sample] of [[0, left[i]], [1, right[i]]]) {
            peak = Math.max(peak, Math.abs(sample));
            pcm[i * 2 + channel] = Math.max(-32768, Math.min(32767, Math.round(sample * 32767)));
        }
    }
    let binary = '';
    const bytes = new Uint8Array(pcm.buffer);
    for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return { midi, pcm: btoa(binary), peak, seconds: buffer.duration, loopLength };
}

function wavFile(pcm, sampleRate) {
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + pcm.length, 4);
    header.write('WAVEfmt ', 8);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(2, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * 4, 28);
    header.writeUInt16LE(4, 32);
    header.writeUInt16LE(16, 34);
    header.write('data', 36);
    header.writeUInt32LE(pcm.length, 40);
    return Buffer.concat([header, pcm]);
}

fs.mkdirSync(values.out, { recursive: true });
const server = await startServer();
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
let failures = 0;
try {
    for (const recordFile of positionals) {
        const record = JSON.parse(fs.readFileSync(recordFile, 'utf8'));
        const name = `${record.model}--${record.character.replace(/\W+/g, '_')}`;
        if (!record.score) {
            console.log(`${name}: no score, skipped`);
            failures += 1;
            continue;
        }
        const page = await browser.newPage();
        try {
            await page.goto(`${origin}/`);
            await loadScript(page, `${origin}/lib/soundfont-player.min.js`);
            await loadScript(page, `${origin}/lib/midiwriter.js`);
            const result = await page.evaluate(renderInPage, { score: record.score, sampleRate: SAMPLE_RATE, tailSeconds: TAIL_SECONDS });
            fs.writeFileSync(path.join(values.out, `${name}.mid`), Buffer.from(result.midi, 'base64'));
            fs.writeFileSync(path.join(values.out, `${name}.wav`), wavFile(Buffer.from(result.pcm, 'base64'), SAMPLE_RATE));
            const ok = result.peak > 0.01 && result.seconds >= 2 * result.loopLength;
            failures += ok ? 0 : 1;
            console.log(`${name}: ${ok ? 'ok' : 'CHECK'} peak ${result.peak.toFixed(3)}, ${result.seconds.toFixed(1)} s for two loops of ${result.loopLength.toFixed(1)} s`);
        } catch (error) {
            failures += 1;
            console.log(`${name}: ERROR ${error.message.split('\n')[0]}`);
        } finally {
            await page.close();
        }
    }
} finally {
    await browser.close();
    server.close();
}
process.exit(failures ? 1 : 0);
