// A fake OpenAI-style chat completion server for the test bed. It answers the
// extension's two calls (the music brief, then the score) and fails on demand
// the ways a real provider can: key refused, 500, reply cut mid-body, invalid
// JSON. The failure applies to the score call; the brief call always answers.
import http from 'node:http';

export const FAKE_MODES = Object.freeze(['ok', 'refused', 'error500', 'cut', 'invalid']);

const BRIEF = {
    backdrop: 'A lighthouse on a cold northern coast',
    action: 'Keeping the lamp lit through storms',
    twist: 'She has never seen the sea by day',
    traits: ['steadfast', 'quiet', 'warm'],
    arc: 'quiet, builds, releases',
    genre_references: ['Nordic folk', 'ambient'],
    era: 'modern',
    key: 'D minor',
    mode: 'dorian',
    feel: 'straight',
    meter: '4/4',
    tempo: 80,
    energy_curve: ['low', 'rise', 'full', 'fall'],
    density: 'balanced',
    motif: { notes: ['D4', 'F4', 'A4'], rhythm: [1, 0.5, 1.5], character: 'a rising call' },
    timbre: { harmony: 'warm pad', bass: 'soft bass', melody: 'flute', counter: null, texture: null },
    harmony_flavor: 'modal, open fifths',
    surprise: 'a major chord in bar 3',
};

const SCORE = {
    tempo: 80,
    meter: '4/4',
    tracks: [
        {
            role: 'melody',
            instrument: 'flute',
            events: [
                { beat: 0, duration: 1, velocity: 90, notes: ['D4'] },
                { beat: 1, duration: 0.5, velocity: 80, notes: ['F4'] },
                { beat: 2, duration: 2, velocity: 85, notes: ['A4'] },
            ],
        },
        {
            role: 'bass',
            instrument: 'acoustic_bass',
            events: [
                { beat: 0, duration: 4, velocity: 90, notes: ['D2'] },
                { beat: 4, duration: 4, velocity: 90, notes: ['A1'] },
            ],
        },
    ],
};

function completion(content) {
    return {
        id: 'chatcmpl-fake',
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'fake-model',
        choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    };
}

function send(res, status, body) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
}

// Starts the server on 127.0.0.1 and the given port (0: any free one).
export function startFakeLlm(port = 0) {
    let mode = 'ok';
    const calls = [];
    const server = http.createServer((req, res) => {
        let raw = '';
        req.on('data', chunk => { raw += chunk; });
        req.on('end', () => {
            if (req.method === 'GET' && req.url.endsWith('/models')) {
                send(res, 200, { object: 'list', data: [{ id: 'fake-model', object: 'model' }] });
                return;
            }
            let body = {};
            try {
                body = JSON.parse(raw);
            } catch {
                // A body that is no JSON is answered like a brief call below.
            }
            const system = (body.messages ?? []).map(message => String(message.content)).join('\n');
            const kind = system.includes('music analyst') ? 'brief' : 'score';
            calls.push({ kind, mode: kind === 'brief' ? 'ok' : mode });
            if (kind === 'brief') {
                send(res, 200, completion(JSON.stringify(BRIEF)));
                return;
            }
            switch (mode) {
                case 'refused':
                    send(res, 401, { error: { message: 'Incorrect API key provided: fake-key.', type: 'invalid_request_error', code: 'invalid_api_key' } });
                    return;
                case 'error500':
                    send(res, 500, { error: { message: 'The fake server had an error while processing your request.', type: 'server_error' } });
                    return;
                case 'cut': {
                    const text = JSON.stringify(completion(JSON.stringify(SCORE)));
                    res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': String(text.length) });
                    res.write(text.slice(0, Math.floor(text.length / 2)));
                    setTimeout(() => res.socket?.destroy(), 50);
                    return;
                }
                case 'invalid':
                    send(res, 200, completion('Here is your theme: {"tempo": 80, "tracks": [ {"role": "melody"'));
                    return;
                default:
                    send(res, 200, completion(JSON.stringify(SCORE)));
            }
        });
    });
    return new Promise(resolve => {
        server.listen(port, '127.0.0.1', () => {
            resolve({
                port: server.address().port,
                calls,
                setMode(next) {
                    if (!FAKE_MODES.includes(next)) {
                        throw new Error(`Unknown fake mode ${next}`);
                    }
                    mode = next;
                },
                close: () => new Promise(done => server.close(done)),
            });
        });
    });
}
