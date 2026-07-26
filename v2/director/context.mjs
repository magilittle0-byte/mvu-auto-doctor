import {
    addIssue,
    deepClone,
    isPlainObject,
    requirePlainObject,
    requireString,
    validationResult,
} from '../domain/common.mjs';
import {
    validateClaimAdjudication,
    validateFact,
    validateKnowledge,
} from '../domain/state.mjs';
import { compareMessageFingerprints } from '../transaction/fingerprint.mjs';
import { validateTurnBoundary } from './boundary.mjs';
import { normalizeRiskRecall } from './recall.mjs';

export const MAIN_MODEL_CONTEXT_VERSION = '2.0-phase3';

function selectedClaims(boundary) {
    return boundary.claims
        .filter((claim) => claim.selected)
        .map((claim) => ({
            id: claim.id,
            proposition: claim.proposition,
            evidence: deepClone(claim.evidence),
        }));
}

function publicAuthorization(entry) {
    return {
        id: entry.id,
        kind: entry.kind,
        actorId: entry.actorId,
        ...(entry.exactText === undefined ? {} : { exactText: entry.exactText }),
        ...(entry.skillId === undefined ? {} : { skillId: entry.skillId }),
        ...(entry.resourceRef === undefined
            ? {}
            : { resourceRef: deepClone(entry.resourceRef) }),
    };
}

function publicConstraint(entry) {
    return {
        id: entry.id,
        kind: entry.kind,
        actorId: entry.actorId,
    };
}

function visibleFact(entry) {
    return {
        id: entry.id,
        proposition: entry.proposition,
        status: entry.status,
        scope: entry.scope,
        branchId: entry.branchId,
        subjectIds: deepClone(entry.subjectIds),
        impact: entry.impact,
        evidenceRefs: entry.evidence.map((evidence) => ({
            kind: evidence.kind,
            ref: evidence.ref,
            branchId: evidence.branchId,
            ...(evidence.excerptHash === undefined
                ? {}
                : { excerptHash: evidence.excerptHash }),
        })),
    };
}

function visibleKnowledge(entry) {
    return {
        id: entry.id,
        knowerId: entry.knowerId,
        factId: entry.factId,
        state: entry.state,
        visibility: entry.visibility,
        branchId: entry.branchId,
        acquiredByRefs: entry.acquiredBy.map((evidence) => ({
            kind: evidence.kind,
            ref: evidence.ref,
            branchId: evidence.branchId,
            ...(evidence.excerptHash === undefined
                ? {}
                : { excerptHash: evidence.excerptHash }),
        })),
    };
}

function commandProjection(decision) {
    if (!isPlainObject(decision)) return [];
    const adjudication = isPlainObject(decision.adjudication)
        ? decision.adjudication
        : decision;
    return Array.isArray(adjudication.commands)
        ? adjudication.commands.map((command) => deepClone(command))
        : [];
}

export function buildMainModelContext(boundaryInput, {
    currentFingerprint,
    facts = [],
    knowledge = [],
    perspectiveIds = [],
    claimDecisions = [],
    boundaryDecision,
    riskRecall,
} = {}) {
    const boundaryResult = validateTurnBoundary(boundaryInput);
    const boundary = boundaryResult.value;
    const issues = [...boundaryResult.issues];
    if (currentFingerprint !== undefined) {
        const match = compareMessageFingerprints(boundary.target, currentFingerprint);
        issues.push(...match.issues);
        if (!match.ok) {
            addIssue(
                issues,
                'director.context_target_stale',
                '$.target',
                '主模型上下文不能复用到不同消息指纹。',
            );
        }
    }

    const validatedFacts = [];
    for (const [index, input] of facts.entries()) {
        const result = validateFact(input);
        issues.push(...result.issues.map((issue) => ({
            ...issue,
            path: `$.facts[${index}]${issue.path === '$' ? '' : issue.path.slice(1)}`,
        })));
        if (!result.ok) continue;
        if (result.value.branchId !== boundary.branchId) {
            addIssue(
                issues,
                'director.context_fact_branch',
                `$.facts[${index}].branchId`,
                '其他分支的事实不能进入当前主模型上下文。',
                'warning',
            );
            continue;
        }
        if (result.value.status === 'retracted') continue;
        validatedFacts.push(result.value);
    }

    const allowedPerspectives = new Set(
        Array.isArray(perspectiveIds) ? perspectiveIds.map(String) : [],
    );
    const validatedKnowledge = [];
    for (const [index, input] of knowledge.entries()) {
        const result = validateKnowledge(input);
        issues.push(...result.issues.map((issue) => ({
            ...issue,
            path: `$.knowledge[${index}]${issue.path === '$' ? '' : issue.path.slice(1)}`,
        })));
        if (!result.ok) continue;
        if (result.value.branchId !== boundary.branchId) {
            addIssue(
                issues,
                'director.context_knowledge_branch',
                `$.knowledge[${index}].branchId`,
                '其他分支的知识不能进入当前主模型上下文。',
                'warning',
            );
            continue;
        }
        if (!allowedPerspectives.has(result.value.knowerId)) continue;
        validatedKnowledge.push(result.value);
    }

    const decisions = [];
    for (const [index, input] of claimDecisions.entries()) {
        const adjudication = isPlainObject(input?.adjudication)
            ? input.adjudication
            : input;
        const result = validateClaimAdjudication(adjudication);
        issues.push(...result.issues.map((issue) => ({
            ...issue,
            path: `$.claimDecisions[${index}]${issue.path === '$' ? '' : issue.path.slice(1)}`,
        })));
        if (result.status === 'rejected') continue;
        decisions.push({
            level: result.value.level,
            decision: result.value.decision,
            claimIds: deepClone(result.value.claimIds),
            reason: result.value.reason,
            commands: deepClone(result.value.commands),
        });
    }

    const recall = normalizeRiskRecall(riskRecall);
    const context = {
        contractVersion: MAIN_MODEL_CONTEXT_VERSION,
        branchId: boundary.branchId,
        target: deepClone(boundary.target),
        playerBoundary: {
            authorizations: boundary.authorizations.map(publicAuthorization),
            negativeConstraints: boundary.negativeConstraints.map(publicConstraint),
            protectedPlayerStateRefs: deepClone(boundary.protectedPlayerStateRefs),
            selectedClaims: selectedClaims(boundary),
            excludedCandidateIds: deepClone(boundary.unselectedCandidateIds),
            selectedDarkChoices: boundary.darkChoices
                .filter((entry) => entry.selected)
                .map((entry) => ({
                    id: entry.id,
                    summary: entry.summary,
                    preserveMechanismAndConsequences: true,
                })),
        },
        narrativeSpace: {
            allowedKinds: deepClone(boundary.allowedNarrativeKinds),
            npcAndEnvironmentMayAct: true,
            playerContributionsRequireAuthorization: true,
        },
        facts: {
            confirmed: validatedFacts
                .filter((entry) => entry.status === 'confirmed')
                .map(visibleFact),
            disputed: validatedFacts
                .filter((entry) => entry.status === 'disputed')
                .map(visibleFact),
            candidates: validatedFacts
                .filter((entry) => entry.status === 'candidate')
                .map(visibleFact),
        },
        perspectiveKnowledge: validatedKnowledge.map(visibleKnowledge),
        director: {
            boundaryDecision: boundaryDecision?.decision ?? 'not-evaluated',
            claimDecisions: decisions,
            commands: decisions.flatMap((entry) => entry.commands),
            riskRecall: {
                semanticReviewRequired: recall.semanticReviewRequired,
                candidates: recall.candidates.map((entry) => ({
                    id: entry.id,
                    riskKind: entry.riskKind,
                    requiresSemanticReview: true,
                })),
                finalDecision: null,
            },
        },
        hardRules: [
            'Do not add player movement, action, dialogue, decision, skill use, resource cost, check, tone, attitude, psychology, or state change without matching authorization.',
            'Explicit negative constraints override narrative convenience.',
            'Unselected candidates are excluded from player intent, facts, and knowledge.',
            'NPC suspicion remains limited perspective and does not confirm world truth.',
            'Candidate facts and suspected knowledge must stay uncertain in prose.',
            'Selected dark choices keep their stated mechanism and consequences; do not morally rewrite them.',
            'Risk recall requests review only; it is never the final semantic decision.',
        ],
    };
    return validationResult(context, issues, {
        commands: decisions.flatMap(commandProjection),
    });
}

export function validateMainModelContext(input) {
    const source = isPlainObject(input) ? input : {};
    const issues = [];
    if (!requirePlainObject(input, issues)) return validationResult(source, issues);
    if (source.contractVersion !== MAIN_MODEL_CONTEXT_VERSION) {
        addIssue(
            issues,
            'director.context_version',
            '$.contractVersion',
            `主模型上下文合同版本必须是 ${MAIN_MODEL_CONTEXT_VERSION}。`,
        );
    }
    requireString(source.branchId, issues, '$.branchId');
    requirePlainObject(source.target, issues, '$.target');
    requirePlainObject(source.playerBoundary, issues, '$.playerBoundary');
    requirePlainObject(source.narrativeSpace, issues, '$.narrativeSpace');
    requirePlainObject(source.facts, issues, '$.facts');
    requirePlainObject(source.director, issues, '$.director');
    if (!Array.isArray(source.hardRules) || !source.hardRules.length) {
        addIssue(
            issues,
            'director.context_hard_rules',
            '$.hardRules',
            '主模型上下文必须携带玩家边界与事实/知识硬规则。',
        );
    }
    if (source.director?.riskRecall?.finalDecision !== null) {
        addIssue(
            issues,
            'director.context_recall_not_final',
            '$.director.riskRecall.finalDecision',
            '风险召回不得携带最终语义裁决。',
        );
    }
    return validationResult(deepClone(source), issues);
}
