import { deepClone, isPlainObject } from '../domain/common.mjs';

export const DIRECTOR_RISK_KINDS = Object.freeze([
    'player-movement',
    'player-extra-action',
    'player-dialogue',
    'player-tone',
    'player-attitude',
    'player-psychology',
    'player-skill-use',
    'player-resource-consumption',
    'player-check',
    'unselected-candidate',
    'fact-confirmation',
    'knowledge-verification',
    'insider-status',
]);

const DEFAULT_RECALL_RULES = Object.freeze([
    Object.freeze({
        id: 'recall.player.movement',
        riskKind: 'player-movement',
        pattern: /(?:后退|前进|走向|转身|移步|冲向|退开|迈步)/gu,
    }),
    Object.freeze({
        id: 'recall.player.psychology',
        riskKind: 'player-psychology',
        pattern: /(?:心里|内心|暗自|已经相信|意识到自己|感到自己)/gu,
    }),
    Object.freeze({
        id: 'recall.player.tone',
        riskKind: 'player-tone',
        pattern: /(?:故作镇定|语气|口吻|冷冷地|温柔地|坚定地)/gu,
    }),
    Object.freeze({
        id: 'recall.fact.confirmation',
        riskKind: 'fact-confirmation',
        pattern: /(?:确认(?:这|其)?是|事实证明|这就是|确实是|内部联络暗号)/gu,
    }),
    Object.freeze({
        id: 'recall.knowledge.verification',
        riskKind: 'knowledge-verification',
        pattern: /(?:已经查证|得到验证|完全知晓|早就知道)/gu,
    }),
    Object.freeze({
        id: 'recall.insider.status',
        riskKind: 'insider-status',
        pattern: /(?:自己人|内部成员|同一阵营|获得通行身份)/gu,
    }),
]);

function cloneRegex(pattern) {
    if (!(pattern instanceof RegExp)) return null;
    const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
    return new RegExp(pattern.source, flags);
}

function normalizeRule(rule) {
    if (!isPlainObject(rule)) return null;
    const pattern = cloneRegex(rule.pattern);
    if (
        typeof rule.id !== 'string'
        || !rule.id.trim()
        || !DIRECTOR_RISK_KINDS.includes(rule.riskKind)
        || !pattern
    ) {
        return null;
    }
    return {
        id: rule.id.trim(),
        riskKind: rule.riskKind,
        pattern,
    };
}

/**
 * Cheap text matching is deliberately limited to recall. Its output says only
 * which bounded semantic review is worth running; it can never accept, reject,
 * confirm a fact, or verify knowledge.
 */
export function recallDirectorRisks(text, {
    rules = DEFAULT_RECALL_RULES,
    maxCandidates = 32,
} = {}) {
    const source = typeof text === 'string' ? text : '';
    const candidates = [];
    const normalizedRules = Array.isArray(rules)
        ? rules.map(normalizeRule).filter(Boolean)
        : [];

    for (const rule of normalizedRules) {
        rule.pattern.lastIndex = 0;
        let match;
        while (
            candidates.length < maxCandidates
            && (match = rule.pattern.exec(source)) !== null
        ) {
            candidates.push({
                id: `${rule.id}:${match.index}`,
                ruleId: rule.id,
                riskKind: rule.riskKind,
                range: {
                    start: match.index,
                    end: match.index + match[0].length,
                },
                requiresSemanticReview: true,
            });
            if (!match[0].length) rule.pattern.lastIndex += 1;
        }
        if (candidates.length >= maxCandidates) break;
    }

    return {
        stage: 'risk-recall',
        finalDecision: null,
        semanticReviewRequired: candidates.length > 0,
        candidates,
        sourceLength: source.length,
        truncated: candidates.length >= maxCandidates,
    };
}

export function normalizeRiskRecall(input) {
    const source = isPlainObject(input) ? input : {};
    return {
        stage: 'risk-recall',
        finalDecision: null,
        semanticReviewRequired: source.semanticReviewRequired === true,
        candidates: Array.isArray(source.candidates)
            ? source.candidates
                .filter((entry) => (
                    isPlainObject(entry)
                    && DIRECTOR_RISK_KINDS.includes(entry.riskKind)
                ))
                .map((entry) => ({
                    id: String(entry.id || ''),
                    ruleId: String(entry.ruleId || ''),
                    riskKind: entry.riskKind,
                    ...(isPlainObject(entry.range)
                        ? { range: deepClone(entry.range) }
                        : {}),
                    requiresSemanticReview: true,
                }))
            : [],
        sourceLength: Number.isInteger(source.sourceLength)
            ? source.sourceLength
            : 0,
        truncated: source.truncated === true,
    };
}

export { DEFAULT_RECALL_RULES };
