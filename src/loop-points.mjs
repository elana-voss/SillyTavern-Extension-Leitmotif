// Loop points for a sustained sample. Web Audio loops restart a buffer with no
// crossfade, so a loop point has to land where the waveform continues smoothly
// into itself. Nothing here rewrites the sample: the scan only chooses loop
// points whose value and slope match the loop start, so no discontinuity can be
// introduced anywhere in the note. Pure over channel arrays, so it can be tested.

// Loop region: start past the attack, end just before the sample's last frames.
// Loop points are only used when the waveform there lines up with itself, since
// a phase mismatch at the loop point would step the signal and tick once per pass.
const LOOP_START_RATIO = 0.4;
const LOOP_END_MARGIN_SECONDS = 0.02;
const LOOP_MIN_PERIOD_SECONDS = 0.4;
const LOOP_MATCH_TOLERANCE = 2.5;

// channels: one Float32Array per channel, all of the same length. Returns
// { start, end } in seconds, or null when no loop wraps cleanly.
export function findLoopPoints(channels, sampleRate) {
    const duration = (channels[0]?.length ?? 0) / sampleRate;
    // +1 frame so the loop start has a preceding sample to measure slope against.
    const startFrame = Math.floor(duration * LOOP_START_RATIO * sampleRate) + 1;
    const minEndFrame = startFrame + Math.floor(LOOP_MIN_PERIOD_SECONDS * sampleRate);
    const maxEndFrame = Math.floor((duration - LOOP_END_MARGIN_SECONDS) * sampleRate);
    if (minEndFrame > maxEndFrame) {
        return null;
    }

    const mismatch = (frame) => {
        let cost = 0;
        for (const data of channels) {
            cost += Math.abs(data[frame] - data[startFrame])
                + Math.abs((data[frame] - data[frame - 1]) - (data[startFrame] - data[startFrame - 1]));
        }
        return cost;
    };

    let bestFrame = minEndFrame;
    let bestCost = Infinity;
    for (let frame = minEndFrame; frame <= maxEndFrame; frame++) {
        const cost = mismatch(frame);
        if (cost < bestCost) {
            bestCost = cost;
            bestFrame = frame;
        }
    }

    // Accept the loop only when the step across the wrap is small next to the
    // signal's own sample-to-sample movement; otherwise the caller fades the
    // note out inside the sample instead, which cannot tick.
    const wrapsCleanly = channels.every(data => {
        let movement = 0;
        for (let frame = startFrame + 1; frame <= maxEndFrame; frame++) {
            movement += Math.abs(data[frame] - data[frame - 1]);
        }
        movement /= maxEndFrame - startFrame;
        const wrapStep = Math.abs(data[startFrame] - data[bestFrame - 1]);
        return movement > 0 && wrapStep <= LOOP_MATCH_TOLERANCE * movement;
    });

    return wrapsCleanly
        ? { start: startFrame / sampleRate, end: bestFrame / sampleRate }
        : null;
}
