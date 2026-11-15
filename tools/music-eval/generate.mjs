// Runs the extension's own two prompts (brief, then score) against Claude
// models through the Anthropic API, as plain text with the same system prompts,
// token limits and one retry as index.js. Writes each reply, the parsed score
// and its usage. Usage: node generate.mjs <out dir> <label> <model> [<model>...]
// Needs ANTHROPIC_API_KEY; stops before the ledger in <out dir> passes the cap.
import fs from 'node:fs';
import path from 'node:path';
import { buildCharacterProfile } from '../../src/character.mjs';
import { BRIEF_RESPONSE_LENGTH, getBriefPrompt, parseBrief, sampleVarietySeed } from '../../src/brief.mjs';
import { COMPOSER_SYSTEM_PROMPT, getComposerPrompt, getComposerRetryPrompt, getScoreResponseLength } from '../../src/composer.mjs';
import { getLoopBars, METERS, parseScore } from '../../src/score.mjs';

const CAP_USD = 7.9;
// USD per million tokens (input, output); a conservative guess, not a price list.
const PRICES = { 'claude-sonnet-5-5': [3, 15], 'claude-opus-5-5': [5, 25], 'claude-haiku-5-5': [1, 5] };
const BRIEF_SYSTEM = 'You are a music analyst. Return valid JSON only, following the requested brief schema exactly.';
const LENGTH_SECONDS = 30;

const [outDir, label, ...models] = process.argv.slice(2);
if (!outDir || !label || models.length === 0) {
    console.error('usage: node generate.mjs <out dir> <label> <model> [<model>...]');
    process.exit(2);
}
const ledgerFile = path.join(outDir, 'ledger.json');
fs.mkdirSync(path.join(outDir, label), { recursive: true });
const ledger = fs.existsSync(ledgerFile) ? JSON.parse(fs.readFileSync(ledgerFile, 'utf8')) : { usd: 0, calls: [] };

function mulberry32(seed) {
    return () => {
        seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

async function call(model, system, prompt, maxTokens) {
    if (ledger.usd >= CAP_USD) {
        throw new Error(`Spending cap reached (${ledger.usd.toFixed(2)} USD).`);
    }
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
        },
        // Streamed: Node's fetch drops a reply whose headers take over five
        // minutes, and a long score from a slow model does.
        body: JSON.stringify({ model, max_tokens: maxTokens, system, stream: true, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!response.ok) {
        throw new Error(`${model}: ${response.status} ${await response.text()}`);
    }
    const usage = { input_tokens: 0, output_tokens: 0 };
    let text = '';
    let stop = null;
    let buffer = '';
    for await (const chunk of response.body.pipeThrough(new TextDecoderStream())) {
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines.filter(entry => entry.startsWith('data: '))) {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'message_start') usage.input_tokens = event.message.usage.input_tokens;
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') text += event.delta.text;
            if (event.type === 'message_delta') { usage.output_tokens = event.usage.output_tokens; stop = event.delta.stop_reason; }
            if (event.type === 'error') throw new Error(`${model}: ${event.error.message}`);
        }
    }
    const body = { usage };
    const [inPrice, outPrice] = PRICES[model] ?? [5, 25];
    const usd = (body.usage.input_tokens * inPrice + body.usage.output_tokens * outPrice) / 1e6;
    ledger.usd += usd;
    ledger.calls.push({ model, input: body.usage.input_tokens, output: body.usage.output_tokens, usd });
    fs.writeFileSync(ledgerFile, JSON.stringify(ledger, null, 1));
    return { text, usage, stop };
}

const characters = JSON.parse(fs.readFileSync(new URL('./characters.json', import.meta.url), 'utf8'));

async function run(model, card, index) {
    const character = buildCharacterProfile(card);
    const record = { model, character: card.name, calls: [] };
    const briefPrompt = getBriefPrompt(character, { tempoHint: null });
    let brief = null;
    for (let attempt = 0; attempt < 2 && !brief; attempt += 1) {
        const reply = await call(model, BRIEF_SYSTEM, attempt === 0 ? briefPrompt
            : `${briefPrompt}\n\nYour previous attempt was not valid JSON. Return a complete, compact music brief object only. Do not use markdown or omit closing brackets.`, BRIEF_RESPONSE_LENGTH);
        record.calls.push({ stage: 'brief', ...reply });
        brief = parseBrief(reply.text);
    }
    record.brief = brief;
    const tempo = brief?.tempo ?? 74;
    const meter = brief?.meter ?? '4/4';
    const bars = getLoopBars(LENGTH_SECONDS, tempo, meter);
    const loopBeats = bars * METERS[meter];
    // The same seed per character in every run, so runs differ only by prompt and model.
    const varietySeed = sampleVarietySeed('standard', mulberry32(1000 + index));
    const prompt = getComposerPrompt(character, { brief, bars, loopBeats, tempo, meter, varietySeed });
    record.composerPrompt = prompt;
    let failureReason = '';
    for (let attempt = 0; attempt < 2 && !record.score; attempt += 1) {
        const reply = await call(model, COMPOSER_SYSTEM_PROMPT,
            attempt === 0 ? prompt : getComposerRetryPrompt(prompt, failureReason),
            getScoreResponseLength(bars));
        record.calls.push({ stage: 'score', ...reply });
        try {
            record.score = parseScore(reply.text, { loopBeats, meter, targetTempo: tempo });
        } catch (error) {
            failureReason = error.message;
            record.failure = failureReason;
        }
    }
    return record;
}

// ONLY="model:Name,..." reruns just those themes.
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const jobs = models.flatMap(model => characters.map((card, index) => ({ model, card, index })))
    .filter(({ model, card }) => !only || only.includes(`${model}:${card.name}`));
// Two at a time: enough to finish quickly, few enough to stay under rate limits.
for (let start = 0; start < jobs.length; start += 2) {
    await Promise.all(jobs.slice(start, start + 2).map(async ({ model, card, index }) => {
        const file = path.join(outDir, label, `${model}--${card.name.replace(/\W+/g, '_')}.json`);
        try {
            const record = await run(model, card, index);
            fs.writeFileSync(file, JSON.stringify(record, null, 1));
            console.log(`${model} ${card.name}: ${record.score ? 'ok' : 'FAILED ' + record.failure}`);
        } catch (error) {
            console.log(`${model} ${card.name}: ERROR ${error.message}`);
        }
    }));
}
console.log(`ledger ${ledger.usd.toFixed(3)} USD over ${ledger.calls.length} calls`);
