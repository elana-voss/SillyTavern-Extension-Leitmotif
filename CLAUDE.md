# Leitmotif

SillyTavern extension; software project, run by the skill software-project. Agent type: `builder`.

- The plan: `PLAN.md`.
- Tests: `npm test` (unit); the test bed in `tools/testbed/` (fake backend, headless SillyTavern) for what only the product shows. `index.js` is the only file that imports SillyTavern; logic that needs a test lives in `src/`.
- The test bed's SillyTavern copy must leave out globally installed extensions: an old copy of this extension loaded beside the deployed one and hid a working fix.
- The local folder is `SillyTavern-Extension-Midi`, the GitHub repo and the installed folder `SillyTavern-Extension-Leitmotif` (`EXT_DIR` in `index.js`); `scripts/deploy-local.ps1 -SillyTavernRoot <checkout>` copies it into a SillyTavern checkout.
- `samples/` holds about 300 MB of unmodified FluidR3_GM samples; never read, rewrite or re-download them (`scripts/download-samples.ps1` exists only to regenerate the folder). `lib/` holds two vendored MIT libraries, unchanged.
- The SillyTavern API used (`generateRaw` with `jsonSchema`, `returnInvalid`) is in the local checkout `../SillyTavern-Launcher/SillyTavern/public/script.js`.
- The repo is public: no machine paths or private names in it.
