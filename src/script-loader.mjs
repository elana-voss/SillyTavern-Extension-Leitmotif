// Loading the vendored browser libraries in lib/ (MidiWriter, soundfont-player),
// which expose a global instead of an ES module export.

function loadScript(url, globalName) {
    if (globalThis[globalName]) {
        return Promise.resolve(globalThis[globalName]);
    }

    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.async = true;
        script.onload = () => {
            if (!globalThis[globalName]) {
                reject(new Error(`Loaded ${url}, but ${globalName} was not defined.`));
                return;
            }
            resolve(globalThis[globalName]);
        };
        script.onerror = () => {
            script.remove();
            reject(new Error(`Could not load ${url}. The extension appears to be installed incompletely; reinstall it.`));
        };
        document.head.append(script);
    });
}

// A loader that fetches the script once and shares the promise; a failed load
// is forgotten so the next call tries again.
export function createScriptLoader(url, globalName) {
    let promise;
    return () => {
        if (!promise) {
            promise = loadScript(url, globalName).catch(error => {
                promise = undefined;
                throw error;
            });
        }
        return promise;
    };
}
