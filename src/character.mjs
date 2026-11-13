// The character profile both prompts read: the card's text fields, each cut to
// a length the prompts can carry, escaped and wrapped in its own tag.
import { escapeXml } from './xml.mjs';

const MAX_FIELD_LENGTH = 1800;

// card: a SillyTavern character (fields at the top level or under data).
// Returns { name, profileFields }; throws when the card has no text to use.
export function buildCharacterProfile(card, fallbackName) {
    const data = card.data ?? {};
    const fields = [
        ['description', card.description ?? data.description],
        ['personality', card.personality ?? data.personality],
        ['scenario', card.scenario ?? data.scenario],
        ['first_message', card.first_mes ?? data.first_mes],
    ];
    const profileFields = fields
        .map(([tag, text]) => {
            const value = typeof text === 'string' ? text.trim().slice(0, MAX_FIELD_LENGTH) : '';
            if (!value) {
                return '';
            }
            return `<${tag}>\n${escapeXml(value)}\n</${tag}>`;
        })
        .filter(Boolean)
        .join('\n');

    if (!profileFields) {
        throw new Error('The active character card has no description, personality, scenario, or first message to use.');
    }

    return {
        name: card.name || fallbackName || 'Character',
        profileFields,
    };
}
