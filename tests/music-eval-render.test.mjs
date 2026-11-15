// Tests for tools/music-eval/render.mjs: a theme with drums renders.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

test('a score with a drums track renders its view, drums listed by name', () => {
    const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'leitmotif-render-'));
    try {
        const score = { tempo: 90, meter: '4/4', loopBeats: 16, feel: 'swing', tracks: [
            { role: 'melody', instrument: 'flute', events: [{ beat: 0, duration: 1, velocity: 80, notes: ['E5'] }] },
            { role: 'bass', instrument: 'acoustic_bass', events: [{ beat: 0, duration: 4, velocity: 90, notes: ['A1'] }] },
            { role: 'drums', instrument: 'drum_kit', events: [{ beat: 0, duration: 0.5, velocity: 100, notes: ['kick', 'closed_hat'] }] },
        ] };
        fs.writeFileSync(path.join(runDir, 'model--Ada.json'), JSON.stringify({ character: 'Ada', score, brief: null, calls: [] }));
        execFileSync(process.execPath, [path.resolve('tools/music-eval/render.mjs'), runDir], { stdio: 'pipe' });
        assert.match(fs.readFileSync(path.join(runDir, 'views', 'theme-A.txt'), 'utf8'), /drums: 1 events, kick closed_hat/);
    } finally {
        fs.rmSync(runDir, { recursive: true, force: true });
    }
});
