// Copies the extension from the repo into the test bed's extension folder:
// every file but the repo's tooling, git data and the samples, which are
// copied only when the bed has none yet (they are about 300 MB and never
// change between runs).
import fs from 'node:fs';
import path from 'node:path';

const NOT_SHIPPED = new Set(['.git', '.claude', 'tools', 'tests', 'node_modules', 'CLAUDE.md', 'PLAN.md']);

export function syncExtension(repo, target) {
    const hasSamples = fs.existsSync(path.join(target, 'samples'));
    fs.mkdirSync(target, { recursive: true });
    for (const entry of fs.readdirSync(repo)) {
        if (NOT_SHIPPED.has(entry) || (entry === 'samples' && hasSamples)) {
            continue;
        }
        fs.cpSync(path.join(repo, entry), path.join(target, entry), { recursive: true });
    }
}
