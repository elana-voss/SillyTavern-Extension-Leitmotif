// Escaping for text placed inside the prompts' XML-style tags, so a card's
// own angle brackets cannot open or close a tag.

export function escapeXml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
