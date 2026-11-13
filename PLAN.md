# Plan

Run by the skill software-project. Every token figure is Claude's estimate (input, output and cache summed over an agent and its reviewer), to be replaced by the measured one beside it.

## Requirements (the owner's words)

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
| 3 | One live run and close | R1 | Done | Must | 1M | about 15k on the owner's SillyTavern backend | Claude: (main session fills in), provider 18,741 tokens (two generations, as the backend reported them); code review none (not due) |
| | Total | | | | 8M | about 15k | |

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

## Questions for the owner

None open.

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

## Trials

None open.
