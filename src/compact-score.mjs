// The compact score form: a track's "bars" array holds one string per bar,
// such as "v62 0:D4:.75 .75:F4+A4:.25 2:G#4:.5:90", "=1" or "". compactBarsToEvents
// turns it into the timed events of the older form, which parseScore then
// repairs as before. Fail-soft: a bad token is dropped with a warning, never
// its bar.
//
// A token is beatInBar:notes:duration[:velocity], notes joined by "+"; a
// leading vNN sets the velocity of the bar's tokens without their own; "=n"
// repeats an earlier bar n (1-based); "" is a silent bar. A note may ring past
// its bar line; the loop end clips it later.

const NUMBER = /^(?:\d+\.?\d*|\.\d+)$/;
const BAR_VELOCITY = /^v(\d+)$/i;
const REPEAT = /^=(\d+)$/;

function readNumber(text) {
    return NUMBER.test(text) ? Number(text) : null;
}

// One token to an event placed within its bar; null with a warning when unusable.
function readToken(token, barVelocity, beatsPerBar, where) {
    const parts = token.split(':');
    const beat = readNumber(parts[0]);
    const notes = (parts[1] ?? '').split('+').filter(Boolean);
    const duration = readNumber(parts[2] ?? '');
    const velocity = parts.length === 4 ? readNumber(parts[3]) : barVelocity;
    if ((parts.length !== 3 && parts.length !== 4)
        || beat === null || beat >= beatsPerBar
        || notes.length === 0
        || duration === null || duration <= 0
        || velocity === null) {
        console.warn(`[Leitmotif] ${where} has an unusable token "${token}"; dropped it.`);
        return null;
    }
    return { beat, duration, velocity, notes };
}

// One bar string to its events, beats relative to the bar. `resolved` holds
// the events of the bars before it, for "=n".
function readBar(bar, resolved, beatsPerBar, where) {
    if (typeof bar !== 'string') {
        console.warn(`[Leitmotif] ${where} is not a string; left it silent.`);
        return [];
    }
    const text = bar.trim();
    const repeat = REPEAT.exec(text);
    if (repeat) {
        const source = Number(repeat[1]);
        if (source < 1 || source > resolved.length) {
            console.warn(`[Leitmotif] ${where} repeats bar ${source}, which is not an earlier bar; left it silent.`);
            return [];
        }
        return resolved[source - 1];
    }
    const tokens = text.split(/\s+/).filter(Boolean);
    const velocityMatch = BAR_VELOCITY.exec(tokens[0] ?? '');
    const barVelocity = velocityMatch ? Number(velocityMatch[1]) : undefined;
    return tokens
        .slice(velocityMatch ? 1 : 0)
        .map(token => readToken(token, barVelocity, beatsPerBar, where))
        .filter(Boolean);
}

// The events of a compact track over a loop of `loopBars` bars; `track` is
// the 1-based track number for warnings. Bars past the loop are dropped.
export function compactBarsToEvents(bars, { beatsPerBar, loopBars, track }) {
    if (bars.length > loopBars) {
        console.warn(`[Leitmotif] Track ${track} wrote ${bars.length} bars for a ${loopBars}-bar loop; dropped the extra bars.`);
    }
    const resolved = [];
    bars.slice(0, loopBars).forEach((bar, index) => {
        resolved.push(readBar(bar, resolved, beatsPerBar, `Track ${track}, bar ${index + 1}`));
    });
    return resolved.flatMap((events, index) => events.map(event => ({ ...event, beat: index * beatsPerBar + event.beat })));
}
