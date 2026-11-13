// Status line texts shared by every path that leaves the extension idle.

export function getIdleStatus(hasTheme) {
    return hasTheme
        ? 'Theme ready. Generate another or download the MIDI.'
        : 'Ready when a character chat is open.';
}
