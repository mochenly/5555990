export const SECRET_OWNERS = ['user', 'char', 'world'];
export const secretKey = value => String(value || '').normalize('NFKC').toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]/gu, '');
export const secretLimit = (settings, owner) => {
    const value = settings?.secretLimits?.[owner];
    return value === undefined || value === null || value === '' || !Number.isFinite(Number(value)) ? 10 : Math.max(0, Math.min(100, Math.floor(Number(value))));
};
export const secretCount = (state, owner) => [...state.secrets.revealed, ...state.secrets.unrevealed].filter(item => (item.owner || 'char') === owner).length;
export const secretSlots = (state, settings, owner) => Math.max(0, secretLimit(settings, owner) - secretCount(state, owner));
export function sameSecret(a, b) {
    const title = secretKey(a.title);
    const summary = secretKey(a.summary);
    return Boolean(title && (title === secretKey(b.title) || secretKey(String(a.title).slice(0, 60)) === secretKey(String(b.title).slice(0, 60)) || title === secretKey(b.summary))
        || summary && (summary === secretKey(b.summary) || summary === secretKey(b.title)));
}
export function secretRules(state, settings) {
    return 'Secrets: title is a stable label of 2-6 words (max 60 characters); summary is ONE factual sentence of at most 25 words (max 180 characters), including who knows only if established. No scene recap, prose, explanations, consequences or reveal scenarios. A secret is a concrete concealed truth, not an ordinary event, observation, feeling, suspicion, open question, plan or publicly known fact. owner: user = personal secret of the user character; char = personal secret of the main character; world = concealed truth about places, institutions, history or other inhabitants, outside those two people. World is NOT a catch-all for plot events. Compare meaning against ALL recorded secrets, revealed and hidden, across ALL categories: never paraphrase, split or reclassify the same fact as a new entry; reuse the exact existing title for corrections and disclosure. An empty list is valid; limits are ceilings, never targets. Maximum additional entries by owner: '
        + JSON.stringify(Object.fromEntries(SECRET_OWNERS.map(owner => [owner, secretSlots(state, settings, owner)]))) + '.';
}
