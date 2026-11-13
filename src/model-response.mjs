// Reading a model's answer: unwrap the text from whatever shape the transport
// returned, then read the one JSON object in it. Shared by the brief and the
// score parsers, which differ only in what they do with a failure.

// LLM transports differ: some backends yield a bare JSON string, others the raw
// completion object (e.g. {choices:[{message:{content}}]}). Unwrap every shape
// seen in the wild so the parsers never depend on one transport; returns null
// when the input is not text-like, i.e. an already-parsed object.
export function normalizeResponseText(response) {
    if (typeof response === 'string') {
        return response;
    }
    if (!response || typeof response !== 'object' || Array.isArray(response)) {
        return null;
    }
    let content;
    if (Array.isArray(response.choices)) {
        const first = response.choices[0] ?? {};
        content = first.message?.content ?? first.text ?? null;
    } else if (response.message && typeof response.message === 'object') {
        content = response.message.content ?? null;
    }
    if (typeof content === 'string') {
        return content;
    }
    if (Array.isArray(content)) {
        return content.map(part => (typeof part?.text === 'string' ? part.text : '')).join('');
    }
    return null;
}

// The JSON object in a model's answer, tolerating code fences and prose around
// it. Throws with a message naming `what` (brief, score) when there is none,
// when it does not parse, or when the transport payload never unwrapped.
export function readJsonObject(response, what) {
    const text = normalizeResponseText(response);
    let value = response;

    if (text !== null) {
        const cleaned = text
            .trim()
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```$/, '');
        const start = cleaned.indexOf('{');
        const end = cleaned.lastIndexOf('}');

        if (start < 0 || end < start) {
            throw new Error(`The model response did not contain a JSON ${what}.`);
        }

        try {
            value = JSON.parse(cleaned.slice(start, end + 1));
        } catch (error) {
            throw new Error(`The model returned invalid JSON: ${error.message}`);
        }
    }

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`The ${what} must be a JSON object.`);
    }
    // An API payload that never unwrapped to text is a failed extraction, not
    // an answer: fail with the missing-JSON error so the caller can retry.
    if (text === null && (Array.isArray(value.choices) || (value.message && typeof value.message === 'object'))) {
        throw new Error(`The model response did not contain a JSON ${what}.`);
    }
    return value;
}
