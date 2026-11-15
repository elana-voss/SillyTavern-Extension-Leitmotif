# Plan

Run by the skill software-project. Every token figure is Claude's estimate (input, output and cache summed over an agent and its reviewer), to be replaced by the measured one beside it.

## Requirements (the owner's words)

- R2 "I want a Fable high medium opinion of how to improve the created music by the remote LLM. concrete, actionable suggestions. The remote LLM may be ANY current LLM available" ("current Kimi / DeepSeek / GLM models and the like. Not small or old models"); themes made by Claude models through the API key (cap "about USD8, that is the max cap"), judged by Fable; Fable never composes.
- R1 "evaluate the other LLMs work and suggest bug fixes or improvements in various areas. the idea is to have you review this project, fix or improve it and then we are done here."

## Review of the existing work (Claude, 2026-11-13)

Verdict: the extension is sound and its 34 tests pass; the core (two-stage brief then score, fail-soft parsing, loop-point search, MIDI export) is well built. Defects found by reading the code:

1. A failed analysis is cached as "no brief" (`index.js:443`): after one bad reply every later theme for that character, the whole session, is composed without a brief.
2. The brief cache ignores the tempo hint (`index.js:402`, `417-419`): a brief made with "Tempo follows the character" off is reused after it is turned on, so the theme keeps the slider's tempo.
3. A score is refused when the model's own tempo is outside 50-130 (`score.mjs:349`), although that tempo is always replaced by the target tempo (`score.mjs:472`): a usable score fails for nothing.
4. Notes in octave 0 or 7+ are dropped, not moved into the role's range (`score.mjs:155`, `424`): a high melody or low bass can lose events or fail the whole score; motif notes there are lost too (`brief.mjs:184`).
5. The settings panel says samples and libraries "load from their pinned CDNs" (`settings.html:58-62`); they ship with the extension and nothing is fetched.
6. Words that do not match the product: the README says to click "the music icon next to the input box" (it is in the Extensions menu) and that settings hold a meter (there is none); the panel says the analysis picks the meter "when enabled", but the meter always comes from the analysis (`index.js:739`). The words are corrected; the behaviour stays.
7. After a failed generation the status reads "Ready when a character chat is open." even when a theme is loaded and downloadable (`index.js:794`).

Structure, short of the skill's Structure line:

- `index.js` (916 lines) holds the settings panel, the composer prompt, Web Audio playback with loop-point search and MIDI export; the composer prompt and the loop-point search have no test because the file imports SillyTavern.
- The same XML escaping is written three times (`index.js:284-287`, `index.js:491`, `brief.mjs:91`), the same JSON extraction twice (`brief.mjs:157-173`, `score.mjs:321-338`).
- Code and tests lie flat in the root; no `package.json` names the test command.

Left as it is: the 300 MB of samples inside the repo (a deliberate choice for an offline install, stated in the README).

## Milestones

| # | Milestone | Requirement | Status | Priority | Claude tokens | Provider tokens | Actual |
|---|---|---|---|---|---|---|---|
| 1 | Defects 1-7 and a test bed | R1 | Done | Must | 3M | 0 | 5.6M (two agents, a hand-over at the context limit; most of it cache reads at 40-60k context per turn), 0; code review none (not due) |
| 2 | Structure: modules, shared helpers, tests | R1 | Done | Must | 4M | 0 | 4.5M (two agents, a hand-over at the context limit, and the review), 0; code review Fable 5.2 medium |
| 3 | One live run and close | R1 | Done | Must | 1M | about 15k on the owner's SillyTavern backend | Claude 1.6M, provider 18,741 tokens (two generations, as the backend reported them); code review none (not due) |
| 4 | Music quality: Fable reviews the prompts and blind-judges Opus and Sonnet themes, before and after the prompt changes | R2 | Done | Must | 3M | under 8 USD on the API key | Claude about 3M (estimate; not measured), Fable judging 0.25M; API 7.74 USD over 60 calls (prices from Anthropic's list, counted by the script); code review none (not due) |
| 5 | Every Fable suggestion built | R2 | In progress (milestone review) | Must | 12M | subscription, about 0.6M output | 5a 4.1M against 4M (two agents, a hand-over at the context limit; code review Fable 5.2 medium); 5b 2.4M against 4M (code review Fable 5.2 medium); 5c 1.4M against 1M (code review none, not due); 5d 5.1M against 3M (two agents, a hand-over at the context limit; blind judgement Fable 5.2 high 0.5M of it; code review none, not due) |
| 6 | Fable's eight judging suggestions built (0.2.3) | R2 | In progress | Must | 4M | subscription, about 0.2M output | |
| | Total | | | | 27M | about 15k; under 8 USD | 14.9M Claude; 18,741 provider (the backend reported 0 USD); 7.74 USD API |

Each milestone ends with the tests passing and the extension working in a local SillyTavern on the test bed.

### 1. Defects 1-7 and a test bed

Defects 1-7 above, one test each where code changes. A test bed: a SillyTavern checkout in a temporary folder outside the repo with this extension deployed, a local fake OpenAI-style server answering the two calls (and failing: refused, 500, cut reply, invalid JSON), driven by a headless browser: generate, playback starts, stop, download a `.mid`. Removed when the list is done.

Done: 40 unit tests (`node --test score.test.mjs brief.test.mjs status.test.mjs`) and the bed's 11 checks pass (`node tools/testbed/run.mjs --bed <bed> --pw <playwright-core folder>`). Next: milestone 2.

### 2. Structure: modules, shared helpers, tests

`index.js` keeps only SillyTavern wiring and the settings panel; the composer prompt, playback (with loop-point search) and MIDI export become their own modules; one shared escape and one shared JSON extraction; code under `src/`, tests under `tests/`, a `package.json` with `npm test`; tests for the composer prompt and the loop-point search; `deploy-local.ps1` and the README follow. What the user sees does not change. Code review due (over 300 lines moved).

Tests: 49 unit (`npm test`), test bed 11 of 11.

### 3. One live run and close

One theme generated through the owner's configured backend with the finished code, played and downloaded; findings fixed; version 0.2.0, pushed.

Done: through the owner's backend (NanoGPT, GLM 5.3) on the test bed, the brief preview filled, a five-track 3/4 theme at 78 BPM played, stopped and downloaded as a valid five-track MIDI file, with no warnings about dropped or moved notes. The first try failed only because the bed waited 90 s for a score the model took longer to write; the bed now waits up to 10 minutes on a live run. Tests: 49 unit, test bed 11 of 11 on the fake, 4 of 4 live. Next: none; the list is done.

### 4. Music quality

Themes made with the extension's own prompts and parser (`tools/music-eval/generate.mjs`), shown bar by bar with counted facts (`render.mjs`), and scored 1-10 blind by Fable 5.2 high. Four original characters, Opus 5.5 and Sonnet 5.5.

- Before: 8 of 8 first score replies were cut off; 2 of 8 themes failed; the 6 that played scored 4.3 on average (accompaniment held still).
- After (groove from bass and harmony, four-bar phrases, the brief limited to what General MIDI plays, larger reply limits, cut replies kept up to the last whole track, retry wording): 8 of 8 complete on the first try, 7.9 on average.
- Then rules for a counter line, motif development and texture register: the two complete themes rose 2 points each, the two cut off at the limit fell; the limit was raised to 10,000 + 1,600 per bar, and a 16-bar theme then finished first time with five tracks (28,802 tokens).
- The test script streams its replies: Node's fetch drops a reply that takes over five minutes.
- Fable's further suggestions: milestone 5.

Version 0.2.1.

### 5. Every Fable suggestion built (the owner, 2026-11-15: "MAKE A PLAN TO BUILD THAT ... HAVE FABLE MEDIUM REVIEW THAT THE PLAN IS CORRECT, FIX PLAN ACCORDINGLY. THEN IMPLEMENT."; "when implemented, this will be 0.2.2")

Source: Fable's three reviews of milestone 4 (the first saved verbatim in the scratchpad). Each item: design, then its test. Parts run in order, one agent each; every part ends with `npm test` green and a commit.

Plan reviewed by Fable 5.2 medium (asked by the owner), 2026-11-15; its 16 findings applied below.

5a. Playback, export and drums (code review due: new module). Estimate 4M.
- (3) Swing: the score carries `feel` from the brief (`index.js:366` sets `currentScore`; `parseScore` gains a `feel` option). A shared `src/timing.mjs` `swingEvent(beat, duration, feel)` returns start and duration: an on-beat eighth (beat % 1 === 0, duration 0.5) lengthens to 2/3; an off-beat eighth (beat % 1 === 0.5) starts at +1/6 with its end unchanged (duration minus 1/6); other events unchanged. Playback (`playback.mjs:203`) and MIDI export (`midi-export.mjs`) both call it. Test: the swung pair, a held note, a repeated same-pitch eighth line whose exported note-offs never cut the next note-on.
- (5) Humanisation in playback only (the MIDI file stays exact): each note's start moves by a seeded random up to ±8 ms and its velocity by up to ±6, never before the loop's start; bar one's downbeat untouched so the seam stays clean. `humanize` in `timing.mjs`; test: bounds over 1,000 draws, beat 0 unchanged.
- (4) Drums: the brief's `timbre.drums` (null = no drums) says whether a theme has them. A sixth role `drums`, instrument `drum_kit`, notes from a fixed set `kick, snare, rim, clap, closed_hat, open_hat, low_tom, high_tom, crash, ride`. `drum_kit` stays out of `INSTRUMENTS` (its 128 entries feed the schema enum at `score.mjs:202`, the labels at `composer.mjs:41` and a test at `tests/score.test.mjs:187`). Sites: `score.mjs:144` (role), `:176` (schema role enum, instrument enum plus `drum_kit`), `:376-380` (at most 6 tracks), `:402-403` (keep `drum_kit` on drums, never swapped), `:409` (the drums track's event cap 4 per beat), `:440` (drum names accepted, octave rules skipped). Upstream has no drum samples (FluidR3_GM, MusyngKite and FatBoy percussion files return 404), so a new `src/drum-synth.mjs` synthesizes them in Web Audio (kick: sine sweep 150 to 50 Hz; snare and clap: filtered noise plus a tone; hats and cymbals: high-passed noise of different lengths; toms: sine sweeps), with no download, exposing the same `play(note, when, options)` and `stop()` as a soundfont player; `loadPlayers` (`playback.mjs:160-171`) makes it for the drums track instead of loading a sample file. MIDI export (`midi-export.mjs:15-18`) writes drums on channel 10 with GM numbers (36, 38, 37, 39, 42, 46, 45, 50, 49, 51) and no program change. Test: parse a six-track score with sixteenth hats; unknown drum names dropped with a warning; the export's channel, numbers and no program change; drum-synth's node graph per name on a fake AudioContext; loadPlayers loads no file for drums.

Done (5a): swing, humanisation, drums in parse, playback (synthesized kit) and MIDI export; code review Fable, its finding (the music-eval render crashed on drum names) fixed with a test. Tests: 70 unit (`npm test`); the test bed not run (in 5d).

5b. The compact score format and salvage (code review due: new parser). Estimate 4M.
- (1) The score reply becomes per-bar strings, Fable's form: `{"role","instrument","bars":["v62 0:D4:.75 .75:F4:.25 1:A4:1 2:G#4:.5", "=1", ""]}`. A token is `beatInBar:notes joined by +:duration`, optionally `:velocity`; a leading `vNN` sets the bar's velocity; `=n` repeats bar n (1-based, an earlier bar; a chain `=n` to `=m` resolves to the bar it ends at; a forward or self reference is a silent bar with a warning); `""` is a silent bar; a note may ring past the bar line; drums use their names as notes. A bars array shorter than the loop leaves the rest silent; longer, the extra bars are dropped with a warning. A new `src/compact-score.mjs` parses it fail-soft (a bad token is dropped with a warning, never the bar) into today's events, so everything after `parseScore` stays. The schema is plain strings, no pattern, safe for every provider. `SCORE_JSON_SCHEMA`, the composer prompt's example and rules (`composer.mjs:69-77`), its system prompt (`:8`) and its retry prompt (`:99`) switch to it; the old `events` form is still parsed. The reply limit keeps its base: `10000 + <per bar>` with the per-bar term measured from the compact replies of 5d (Fable's first figure, `6000 + 300 * bars`, predates the longer rules and thinking up to 9.6k). Test: each token form; chained, forward and self `=n`; short and long bars arrays; velocity default; ringing note; old and new form; the composer example round-trips.
- (24) Salvage, once, on the parsed bars or events of either form: a cut reply keeps each track up to its last complete bar string or event and closes the brackets, instead of dropping the track (`closeCutScore`, `score.mjs:267`); it is kept only if the melody and the bass or harmony sound in the last bar (an event with beat + duration > loopBeats - beatsPerBar), else the retry runs. Test: a reply cut mid-bar in the third track keeps its whole bars; a melody whose last note starts in the bar before and holds through the last bar is kept; one whose melody stops in bar 3 of 8 is refused.

Done (5b): the compact per-bar form (`src/compact-score.mjs`) in the schema, the composer prompt, its system and retry prompts and the fake score; the old events form still parsed; salvage of a cut reply to its last whole bar or event (`src/score-salvage.mjs`); code review Fable, its three findings fixed with tests. Tests: 84 unit (`npm test`); the test bed not run (in 5d).

5c. The brief and the prompt rules (prompt text; no review due). Estimate 1M.
- (2) `timbre.*` (harmony, bass, melody, counter, texture) becomes a nullable enum of that role's `TRACK_ROLES` list (8-15 names; 128-name enums per role would add about 770 values, past provider limits and printed into the prompt by SillyTavern for some sources); `timbre.drums` is `drum_kit` or null. `parseBrief` stops cutting `surprise` (`brief.mjs:219`) and the text fields mid-word: the schema descriptions say "at most 15 words"; the parser keeps whole words up to the field limit. Test: a 30-word surprise is cut at a word; a timbre outside the enum is dropped.
- (7) The brief gains `groove_cells`: one-bar onset positions for bass and for harmony (and drums when `timbre.drums` is set), which the composer uses and varies. (10) The brief gains `phrase_plan`: the ordered phrase functions, statement, answer with a new ending, sequence on another degree, fragment, climax, cadence, written for this character, with no bar numbers (the brief is cached per character before the bar count exists, `index.js:258-262`, `:309`); the composer maps them onto its four-bar phrases. (12) `surprise` names one of: a borrowed chord, a register drop, a tacet part, a rhythmic shift; `composer.mjs:81` is replaced to match.
- Composer rules, each replacing the older line it contradicts (`composer.mjs:81-86`), not appended beside it: (8) accompaniment notes last at most 2 beats, pads at most 2 bars; plucked or struck instruments re-strike at least every 2 beats. (9) With no drums, one part acts as percussion (off-beat strums or marimba). (11) No melody note over 2 beats except at cadences. (13) Every bar has new onsets in at least two parts; a break lasts at most 2 bars with one part still pulsing. (14) The mode's colour tone sits in the melody and resolves. (15) Dense themes use more than a two-chord vamp. (16) Any density above sparse has a harmony track. (17) The counter sounds at least 40 % of the loop, plays in the peak section, answers every gap of 2 beats or more (replacing "1.5 beats"), uses at least two durations and quotes the motif once. (18) No track except drums repeats a bar's rhythm more than twice running; the bass figure and the groove cells are varied, not repeated (replacing "a repeating rhythmic figure", `:83`). (19) The bass approaches each chord by step and plays a fill before each section change. (20) The last bar ends off the tonic. (21) Sustaining instruments hold, decaying ones move; texture has at most 2 notes, an octave away from the harmony voicing. (22) The melody stays above the harmony's top note. (23) No held note a semitone from a chord tone in the same octave. Drums, when `timbre.drums` is set: the brief's drum cell, a fill before each phrase. The no-drums line (`composer.mjs:83`) and the brief's playback rule (`brief.mjs:161`) allow drums.
- Test: the composer prompt holds each rule and none of the replaced lines; the brief schema has the new fields.

Done (5c): timbre enums per role and `timbre.drums`, whole-word text limits, `groove_cells`, `phrase_plan`, the surprise kinds, and the composer rules (8)-(23) and drums rule, each replacing the line it contradicted; the test bed's fake brief carries the new fields. Tests: 91 unit (`npm test`); the test bed not run (in 5d).

5d. Live test, judgement, music for the owner, release. Estimate 3M Claude, plus the subscription calls below.
- (6) The test sends the JSON schema, as the extension does. The API key is spent and SillyTavern has no valid key (the owner, 2026-11-15), so the bed's `--live` run cannot be made; `tools/music-eval/generate.mjs` gains a `--cli` mode through the subscription: `claude -p --model <m> --json-schema <file> --system-prompt <system>`, run from an empty temporary folder with settings sources, tools and CLAUDE.md off, the reply limit set through `CLAUDE_CODE_MAX_OUTPUT_TOKENS` (flags checked against `claude --help` first), same prompts and retry as `index.js`. The CLI checks the schema itself, not a provider's strict decoding: a schema a provider refuses is not found by it. Four characters, Sonnet 5.5 and Opus 5.5: 8 themes, about 16 calls, about 0.6M output tokens. The compact replies' lengths set the reply limit's per-bar term (5b).
- Other vendors (Kimi, DeepSeek, GLM), and through SillyTavern's real path: open until the owner names a provider and key (Fable: "one live run per model family"); not built until then.
- Fable 5.2 high blind-judges the 8 new themes against the 8 of the "after" set, as in milestone 4.
- The owner, 2026-11-15: "save the resulting / rendered music for me to hear". Each of the 8 new themes is saved as a `.mid` (the extension's export) and as a `.wav` rendered by the extension's own playback (samples, drum synth, swing, humanisation) in an OfflineAudioContext, one loop played twice, by a tracked script `tools/music-eval/render-audio.mjs` run in the headless browser the test bed uses; the files go to the owner's Music folder, `Leitmotif 0.2.2 themes`, named by model and character, outside the repo.
- Version 0.2.2 (manifest and package), the test bed on the fake, commit named files, push, the installed copy updated.

Done (5d): 8 of 8 themes ok, each score on the first try. Score reply output tokens (thinking included): Sonnet 5.5 14,343 (8 bars), 35,114 and 20,196 (16 bars), 21,258 (12 bars); Opus 5.5 7,831 (8 bars), 15,119 and 17,132 (16 bars), 7,554 (12 bars); the reply limit is 10,000 + 2,400 per bar (the old 16-bar limit, 35,600, came within 486 of Sonnet's longest). Fable 5.2 high blind judgement, means of 1-10: new 7.5 against after 7.0; Opus 8.25 new, 7.5 after; Sonnet 6.75 new, 6.5 after. Its ranked weaknesses: no drums where the character needs drive; accompaniment one bar pasted over an unchanged 4-bar loop; melody never rests, counter missing or shadowing; dynamics flat or too loud for quiet characters; held notes a semitone from the chord; mud below C3; surprise too early or not one; the loop seam stops or drops. The 8 themes as `.mid` and `.wav` in the owner's Music folder, `Leitmotif 0.2.2 themes`. Tests: 92 unit (`npm test`); the test bed on the fake 11 of 11. Installed copy updated.

Version 0.2.2.

Total 12M Claude tokens; subscription about 0.6M output tokens of Sonnet and Opus; no API money.

Milestone review (Fable 5.2 medium), four findings across the parts, fixed by the 6a agent (same files):
- Swing decides by duration (`src/timing.mjs:18-21`), so the composer's own short off-beat hat (`composer.mjs:71`, `1.5:closed_hat:.25`) stays straight while pitched eighths swing: drums swing by position, not duration.
- The composer is not told that playback swings: a written-out dotted shuffle (`composer.mjs:79` example) sits beside swung eighths; the prompt says to write straight eighths when the feel swings, and the example is straight.
- `<groove_cells>` is named unconditionally (`composer.mjs:74`, `:92`) though `musicBriefToPromptSection` leaves it out when empty: a fallback as `<phrase_plan>` has.
- The seeded random twice: `tools/music-eval/generate.mjs:38` uses `createRandom` from `src/timing.mjs`.
- Its fifth point (does the reply limit cover drums?) checked: 6 of the 8 measured replies had drums, the longest (35,114 tokens, 16 bars) among them; no change.

### 6. Fable's eight judging suggestions built (the owner, 2026-11-15: "build them now, and never publish without my go")

From Fable 5.2 high's blind judgement in 5d (the full report in the scratchpad, `fable4-judge.txt`). Each fix is Fable's prompt fix, built as written; each replaces the older line it contradicts (in `src/composer.mjs` and `src/brief.mjs`), not appended beside it. Estimate 4M Claude.

6a. The prompt rules (prompt text and the brief's schema descriptions; no review due). Estimate 1.5M.
- (1) Drums: "If tempo is 100 BPM or more, or the energy plan reaches high or full, include a drums track (kit or hand percussion) and name its groove in the brief; leave drums out only when the character calls for stillness." Replaces the brief's playback rule ("drums is drum_kit only when the character calls for drums", `brief.mjs:209`) and the schema description of `timbre.drums` (`brief.mjs:88`).
- (2) "Keep one groove cell but change it at least every 4 bars (walk-up, dropped beat, new inversion, fill); the second half of the loop must use a different chord progression or bass line from the first half; no melody rhythm unchanged for more than 2 bars in a row; a drum fill at most every 4 bars and never the same fill twice." Replaces the repetition line (`composer.mjs:94`, "more than twice running"), "subtle variation" (`:87`) and the drums rule's "a fill before each phrase" (`:74`).
- (3) "End each 2-4 bar phrase with at least one beat of melody silence; the counter plays its answer in those gaps and holds or rests while the melody moves; the counter may copy the melody's rhythm for at most one bar." Replaces "no large silent stretches" (`:96`) and the counter's "answers every melody gap of 2 beats or more" (`:97`).
- (4) "Set the peak velocity from the character: quiet, shy or tired characters peak near v84 and use no crash; rise by at most 12 per bar. Inside a bar, accent the strong beats and soften passing notes - no bar with one velocity on every note. Keep the lead inside its comfortable range (accordion, trumpet, flute below C6)." Replaces "Vary velocities ... constant-volume patterns" (`:98`).
- (5) "When the chord changes, re-voice every held note and pad; outside the stated surprise, no note a semitone from a chord tone lasts longer than half a beat; chromatic approach notes in the bass are at most an eighth and not in consecutive bars." Replaces the semitone line from 5c (23), in `:87`.
- (6) "Only the bass plays below C3; chord voicings sit between C3 and C5; the texture takes a register no other track uses and never the harmony's notes in the same octave." Replaces the octave ranges for harmony and texture (`:86`) and the texture's "an octave away from the harmony voicing" (`:98`).
- (7) "Place the surprise in the second half of the loop, after the motif has been heard at least twice; it must contain a note outside the mode and show in at least two tracks; write the chord as its actual notes, not a Roman numeral." Replaces the surprise line (`:90`) and the brief's `surprise` description (`brief.mjs:92`).
- (8) "The last bar leads into bar 1: end on V, bVII or a tritone substitute, never on the tonic chord, with the melody within a step of its first note; the last value of the energy plan is at most one level from the first (end on a fall or a pickup, not full into low)." Replaces "the last bar ends off the tonic" (`:96`) and goes into the brief's energy_curve rule (`brief.mjs:208`).
- Plan review (Fable 5.2 medium), applied:
  - (4) and (6) reach the composer's example: the example bars (`composer.mjs:79`, drums `:71`) get per-token accents; the example's texture moves to a register no other example track uses. In (4), the rest of `:98` ("avoid random notes ... and excessive density") stays; "use no crash" goes into the drums rule (`:74`).
  - (7) also replaces `SURPRISE_KINDS` (`brief.mjs:22`) and the brief's example shape (`:202`); "happens once" stays, "small enough that bar one still follows seamlessly" goes ((8) covers the seam); the last bar's bVII or tritone substitute from (8) is not a second surprise. The 5c decision on the four kinds is rewritten.
  - (3) also replaces the counter's "under the climax it moves in thirds, sixths or contrary motion" (`:97`) with "under the climax, contrary motion"; "sounds at least 40 % of the loop" stays (held notes count).
  - (5) also drops "clusters" from `:87` and makes the colour-tone line "appears in the melody, as a chord tone or for at most half a beat, and resolves"; the pads at `:92` become "at most 2 bars and never across a chord change".
  - (2) also removes "varied, not repeated" at `:92`; (2) states the variation.
  - (8): the brief's energy rule (`brief.mjs:208`, schema description `:61`) names the order low < medium < high < full, with rise, fall and break allowed as the last value; prompt only, the parser does not enforce it.
  - (1): hand percussion is `drum_kit` played on rim, clap and toms; no new instrument. (1) lives in the brief prompt only; the composer's no-drums line (`:75`) stays for briefs without drums.
  - (6) is enforced: `normalizeNoteOctave` (`score.mjs:286-292`) clamps harmony and texture to octaves 3-6; `tests/score.test.mjs:77`, `:434` follow.
  - Test: the composer prompt holds (2)-(8) and none of the replaced lines; the brief prompt holds (1) and (8)'s energy sentence. Assertions on replaced text move to the "replaced" list: `tests/composer.test.mjs:59, 60, 62, 65, 67, 68, 86`; `tests/brief.test.mjs:234-235`.

6b. Live check and music. Estimate 2.5M Claude, subscription about 0.2M output (5d measured 149k for 8 themes).
- The same 8 themes (four characters, Sonnet 5.5 and Opus 5.5) through `generate.mjs --cli`; each reply's length and stop reason read from the records: one cut or within a tenth of the limit raises the per-bar term and reruns that theme only; views by `render.mjs`; Fable 5.2 high blind-judges them against the 8 of 0.2.2 (`music-eval/v022`), as in 5d; the `.mid` and `.wav` of each to the owner's Music folder, `Leitmotif 0.2.3 themes`.
- The test bed on the fake; `npm test`. Commit locally only.
- Version 0.2.3 (manifest and package) last, only after every check above has passed. Nothing is pushed and the installed copy is not updated until the owner's go.

## Questions for the owner

- Item 6, a live run per model family (Kimi, DeepSeek, GLM) and through SillyTavern: needs a provider and key he names; until then the test uses Claude models through the subscription.


## Decisions

- The list above, 8M Claude tokens and about 15k provider tokens: the owner's "go", 2026-11-13.
- Defect 6: the meter keeps following the character always; only the words change.
- Every idle status text comes from one shared `status.mjs`; the brief cache is `createBriefCache` in `brief.mjs`, keyed by character and tempo hint.
- SillyTavern limit: its server's chat-completions endpoint (`src/endpoints/backends/chat-completions.js`, the `/generate` route's non-OK branch) passes on only the provider's HTTP status text, never its body; the extension's toast names that text ("Unauthorized", "Internal Server Error") and SillyTavern's server console logs the body.
- The bed copies an installed SillyTavern without its globally installed extensions (an older copy of this one loaded beside the deployed copy) and uses playwright-core copied from the local npm cache into the bed's task folder, outside the repo; it stays on disk for milestones 2 and 3.
- `npm test` runs `node --test "tests/**/*.test.mjs"`: Node 24 does not take a bare folder for `--test`.
- `package.json` has no `"type": "module"`; every file under `src/` and `tests/` is `.mjs`. Its licence field is `LGPL-2.1-or-later`, as `LICENSE` says.
- Defect fixed in the move: the brief prompt escaped the already escaped profile a second time (tags reached the model as `&lt;description&gt;`); test in `tests/brief.test.mjs`.
- Defect fixed after the review: the move had dropped the backslash from the characters the MIDI file name replaces; test in `tests/midi-export.test.mjs`.
- The bed's live run: `run.mjs --live <SillyTavern user data folder>` copies that user's `settings.json` and `secrets.json` into the bed for the run only, deletes them after, runs generate, stop and download, and writes the backend's replies to `live-responses.json` in the bed; it waits up to 10 minutes for the score (a real model wrote about 5,000 tokens for it).
- `deploy-local.ps1` always copies `lib/` and `src/`, `samples/` only when its size differs; the bed's `sync.mjs` leaves out `tests/`.
- Swing shifts an off-beat event only when it is an eighth or longer; a sixteenth at x.5 stays straight, so a sixteenth hat line does not flam. Known: an on-beat eighth over an off-beat sixteenth overlaps it by 1/6 beat.
- Humanisation draws per note from a fixed seed set at each `play()`, so a replay sounds the same.
- Pitched tracks take MIDI channels 1-9 in order; drums take channel 10.
- A pitched instrument on the drums role becomes `drum_kit`, with a warning.
- The drums track's event cap is 4 per beat.
- The test bed's fake score (`tools/testbed/fake-llm.mjs`) swings and has drums; the bed is run in 5d.
- A compact token is `beat:notes:duration[:velocity]`; a beat at or past the bar length, an empty note list, a zero duration or a non-numeric field drops the token; a token without velocity and without a bar `vNN` gets 100.
- A compact track whose bars yield no event is an error, as a track with no events was.
- Salvage cuts only inside the root object's `tracks`; when the cut track has no usable event yet it is left out; any failure of a salvaged reply is reported as the cut, so the retry asks for melody, bass and harmony.
- Groove cells are onset beats only (drums too, no kit names); the parser snaps them to the sixteenth grid inside the brief's bar and keeps the drums cell only when `timbre.drums` is set.
- `phrase_plan` is an enum list (statement, answer, sequence, fragment, climax, cadence), 2-8 entries; the composer falls back to that order without one.
- `surprise` stays free text (at most 15 words) naming its chord as notes outside the mode and where in the second half it falls (6a, (7)); no separate enum field.
- The composer's drums track is asked for only when the brief's `timbre.drums` is set (prompt rule and example); without a brief, no drums.
- `generate.mjs --cli` takes the Claude CLI binary from `CLAUDE_CLI`: an older installed CLI refuses Opus 5.5, so a newer binary already on the machine was used.
- The playback pass is exported (`createMasterChain`, `schedulePass`, `loadScorePlayers`, `createHumanizer` in `playback.mjs`) so `render-audio.mjs` renders offline with the extension's own sound.
- For the blind judgement each view's last `calls:` line is stripped: the CLI's stop reason ("success") against the API's ("end_turn") would unblind the sets.

## Trials

None open.
