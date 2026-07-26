import assert from 'node:assert/strict';
import test from 'node:test';

import * as directorApi from '../v2/director/index.mjs';
import {
    adjudicateClaim,
    adjudicateTurnBoundary,
    adjudicateUnverifiedCode,
    buildMainModelContext,
    createFactCandidate,
    createKnowledgeState,
    createTurnBoundary,
    recallDirectorRisks,
    transitionFact,
    transitionKnowledge,
    validateMainModelContext,
} from '../v2/director/index.mjs';
import {
    createBranch,
    createMessageFingerprint,
    hashText,
} from '../v2/transaction/index.mjs';

function fingerprint({
    branchId = 'branch-current',
    messageId = 'message-current',
    content = 'current reply',
    generation = 1,
} = {}) {
    const result = createMessageFingerprint({
        chatId: 'chat-director',
        logicalIndex: 4,
        messageId,
        swipeId: 0,
        generation,
        branchId,
        parentHash: hashText('parent reply'),
        content,
    });
    assert.equal(result.status, 'valid');
    return result.value;
}

function branch(target = fingerprint()) {
    const result = createBranch({
        id: target.branchId,
        divergenceFingerprint: target,
        headFingerprint: target,
        checkpointRef: 'checkpoint:director',
    });
    assert.equal(result.status, 'valid');
    return result.value;
}

function evidence(kind = 'message', ref = 'message:current') {
    return {
        kind,
        ref,
        branchId: 'branch-current',
    };
}

function boundary(target = fingerprint(), overrides = {}) {
    const result = createTurnBoundary({
        id: 'turn-boundary:current',
        branchId: target.branchId,
        target,
        authorizations: [{
            id: 'authorization:dialogue',
            kind: 'dialogue',
            actorId: 'player',
            exactText: '青灯四十',
            evidence: [evidence()],
        }],
        negativeConstraints: [
            'no_movement',
            'no_extra_action',
            'no_tone',
            'no_attitude',
            'no_psychology',
        ],
        claims: [{
            id: 'claim:selected',
            proposition: '旅店可以借热水',
            selected: true,
            evidence: [evidence()],
        }],
        unselectedCandidateIds: ['candidate:not-selected'],
        protectedPlayerStateRefs: ['/player/position'],
        darkChoices: [{
            id: 'choice:threat',
            selected: true,
            summary: '明确选择威胁守卫并承担后果',
            evidence: [evidence('user-confirmation', 'user:choice:threat')],
        }],
        ...overrides,
    });
    assert.equal(result.status, 'valid');
    return result.value;
}

function claimInput({
    impact,
    createsPersistentFact = false,
    mechanicalAdvantage = false,
    contradiction = false,
    explicitRetcon = false,
    h2Resolution,
} = {}) {
    const target = fingerprint();
    return {
        claim: {
            id: `claim:${impact}`,
            factId: `fact:${impact}`,
            proposition: `测试 ${impact} 主张`,
            branchId: target.branchId,
            subjectIds: ['subject:test'],
            evidence: [evidence()],
        },
        assessment: {
            impact,
            createsPersistentFact,
            mechanicalAdvantage,
            contradictsConfirmedFact: contradiction,
            semanticBasis: [`structured:${impact}`],
        },
        context: {
            target,
            currentFingerprint: target,
            activeBranch: branch(target),
            explicitRetcon,
            checkpointRef: 'checkpoint:director',
            ...(h2Resolution ? { h2Resolution } : {}),
        },
    };
}

test('director public entry exposes the host-free phase-3 API', () => {
    for (const name of [
        'createTurnBoundary',
        'adjudicateTurnBoundary',
        'recallDirectorRisks',
        'classifyClaimImpact',
        'adjudicateClaim',
        'createFactCandidate',
        'transitionFact',
        'createKnowledgeState',
        'transitionKnowledge',
        'adjudicateUnverifiedCode',
        'buildMainModelContext',
        'validateMainModelContext',
    ]) {
        assert.equal(typeof directorApi[name], 'function', `${name} must be public`);
    }
});

test('risk recall requests semantic review but never emits a final decision', () => {
    const recalled = recallDirectorRisks(
        '你后退半步，故作镇定，心里已经相信这就是内部联络暗号。',
    );
    assert.equal(recalled.semanticReviewRequired, true);
    assert.equal(recalled.finalDecision, null);
    assert.ok(recalled.candidates.length >= 3);
    assert.ok(recalled.candidates.every((entry) => entry.requiresSemanticReview));
});

test('Turn Boundary rejects only structured player violations after recall', () => {
    const target = fingerprint();
    const turn = boundary(target);
    const recall = recallDirectorRisks('你后退半步，故作镇定，心里已经相信对方。');
    const result = adjudicateTurnBoundary(turn, {
        riskRecall: recall,
        contributions: [
            {
                id: 'candidate:dialogue',
                actor: 'player',
                actorId: 'player',
                kind: 'dialogue',
                source: 'model-proposal',
                authorizationId: 'authorization:dialogue',
                content: '青灯四十',
            },
            {
                id: 'candidate:movement',
                actor: 'player',
                actorId: 'player',
                kind: 'movement',
                source: 'model-proposal',
                stateRef: '/player/position',
            },
            {
                id: 'candidate:tone',
                actor: 'player',
                actorId: 'player',
                kind: 'tone',
                source: 'model-proposal',
            },
            {
                id: 'candidate:psychology',
                actor: 'player',
                actorId: 'player',
                kind: 'psychology',
                source: 'model-proposal',
            },
            {
                id: 'candidate:npc-reaction',
                actor: 'npc',
                actorId: 'guard',
                kind: 'npc-reaction',
                source: 'model-proposal',
            },
        ],
    }, {
        currentFingerprint: target,
        activeBranch: branch(target),
    });

    assert.equal(result.decision, 'reject');
    assert.deepEqual(
        result.allowedContributions.map((entry) => entry.id),
        ['candidate:dialogue', 'candidate:npc-reaction'],
    );
    assert.ok(result.violations.some((entry) => (
        entry.code === 'boundary.explicit_negative_constraint'
    )));
    assert.ok(result.violations.some((entry) => (
        entry.code === 'boundary.protected_player_state'
    )));
});

test('Turn Boundary never accepts malformed semantic contributions', () => {
    const target = fingerprint();
    const result = adjudicateTurnBoundary(boundary(target), {
        contributions: [{
            id: 'candidate:malformed',
            actor: 'player',
            actorId: 'player',
            kind: 'not-a-player-contribution',
            source: 'model-proposal',
        }],
    }, {
        currentFingerprint: target,
        activeBranch: branch(target),
    });
    assert.equal(result.ok, false);
    assert.equal(result.validationStatus, 'rejected');
    assert.equal(result.decision, 'unresolved');
    assert.equal(result.allowedContributions.length, 0);
    assert.equal(result.blockedContributions.length, 1);
});

test('unselected candidates stay excluded and selected dark choices are not washed', () => {
    const target = fingerprint();
    const turn = boundary(target, {
        negativeConstraints: ['no_movement'],
    });
    const unselected = adjudicateTurnBoundary(turn, {
        contributions: [{
            id: 'candidate:borrowed-choice',
            actor: 'player',
            actorId: 'player',
            kind: 'decision',
            source: 'model-proposal',
            candidateId: 'candidate:not-selected',
        }],
    });
    assert.equal(unselected.decision, 'reject');
    assert.ok(unselected.violations.some((entry) => (
        entry.code === 'boundary.unselected_candidate'
    )));

    const preserved = adjudicateTurnBoundary(turn, {
        contributions: [{
            id: 'candidate:chosen-threat',
            actor: 'player',
            actorId: 'player',
            kind: 'action',
            source: 'player-input',
            darkChoiceId: 'choice:threat',
        }],
        reframesSelectedDarkChoice: false,
    });
    assert.equal(preserved.decision, 'accept');
    assert.equal(preserved.preservesSelectedDarkChoices, true);

    const washed = adjudicateTurnBoundary(turn, {
        contributions: [{
            id: 'candidate:chosen-threat',
            actor: 'player',
            actorId: 'player',
            kind: 'action',
            source: 'player-input',
            darkChoiceId: 'choice:threat',
        }],
        reframesSelectedDarkChoice: true,
    });
    assert.equal(washed.decision, 'reject');
    assert.ok(washed.violations.some((entry) => (
        entry.code === 'boundary.dark_choice_reframed'
    )));
});

test('H0 and H1 remain low friction while H1 records a branch-local fact', () => {
    const h0 = adjudicateClaim(claimInput({
        impact: 'cosmetic',
    }));
    assert.equal(h0.status, 'valid');
    assert.equal(h0.adjudication.level, 'H0');
    assert.equal(h0.adjudication.decision, 'accept');
    assert.equal(h0.fact, null);

    const h1 = adjudicateClaim(claimInput({
        impact: 'local',
        createsPersistentFact: true,
    }));
    assert.equal(h1.status, 'valid');
    assert.equal(h1.adjudication.level, 'H1');
    assert.equal(h1.adjudication.decision, 'accept');
    assert.equal(h1.fact.status, 'confirmed');
    assert.equal(h1.fact.scope, 'branch');
    assert.equal(h1.fact.branchId, 'branch-current');
});

test('missing semantic basis cannot expose a confirmed H1 fact', () => {
    const input = claimInput({
        impact: 'local',
        createsPersistentFact: true,
    });
    input.assessment.semanticBasis = [];
    const result = adjudicateClaim(input);
    assert.equal(result.ok, false);
    assert.notEqual(result.status, 'valid');
    assert.notEqual(result.adjudication.decision, 'accept');
    assert.equal(result.fact, null);
});

test('H2 emits an explicit check or typed cost and stays candidate until resolution', () => {
    const checked = adjudicateClaim(claimInput({
        impact: 'material',
        mechanicalAdvantage: true,
        h2Resolution: {
            type: 'check',
            checkId: 'campaign:deception',
            difficulty: 14,
        },
    }));
    assert.equal(checked.status, 'valid');
    assert.equal(checked.adjudication.level, 'H2');
    assert.equal(checked.adjudication.decision, 'roll_required');
    assert.equal(checked.fact.status, 'candidate');
    assert.equal(
        checked.adjudication.commands.find((entry) => entry.type === 'check')
            .payload.checkId,
        'campaign:deception',
    );

    const cost = adjudicateClaim(claimInput({
        impact: 'material',
        mechanicalAdvantage: true,
        h2Resolution: {
            type: 'cost',
            resource: { ownerId: 'player', resourceId: 'favor' },
            amount: 1,
            reason: '消耗一份明确的人情资源',
        },
    }));
    assert.equal(cost.adjudication.decision, 'accept_with_cost');
    assert.equal(
        cost.adjudication.commands.find((entry) => entry.type === 'cost')
            .payload.amount,
        1,
    );

    const unresolved = adjudicateClaim(claimInput({
        impact: 'material',
        mechanicalAdvantage: true,
    }));
    assert.equal(unresolved.status, 'unresolved');
    assert.equal(unresolved.adjudication.decision, 'pending');
    assert.equal(unresolved.fact.status, 'candidate');
});

test('H3 preserves the current branch unless explicit retcon requests a new branch', () => {
    const rejected = adjudicateClaim(claimInput({
        impact: 'structural',
        contradiction: true,
    }));
    assert.equal(rejected.status, 'valid');
    assert.equal(rejected.adjudication.level, 'H3');
    assert.equal(rejected.adjudication.decision, 'reject');
    assert.deepEqual(rejected.adjudication.commands, []);

    const branched = adjudicateClaim(claimInput({
        impact: 'structural',
        contradiction: true,
        explicitRetcon: true,
    }));
    assert.equal(branched.status, 'valid');
    assert.equal(branched.adjudication.decision, 'branch_required');
    const command = branched.adjudication.commands[0];
    assert.equal(command.type, 'new-branch');
    assert.equal(command.payload.kind, 'explicit-fork');
    assert.equal(command.payload.preservesParentBranch, true);
    assert.equal(command.payload.requiresNewFingerprint, true);

    const missingCheckpointInput = claimInput({
        impact: 'structural',
        contradiction: true,
        explicitRetcon: true,
    });
    delete missingCheckpointInput.context.checkpointRef;
    const missingCheckpoint = adjudicateClaim(missingCheckpointInput);
    assert.equal(missingCheckpoint.ok, false);
    assert.equal(missingCheckpoint.adjudication.decision, 'reject');
    assert.deepEqual(missingCheckpoint.adjudication.commands, []);
});

test('Fact confirmation rejects message-only random claims and accepts explicit evidence bases', () => {
    const target = fingerprint();
    const candidate = createFactCandidate({
        id: 'fact:code',
        proposition: '蓝塔十七是秘密协议',
        scope: 'branch',
        branchId: target.branchId,
        subjectIds: [],
        evidence: [evidence('message', 'message:random-code')],
        impact: 'material',
    }, {
        source: 'random-code',
        activeBranch: branch(target),
    });
    assert.equal(candidate.value.status, 'candidate');

    const denied = transitionFact(candidate.value, {
        type: 'confirm',
        basis: 'verified-state',
        evidence: [evidence('message', 'message:random-code')],
    }, {
        activeBranch: branch(target),
    });
    assert.equal(denied.decision, 'hold');
    assert.equal(denied.status, 'unresolved');
    assert.equal(denied.value.status, 'candidate');

    const messageOnlyH1 = transitionFact(candidate.value, {
        type: 'confirm',
        basis: 'adjudicated-h1',
        evidence: [evidence('message', 'message:random-code')],
    }, {
        activeBranch: branch(target),
    });
    assert.equal(messageOnlyH1.decision, 'hold');
    assert.equal(messageOnlyH1.value.status, 'candidate');

    const confirmed = transitionFact(candidate.value, {
        type: 'confirm',
        basis: 'resolved-h2',
        resolutionSucceeded: true,
        evidence: [evidence('roll', 'roll:code-verification')],
    }, {
        activeBranch: branch(target),
    });
    assert.equal(confirmed.decision, 'apply');
    assert.equal(confirmed.value.status, 'confirmed');
});

test('Knowledge suspicion, knowing and verification remain separate from Fact truth', () => {
    const target = fingerprint();
    const currentBranch = branch(target);
    const fact = createFactCandidate({
        id: 'fact:hidden-door',
        proposition: '北墙后有一道门',
        scope: 'branch',
        branchId: target.branchId,
        subjectIds: ['north-wall'],
        evidence: [evidence()],
        impact: 'local',
    }, { activeBranch: currentBranch }).value;
    const suspected = createKnowledgeState({
        id: 'knowledge:npc',
        knowerId: 'npc-guard',
        factId: fact.id,
        branchId: target.branchId,
        visibility: 'private',
        acquiredBy: [evidence('message', 'npc:suspicion')],
    }, {
        source: 'suspicion',
        activeBranch: currentBranch,
    });
    assert.equal(suspected.value.state, 'suspected');
    assert.equal(fact.status, 'candidate');

    const denied = transitionKnowledge(suspected.value, {
        type: 'verify',
        mode: 'verification',
        evidence: [evidence('message', 'npc:suspicion')],
    }, {
        fact,
        activeBranch: currentBranch,
    });
    assert.equal(denied.decision, 'hold');
    assert.equal(denied.value.state, 'suspected');

    const missingEvidence = transitionKnowledge(suspected.value, {
        type: 'suspect',
        evidence: [],
    }, {
        fact,
        activeBranch: currentBranch,
    });
    assert.equal(missingEvidence.decision, 'hold');
    assert.equal(missingEvidence.changed, false);
    assert.deepEqual(missingEvidence.value, suspected.value);

    const confirmedFact = transitionFact(fact, {
        type: 'confirm',
        basis: 'verified-state',
        evidence: [evidence('state', 'state:north-wall')],
    }, { activeBranch: currentBranch }).value;
    assert.equal(confirmedFact.status, 'confirmed');
    assert.equal(
        suspected.value.state,
        'suspected',
        'confirming a Fact must not mutate every Knowledge record',
    );

    const verified = transitionKnowledge(suspected.value, {
        type: 'verify',
        mode: 'verification',
        evidence: [evidence('state', 'observation:north-wall')],
    }, {
        fact: confirmedFact,
        activeBranch: currentBranch,
    });
    assert.equal(verified.decision, 'apply');
    assert.equal(verified.value.state, 'verified');
});

test('main-model context filters branches and perspectives and marks recall non-final', () => {
    const target = fingerprint();
    const turn = boundary(target);
    const fact = createFactCandidate({
        id: 'fact:context',
        proposition: '当前分支候选事实',
        branchId: target.branchId,
        scope: 'branch',
        subjectIds: [],
        evidence: [evidence()],
        impact: 'local',
    }).value;
    const knowledge = createKnowledgeState({
        id: 'knowledge:context',
        knowerId: 'npc-visible',
        factId: fact.id,
        branchId: target.branchId,
        visibility: 'private',
        acquiredBy: [evidence()],
    }, { source: 'suspicion' }).value;
    const built = buildMainModelContext(turn, {
        currentFingerprint: target,
        facts: [fact],
        knowledge: [
            knowledge,
            { ...knowledge, id: 'knowledge:hidden-perspective', knowerId: 'npc-hidden' },
            {
                ...knowledge,
                id: 'knowledge:old-branch',
                branchId: 'branch-old',
                acquiredBy: [{ ...evidence(), branchId: 'branch-old' }],
            },
        ],
        perspectiveIds: ['npc-visible'],
        riskRecall: recallDirectorRisks('你后退半步。'),
    });
    assert.equal(built.status, 'valid');
    assert.equal(built.value.facts.candidates.length, 1);
    assert.equal(built.value.perspectiveKnowledge.length, 1);
    assert.deepEqual(
        built.value.playerBoundary.excludedCandidateIds,
        ['candidate:not-selected'],
    );
    assert.equal(built.value.director.riskRecall.finalDecision, null);
    assert.equal(validateMainModelContext(built.value).status, 'valid');
});

test('random-code convenience guard never emits social identity or verified knowledge', () => {
    const target = fingerprint();
    const result = adjudicateUnverifiedCode({
        fact: {
            id: 'fact:random-code',
            proposition: '蓝塔十七是秘密协议',
            branchId: target.branchId,
            scope: 'branch',
            subjectIds: [],
            evidence: [evidence()],
            impact: 'material',
        },
        npcKnowledge: {
            id: 'knowledge:random-code',
            knowerId: 'npc-a',
            factId: 'fact:random-code',
            branchId: target.branchId,
            visibility: 'private',
            acquiredBy: [evidence('message', 'npc:heard-code')],
        },
        activeBranch: branch(target),
    });
    assert.equal(result.decision, 'reject-confirmation');
    assert.equal(result.fact.status, 'candidate');
    assert.equal(result.knowledge.state, 'suspected');
    assert.deepEqual(result.grants, []);
});
