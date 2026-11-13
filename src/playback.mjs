// Sampled playback: the score looped through Web Audio with the FluidR3 samples
// shipped in samples/, held notes on sustained instruments looping their sample
// at points found by loop-points.mjs. One playback at a time; starting a new one
// or stopping cancels the old one, even while its samples are still loading.
import { findLoopPoints } from './loop-points.mjs';
import { createScriptLoader } from './script-loader.mjs';

// Instruments whose FluidR3 samples are sustained long tones: holding a note past
// the sample length must keep looping the steady-state tail instead of falling
// silent. Decaying instruments (pianos, guitars, harp, marimba, basses, pizzicato,
// percussion) are excluded so their fade finishes inside the sample. Looping is
// fail-soft per note: without a clean loop point a note fades out inside its
// sample just like a decaying instrument, so an over-inclusive entry is safe.
const SUSTAINED_INSTRUMENTS = new Set([
    // Pads
    'pad_1_new_age', 'pad_2_warm', 'pad_3_polysynth', 'pad_4_choir',
    'pad_5_bowed', 'pad_6_metallic', 'pad_7_halo', 'pad_8_sweep',
    // Ensemble and solo strings
    'string_ensemble_1', 'string_ensemble_2', 'synth_strings_1', 'synth_strings_2',
    'tremolo_strings', 'violin', 'viola', 'cello',
    // Voices
    'choir_aahs', 'voice_oohs', 'synth_choir',
    // Winds
    'flute', 'piccolo', 'recorder', 'pan_flute', 'blown_bottle',
    'shakuhachi', 'whistle', 'ocarina',
    // Reeds
    'clarinet', 'oboe', 'english_horn', 'bassoon', 'shanai', 'harmonica',
    // Saxophones
    'soprano_sax', 'alto_sax', 'tenor_sax', 'baritone_sax',
    // Brass
    'trumpet', 'muted_trumpet', 'french_horn', 'trombone', 'tuba',
    'brass_section', 'synth_brass_1', 'synth_brass_2',
    // Organs and free reeds
    'drawbar_organ', 'percussive_organ', 'rock_organ', 'church_organ',
    'reed_organ', 'accordion', 'tango_accordion', 'bagpipe',
    // Synth leads and basses
    'lead_1_square', 'lead_2_sawtooth', 'lead_3_calliope', 'lead_4_chiff',
    'lead_5_charang', 'lead_6_voice', 'lead_7_fifths', 'lead_8_bass__lead',
    'synth_bass_1', 'synth_bass_2',
    // Atmospheric FX patches hold a steady texture
    'fx_2_soundtrack', 'fx_4_atmosphere', 'fx_6_goblins', 'fx_7_echoes', 'fx_8_scifi',
]);
const NOTE_SEMITONES = { A: 9, B: 11, C: 0, D: 2, E: 4, F: 5, G: 7 };

function noteToMidiNumber(note) {
    const match = /^([A-G])([#b]?)(\d)$/.exec(note);
    if (!match) {
        return null;
    }
    const [, letter, accidental, octave] = match;
    const offset = NOTE_SEMITONES[letter] + (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0);
    return offset + (Number(octave) + 1) * 12;
}

function getNoteBuffer(player, note) {
    const midi = noteToMidiNumber(note);
    // soundfont-player keys its decoded buffers by MIDI number, but fall back to
    // the note name in case a future version stops remapping them.
    return (midi === null ? null : player.buffers?.[midi]) ?? player.buffers?.[note] ?? null;
}

const loopPointsCache = new WeakMap();

function getLoopPoints(buffer) {
    if (!loopPointsCache.has(buffer)) {
        const channels = [];
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            channels.push(buffer.getChannelData(channel));
        }
        loopPointsCache.set(buffer, findLoopPoints(channels, buffer.sampleRate));
    }
    return loopPointsCache.get(buffer);
}

// The play options for one note: gain, a release scaled to the note, and either
// a loop over the sample's clean region or a duration that ends inside it.
function getNoteOptions(buffer, { velocity, requestedLength, sustainedInstrument }) {
    const gain = 0.48 * velocity / 127;
    // FluidR3 samples are only 1-2 seconds long, while a chord held for several
    // beats at a slow tempo lasts longer than that. Without special handling the
    // audio simply runs out mid-note and the gain envelope never fades, which
    // sounds like a clipped note ending.
    const sampleLength = buffer?.duration ?? 0;
    const hasSampleLength = sampleLength > 0.05;
    // Scale the fade-out with the note: a fixed short release chops long notes
    // to silence abruptly, while fast short notes still need a quick release to
    // stay articulate.
    const release = hasSampleLength
        ? Math.min(0.6, requestedLength * 0.5, sampleLength * 0.4)
        : Math.min(0.6, requestedLength * 0.5);
    const options = { gain, release };
    // Held notes on sustained instruments loop the sample region whose waveform
    // continues smoothly into itself, so the note can reach its full length
    // without a tick at the loop point.
    const loopPoints = hasSampleLength && sustainedInstrument ? getLoopPoints(buffer) : null;
    if (loopPoints) {
        options.loop = true;
        options.loopStart = loopPoints.start;
        options.loopEnd = loopPoints.end;
        options.duration = requestedLength;
    } else if (hasSampleLength) {
        // Decaying instruments cannot be looped without repeating their attack,
        // so finish the fade before the sample ends.
        options.duration = Math.min(requestedLength, Math.max(0.05, sampleLength - release));
    } else {
        options.duration = requestedLength;
    }
    return options;
}

// soundfontUrl: the soundfont-player script; sampleUrlBase: the samples/ folder
// URL; onStop: called after every stop, to show the idle state.
export function createPlayback({ soundfontUrl, sampleUrlBase, logTag, onStop }) {
    const loadSoundfont = createScriptLoader(soundfontUrl, 'Soundfont');
    let audioContext;
    let masterCompressor;
    let active = false;
    let generation = 0;
    let timer;
    let activePlayers = [];

    function ensureAudioContext() {
        const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextConstructor) {
            throw new Error('This browser does not support the Web Audio API.');
        }
        audioContext ??= new AudioContextConstructor();
        if (!masterCompressor) {
            masterCompressor = audioContext.createDynamicsCompressor();
            masterCompressor.threshold.value = -16;
            masterCompressor.knee.value = 12;
            masterCompressor.ratio.value = 8;
            masterCompressor.attack.value = 0.003;
            masterCompressor.release.value = 0.2;
            const masterGain = audioContext.createGain();
            masterGain.gain.value = 0.75;
            masterCompressor.connect(masterGain);
            masterGain.connect(audioContext.destination);
        }
        return audioContext.resume();
    }

    function stop() {
        generation += 1;
        active = false;
        if (timer) {
            clearTimeout(timer);
            timer = undefined;
        }
        for (const player of activePlayers) {
            player.stop();
        }
        activePlayers = [];
        onStop();
    }

    async function loadPlayers(score) {
        const soundfont = await loadSoundfont();
        // Samples ship with the extension in samples/; there is no network
        // fallback, so a missing file means an incomplete install.
        return Promise.all(score.tracks.map(async track => {
            const url = new URL(`${track.instrument}-mp3.js`, sampleUrlBase).href;
            try {
                return await soundfont.instrument(audioContext, url, {
                    destination: masterCompressor,
                });
            } catch (error) {
                console.error(logTag, `Could not load the sample file for ${track.instrument}`, url, error);
                throw new Error(`The ${track.instrument} sample could not be loaded. The extension appears to be installed incompletely; reinstall it.`);
            }
        }));
    }

    // Loads the samples, then loops the score until stop() or the next play().
    // onLoading runs once playback counts as active, onStarted once the first
    // pass is scheduled. Needs ensureAudioContext() to have run first.
    async function play(score, { onLoading, onStarted }) {
        stop();
        const current = generation;
        active = true;
        onLoading();
        try {
            const players = await loadPlayers(score);
            if (current !== generation) {
                for (const player of players) {
                    player.stop();
                }
                return;
            }

            activePlayers = players;
            const beatLength = 60 / score.tempo;
            const loopLength = score.loopBeats * beatLength;

            const scheduleLoop = (startTime = audioContext.currentTime + 0.08) => {
                if (current !== generation) {
                    return;
                }
                score.tracks.forEach((track, trackIndex) => {
                    const player = players[trackIndex];
                    const sustainedInstrument = SUSTAINED_INSTRUMENTS.has(track.instrument);
                    for (const event of track.events) {
                        const when = startTime + event.beat * beatLength;
                        const requestedLength = event.duration * beatLength;
                        for (const note of event.notes) {
                            const options = getNoteOptions(getNoteBuffer(player, note), {
                                velocity: event.velocity,
                                requestedLength,
                                sustainedInstrument,
                            });
                            player.play(note, when, options);
                        }
                    }
                });
                const nextStart = startTime + loopLength;
                timer = setTimeout(
                    () => scheduleLoop(Math.max(nextStart, audioContext.currentTime + 0.08)),
                    Math.max(0, (nextStart - audioContext.currentTime - 0.1) * 1000),
                );
            };

            onStarted();
            scheduleLoop();
        } catch (error) {
            if (current === generation) {
                stop();
            }
            throw error;
        }
    }

    return {
        ensureAudioContext,
        play,
        stop,
        isActive: () => active,
    };
}
