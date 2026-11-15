// Salvage of a score reply cut off by the length limit: closeCutScore keeps
// each track up to its last complete bar string (compact form) or event (older
// form) and closes the brackets; reachesLastBar says whether the salvaged
// score still sounds where the loop ends, else parseScore refuses it and the
// caller's retry runs.
import { normalizeResponseText } from './model-response.mjs';

// The arrays whose complete elements are a safe place to cut.
const CUT_AFTER = new Set(['bars', 'events', 'tracks']);
const CLOSER = { '{': '}', '[': ']' };

// The reply's JSON object closed after its last complete bar, event or track;
// null when there is none or the result does not parse (the caller then
// reports the original error). A track cut before its role or its first bar
// or event is left out.
export function closeCutScore(response) {
    const text = normalizeResponseText(response);
    const start = text?.indexOf('{') ?? -1;
    if (start < 0) {
        return null;
    }
    // Each open bracket with the key it was opened under.
    const stack = [];
    let inString = false;
    let stringStart = -1;
    let lastKey = null;
    let cut = null;
    const markCut = (index) => {
        // Only the root object's tracks and the bars or events of its tracks.
        const top = stack.at(-1);
        const tracks = stack[1];
        if (top?.char === '[' && CUT_AFTER.has(top.key)
            && tracks?.char === '[' && tracks.key === 'tracks' && stack.length <= 4) {
            cut = { end: index + 1, closers: stack.map(open => CLOSER[open.char]).reverse().join('') };
        }
    };
    for (let index = start; index < text.length; index += 1) {
        const char = text[index];
        if (inString) {
            if (char === '\\') {
                index += 1;
            } else if (char === '"') {
                inString = false;
                if (stack.at(-1)?.char === '{') {
                    lastKey = text.slice(stringStart + 1, index);
                } else if (stack.at(-1)?.key === 'bars') {
                    markCut(index);
                }
            }
        } else if (char === '"') {
            inString = true;
            stringStart = index;
        } else if (char === '[' || char === '{') {
            stack.push({ char, key: lastKey });
        } else if (char === ']' || char === '}') {
            stack.pop();
            if (char === '}') {
                markCut(index);
            }
        }
    }
    if (!cut) {
        return null;
    }
    let value;
    try {
        value = JSON.parse(`${text.slice(start, cut.end)}${cut.closers}`);
    } catch {
        // Not the shape this repair knows: give up.
        return null;
    }
    const last = value.tracks?.at?.(-1);
    if (last && (typeof last.role !== 'string' || !(Array.isArray(last.bars) || Array.isArray(last.events)))) {
        value.tracks.pop();
    }
    return value;
}

// Whether a parsed track sounds in the loop's last bar.
export function reachesLastBar(track, loopBeats, beatsPerBar) {
    return Boolean(track?.events.some(event => event.beat + event.duration > loopBeats - beatsPerBar));
}
