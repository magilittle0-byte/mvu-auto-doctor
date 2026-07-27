import assert from 'node:assert/strict';
import test from 'node:test';

import {
    createTurnBoundary,
} from '../v2/director/index.mjs';
import {
    createBranch,
    createMessageFingerprint,
    hashCanonical,
    hashText,
} from '../v2/transaction/index.mjs';
import {
    adaptNaturalLanguageIntent,
    adaptUiAction,
    compareDualSurfaceParity,
    createDualSurfaceViewModel,
    diagnosticContainsSensitiveMaterial,
    planDualSurfaceDomainAction,
} from '../v2/surface/index.mjs';

function fingerprint() {
    const result = createMessageFingerprint({
        chatId: 'chat:phase5',
        logicalIndex: 12,
        messageId: 'message:phase5',
        swipeId: 0,
        generation: 1,
        branchId: 'branch:phase5',
        parentHash: hashText('phase 5 parent'),
        content: 'phase 5 exact target',
    });
    assert.equal(result.status, 'valid');
    return result.value;
}

function branch(target) {
    const result = createBranch({
        id: target.branchId,
        divergenceFingerprint: target,
        headFingerprint: target,
        checkpointRef: 'checkpoint:phase5',
    });
    assert.equal(result.status, 'valid');
    return result.value;
}

function evidence(target, kind = 'message', ref = 'message:phase5') {
    return { kind, ref, branchId: target.branchId };
}

function record(id) {
    return {
        id,
        schemaVersion: '2.0',
        revision: 0,
    };
}

function buildCases(target) {
    const torso = { system: 'campaign-slots', slot: 'torso' };
    const potion = {
        ...record('item:potion'),
        name: '恢复药剂',
        kind: 'consumable',
        quantity: 2,
        stackable: true,
        description: '类型化恢复道具。',
        mechanics: {
            use: {
                consumes: 1,
                effects: [{
                    type: 'resource-delta',
                    delta: {
                        resource: { ownerId: 'player', resourceId: 'hp' },
                        amount: 20,
                        reason: 'typed healing',
                    },
                }],
            },
        },
        provenance: [evidence(target)],
    };
    const vestItem = {
        ...record('item:vest'),
        name: '防护背心',
        kind: 'equipment',
        quantity: 1,
        stackable: false,
        description: '明确槽位装备。',
        provenance: [evidence(target)],
    };
    const vest = {
        ...record('equipment:vest'),
        itemId: vestItem.id,
        allowedSlots: [torso],
        occupies: [torso],
        equippedAt: [],
        bonuses: [],
        provenance: [evidence(target)],
    };
    const skill = {
        ...record('skill:hack'),
        name: '基础骇入',
        mode: 'active',
        costs: [{
            resource: { ownerId: 'player', resourceId: 'mp' },
            amount: 20,
            timing: 'on-start',
            refundable: false,
        }],
        effects: [],
        displayCost: '20MP',
        provenance: [evidence(target)],
    };
    const socialBefore = {
        ...record('social:npc-player'),
        fromActorId: 'npc',
        toActorId: 'player',
        voluntary: { affection: 18, trust: 22 },
        coercive: { obedience: 0, sourceIds: [] },
        labels: ['acquaintance'],
        evidence: [evidence(target)],
        branchId: target.branchId,
    };
    const socialCandidate = {
        ...structuredClone(socialBefore),
        voluntary: { affection: 21, trust: 24 },
    };
    const questBefore = {
        ...record('quest:escort'),
        title: '护送向导',
        status: 'active',
        branchId: target.branchId,
        objectives: [{
            id: 'objective:escort',
            description: '护送到门口',
            status: 'active',
            evidence: [evidence(target)],
        }],
        settlementTransactionIds: [],
    };
    const questCandidate = {
        ...structuredClone(questBefore),
        status: 'cancelled',
        objectives: [{
            ...structuredClone(questBefore.objectives[0]),
            status: 'cancelled',
        }],
        terminalEvidence: [
            evidence(target, 'state', 'quest:escort:cancelled'),
        ],
    };

    return [
        {
            name: 'item',
            kind: 'resource-consumption',
            utterance: '使用恢复药剂',
            type: 'item-use',
            payload: { itemId: potion.id },
            campaign: {
                records: { item: { [potion.id]: '/items/potion' } },
                resources: [{
                    resource: { ownerId: 'player', resourceId: 'hp' },
                    path: '/resources/player/hp',
                    minimum: 0,
                    maximum: 100,
                }],
            },
            state: {
                records: {
                    item: { path: '/items/potion', before: potion },
                },
                resources: [{
                    resource: { ownerId: 'player', resourceId: 'hp' },
                    path: '/resources/player/hp',
                    before: 50,
                }],
            },
        },
        {
            name: 'equipment',
            kind: 'state-change',
            utterance: '穿上防护背心',
            type: 'equipment-equip',
            payload: {
                equipmentId: vest.id,
                itemId: vestItem.id,
                slots: [torso],
            },
            campaign: {
                records: {
                    item: { [vestItem.id]: '/items/vest' },
                    equipment: { [vest.id]: '/equipment/vest' },
                },
                slotTaxonomy: [torso],
                slotBindings: [{ slot: torso, path: '/loadout/torso' }],
            },
            state: {
                records: {
                    item: { path: '/items/vest', before: vestItem },
                    equipment: { path: '/equipment/vest', before: vest },
                },
                slots: [{
                    slot: torso,
                    path: '/loadout/torso',
                    before: null,
                }],
            },
        },
        {
            name: 'skill',
            kind: 'skill-use',
            utterance: '发动基础骇入',
            type: 'skill-use',
            payload: { skillId: skill.id, timing: 'on-start' },
            campaign: {
                records: { skill: { [skill.id]: '/skills/hack' } },
                resources: [{
                    resource: { ownerId: 'player', resourceId: 'mp' },
                    path: '/resources/player/mp',
                    minimum: 0,
                }],
            },
            state: {
                records: {
                    skill: { path: '/skills/hack', before: skill },
                },
                resources: [{
                    resource: { ownerId: 'player', resourceId: 'mp' },
                    path: '/resources/player/mp',
                    before: 30,
                }],
            },
        },
        {
            name: 'social',
            kind: 'state-change',
            utterance: '记录这次自愿关系变化',
            type: 'social-transition',
            payload: {
                socialId: socialBefore.id,
                voluntaryEvidence: true,
                coerciveEvidence: false,
                labelEvidence: false,
            },
            campaign: {
                records: { social: { [socialBefore.id]: '/social/link' } },
            },
            state: {
                records: {
                    social: {
                        path: '/social/link',
                        before: socialBefore,
                        candidate: socialCandidate,
                    },
                },
            },
        },
        {
            name: 'quest',
            kind: 'decision',
            utterance: '取消护送任务',
            type: 'quest-transition',
            payload: {
                questId: questBefore.id,
                terminalStatus: 'cancelled',
                resourceDeltas: [],
            },
            campaign: {
                records: { quest: { [questBefore.id]: '/quests/escort' } },
            },
            state: {
                records: {
                    quest: {
                        path: '/quests/escort',
                        before: questBefore,
                        candidate: questCandidate,
                    },
                },
            },
        },
    ];
}

function makeSession(testCase, target = fingerprint(), overrides = {}) {
    const authorizationId = `authorization:phase5:${testCase.name}`;
    const turn = createTurnBoundary({
        id: `turn:phase5:${testCase.name}`,
        branchId: target.branchId,
        target,
        authorizations: [{
            id: authorizationId,
            kind: testCase.kind,
            actorId: 'player',
            evidence: [evidence(target)],
        }],
        negativeConstraints: [],
        claims: [],
        unselectedCandidateIds: [],
        protectedPlayerStateRefs: [],
        darkChoices: [],
        ...(overrides.turnBoundary ?? {}),
    });
    assert.equal(turn.status, 'valid');
    return {
        catalog: [{
            id: `action:${testCase.name}`,
            label: `测试${testCase.name}`,
            utterances: [testCase.utterance],
            authorizationId,
            actorId: 'player',
            command: {
                type: testCase.type,
                payload: structuredClone(testCase.payload),
            },
            extensions: { futureField: 'round-trip' },
        }],
        target,
        currentFingerprint: target,
        activeBranch: branch(target),
        turnBoundary: turn.value,
        evidence: [evidence(target)],
        campaign: {
            id: `campaign:phase5:${testCase.name}`,
            version: 'rules:phase5',
            branchId: target.branchId,
            records: {},
            resources: [],
            slotTaxonomy: [],
            slotBindings: [],
            checks: [],
            effectBindings: {},
            ...structuredClone(testCase.campaign),
        },
        state: structuredClone(testCase.state),
        createdAt: 500,
        ...Object.fromEntries(
            Object.entries(overrides).filter(([key]) => key !== 'turnBoundary'),
        ),
    };
}

function confirm(session, source) {
    const first = planDualSurfaceDomainAction({ ...session, source });
    assert.equal(first.status, 'unresolved');
    assert.equal(first.value.decision, 'confirmation-required');
    const digest = first.value.candidate.confirmation.digest;
    return planDualSurfaceDomainAction({
        ...session,
        source,
        confirmation: { confirmed: true, digest },
    });
}

test('item, equipment, skill, social and quest produce exact dual-source parity', () => {
    const target = fingerprint();
    for (const testCase of buildCases(target)) {
        const session = makeSession(testCase, target);
        const natural = confirm(session, {
            kind: 'natural-language',
            text: `  ${testCase.utterance}  `,
        });
        const ui = confirm(session, {
            kind: 'ui',
            actionId: `action:${testCase.name}`,
        });
        assert.equal(natural.status, 'valid', testCase.name);
        assert.equal(ui.status, 'valid', testCase.name);

        const parity = compareDualSurfaceParity(natural, ui);
        assert.equal(parity.status, 'valid', testCase.name);
        assert.equal(parity.value.equivalent, true, testCase.name);
        assert.deepEqual(
            natural.value.candidate.command,
            ui.value.candidate.command,
            testCase.name,
        );
        assert.equal(
            natural.value.plan.value.idempotencyKey,
            ui.value.plan.value.idempotencyKey,
            testCase.name,
        );
        assert.deepEqual(
            natural.value.plan.value.transaction.preconditions,
            ui.value.plan.value.transaction.preconditions,
            testCase.name,
        );
        assert.equal(
            hashCanonical(natural.value.plan.value.transaction),
            hashCanonical(ui.value.plan.value.transaction),
            testCase.name,
        );
    }
});

test('natural-language parser is bounded and never guesses missing or ambiguous slots', () => {
    const target = fingerprint();
    const [itemCase] = buildCases(target);
    const session = makeSession(itemCase, target);
    const unknown = adaptNaturalLanguageIntent({
        intent: { text: '随便用一个东西' },
        catalog: session.catalog,
        target,
    });
    assert.equal(unknown.status, 'unresolved');
    assert.equal(unknown.value.command, null);
    assert.ok(unknown.issues.some((entry) => (
        entry.code === 'surface.action_unresolved'
    )));

    const semanticWithoutBasis = adaptNaturalLanguageIntent({
        intent: {
            text: '解析器声称已经理解',
            actionId: 'action:item',
        },
        catalog: session.catalog,
        target,
    });
    assert.equal(semanticWithoutBasis.status, 'unresolved');
    assert.ok(semanticWithoutBasis.issues.some((entry) => (
        entry.code === 'surface.semantic_basis_missing'
    )));

    const ambiguous = adaptNaturalLanguageIntent({
        intent: { text: itemCase.utterance },
        catalog: [
            ...session.catalog,
            {
                ...structuredClone(session.catalog[0]),
                id: 'action:item:duplicate',
            },
        ],
        target,
    });
    assert.equal(ambiguous.status, 'unresolved');
    assert.equal(ambiguous.value.command, null);
    assert.ok(ambiguous.issues.some((entry) => (
        entry.code === 'surface.utterance_ambiguous'
        || entry.code === 'surface.action_ambiguous'
    )));
});

test('UI cannot bypass confirmation, Turn Boundary, campaign config or exact target', () => {
    const target = fingerprint();
    const [itemCase] = buildCases(target);
    const session = makeSession(itemCase, target);
    const source = { kind: 'ui', actionId: 'action:item' };
    const unconfirmed = planDualSurfaceDomainAction({ ...session, source });
    assert.equal(unconfirmed.status, 'unresolved');
    assert.equal(unconfirmed.value.plan, null);

    const wrongDigest = planDualSurfaceDomainAction({
        ...session,
        source,
        confirmation: { confirmed: true, digest: 'sha256:stale-target' },
    });
    assert.equal(wrongDigest.status, 'unresolved');
    assert.equal(wrongDigest.value.plan, null);

    const blockedSession = makeSession(itemCase, target, {
        turnBoundary: {
            negativeConstraints: ['no_resource_consumption'],
        },
    });
    const blocked = confirm(blockedSession, source);
    assert.equal(blocked.status, 'rejected');
    assert.equal(blocked.value.director.decision, 'reject');
    assert.equal(blocked.value.plan.value.transaction, null);

    const noConfig = confirm({
        ...session,
        campaign: {
            ...session.campaign,
            records: {},
            resources: [],
        },
    }, source);
    assert.equal(noConfig.status, 'unresolved');
    assert.equal(noConfig.value.plan.value.transaction, null);
    assert.ok(noConfig.issues.some((entry) => (
        entry.code.includes('record') || entry.code.includes('resource')
    )));

    const staleTarget = {
        ...target,
        contentHash: hashText('changed content'),
    };
    const stale = confirm({
        ...session,
        currentFingerprint: staleTarget,
    }, source);
    assert.equal(stale.status, 'rejected');
    assert.equal(stale.value.plan.value.transaction, null);
});

test('catalog accepts only phase-4 native commands and preserves unknown payload fields', () => {
    const target = fingerprint();
    const [itemCase] = buildCases(target);
    const session = makeSession(itemCase, target);
    session.catalog[0].command.payload.extensions = {
        futureRule: { exact: true },
    };
    const adapted = adaptUiAction({
        action: { actionId: 'action:item' },
        catalog: session.catalog,
        target,
    });
    assert.equal(adapted.status, 'valid');
    assert.deepEqual(
        adapted.value.command.payload.extensions,
        { futureRule: { exact: true } },
    );

    const forged = adaptUiAction({
        action: { actionId: 'action:fact' },
        catalog: [{
            id: 'action:fact',
            label: '绕过阶段3',
            utterances: ['确认事实'],
            authorizationId: 'authorization:fact',
            command: {
                type: 'fact-confirm',
                payload: { factId: 'fact:forged' },
            },
        }],
        target,
    });
    assert.equal(forged.status, 'rejected');
    assert.ok(forged.issues.some((entry) => (
        entry.code === 'surface.command_type'
    )));
});

test('audit diagnostics expose decisions and hashes without private material', () => {
    const target = fingerprint();
    const [itemCase] = buildCases(target);
    const session = makeSession(itemCase, target);
    session.evidence = [
        evidence(
            target,
            'message',
            'private chat says api_key=sk-secret and full hidden prompt',
        ),
    ];
    const result = confirm(session, {
        kind: 'natural-language',
        text: itemCase.utterance,
    });
    result.value.director.explanation = [
        'private fact: the hidden witness is someone-specific',
    ];
    const audit = createDualSurfaceViewModel(result, {
        visibility: 'audit',
        migrations: [{
            kind: 'legacy-item',
            status: 'unresolved',
            path: 'C:\\Users\\someone\\private.json',
            diagnostic: 'password=hunter2',
            canTransact: false,
        }],
        rollback: {
            available: true,
            status: 'recoverable',
            pathCount: 2,
            recordId: 'rollback:private-user-message',
        },
    });
    assert.equal(audit.status, 'valid');
    assert.equal(audit.transaction.available, true);
    assert.equal(audit.migrations[0].path, undefined);
    assert.equal(audit.rollback.recordId, undefined);
    assert.equal(diagnosticContainsSensitiveMaterial(audit), false);
    assert.doesNotMatch(JSON.stringify(audit), /sk-secret|hunter2|private chat/i);

    const debug = createDualSurfaceViewModel(result, {
        visibility: 'debug',
    });
    assert.ok(debug.evidence.references.every((entry) => entry.refDigest));
    assert.doesNotMatch(
        JSON.stringify(debug),
        /private chat says|private fact|hidden witness|full hidden prompt|sk-secret/i,
    );
});
