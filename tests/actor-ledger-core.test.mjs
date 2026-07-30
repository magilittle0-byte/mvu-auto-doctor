import assert from 'node:assert/strict';
import test from 'node:test';
import {
    actorLedgerView,
    applyAcceptedContentObservations,
    emptyActorLedger,
    migrateActorLedgerFromContinuity,
    normalizeActorLedger,
    scheduleActorTurns,
    settleActorActionCandidates,
    settleActorInjectionReceipts,
} from '../actor-ledger-core.mjs';

function sourceRef(index = 4) {
    return {
        chatId: 'chat-actor-ledger',
        messageId: `message-${index}`,
        index,
        swipeId: 0,
        hash: `hash-${index}`,
    };
}

function actor(id, overrides = {}) {
    return {
        id,
        name: id,
        tier: 'secondary',
        status: 'active',
        identity: {
            role: '商人',
            aliases: [],
            traits: ['谨慎'],
            desires: ['维持商路'],
            boundaries: ['不伤害无辜'],
        },
        longTermGoals: ['维持商路'],
        currentGoals: ['按时交货'],
        knowledge: [],
        location: { name: '北港', sinceTurn: 1, evidence: ['fixture'] },
        resources: [{ id: 'coin', name: '银币', amount: 5 }],
        capabilities: ['交涉', '步行'],
        relationships: [],
        commitments: [],
        hidden: {
            emotionalInertia: ['担忧'],
            innerConflicts: ['利润与承诺冲突'],
            privateIntentions: ['避免公开冲突'],
        },
        plan: {
            summary: '前往仓库',
            steps: ['确认货物', '交货'],
            status: 'active',
        },
        lastAction: null,
        nextActionTurn: 2,
        deadlineTurn: 5,
        initiative: 2,
        opportunity: 1,
        silenceTurns: 0,
        attentionScore: 1,
        evidence: ['fixture'],
        version: 1,
        ...overrides,
    };
}

test('legacy continuity migration creates stable actors only from attributable non-hidden evidence', () => {
    const continuity = {
        turn: 7,
        threads: [
            {
                id: 'PUBLIC',
                actors: ['艾达'],
                locations: ['北港'],
                stage: 'advancing',
                knowledge: 'observed',
                summary: '艾达公开接下了护送任务',
                nextBeat: '在第八日出发',
                seedBasis: 'message-4:hash-4',
                sourceRefs: [sourceRef()],
            },
            {
                id: 'SECRET',
                actors: ['艾达', '贝拉'],
                locations: ['密室'],
                stage: 'seeded',
                knowledge: 'hidden',
                summary: '贝拉其实是卧底',
                seedBasis: '不可传播的幕后真相',
                sourceRefs: [sourceRef(5)],
            },
        ],
    };
    const migrated = migrateActorLedgerFromContinuity(emptyActorLedger('chat-actor-ledger'), continuity);
    assert.deepEqual(migrated.actors.map((item) => item.name), ['艾达', '贝拉']);
    const ada = migrated.actors.find((item) => item.name === '艾达');
    const bella = migrated.actors.find((item) => item.name === '贝拉');
    assert.equal(ada.currentGoals.includes('在第八日出发'), true);
    assert.equal(ada.knowledge.some((item) => item.claim.includes('护送任务')), true);
    assert.equal(ada.knowledge.some((item) => item.claim.includes('卧底')), false);
    assert.equal(bella.knowledge.some((item) => item.claim.includes('卧底')), false);
    assert.equal(migrated.migrations.continuityV5, true);
});

test('accepted content updates only named observers and excludes private/internal narration', () => {
    const ledger = normalizeActorLedger({
        ...emptyActorLedger('chat-actor-ledger'),
        turn: 3,
        actors: [actor('ADA', { name: '艾达' }), actor('BELLA', { name: '贝拉' })],
    });
    const next = applyAcceptedContentObservations(ledger, {
        content: '<content>艾达看见码头仓库起火。玩家心想钥匙藏在靴子里。贝拉不在场。</content>',
        sourceRef: sourceRef(6),
        observerActorIds: ['ADA'],
    });
    const ada = next.actors.find((item) => item.id === 'ADA');
    const bella = next.actors.find((item) => item.id === 'BELLA');
    assert.equal(ada.knowledge.some((item) => item.claim.includes('仓库起火')), true);
    assert.equal(ada.knowledge.some((item) => item.claim.includes('钥匙')), false);
    assert.equal(bella.knowledge.length, 0);
    assert.equal(next.observationReceipts.at(-1).observerActorIds.includes('ADA'), true);
});

test('scheduler prioritizes due/deadline/commitment and reserves a bounded low-attention exploration slot', () => {
    const ledger = normalizeActorLedger({
        ...emptyActorLedger('chat-actor-ledger'),
        turn: 10,
        actors: [
            actor('DUE', {
                nextActionTurn: 10,
                deadlineTurn: 10,
                commitments: [{ id: 'C1', summary: '今夜交货', dueTurn: 10, status: 'open' }],
            }),
            actor('POPULAR', {
                nextActionTurn: 20,
                attentionScore: 99,
                initiative: 3,
            }),
            actor('QUIET', {
                tier: 'background',
                status: 'dormant',
                nextActionTurn: 30,
                attentionScore: 0,
                silenceTurns: 20,
                opportunity: 2,
            }),
        ],
    });
    const schedule = scheduleActorTurns(ledger, {
        turn: 10,
        maxActors: 2,
        explorationSlots: 1,
    });
    assert.deepEqual(schedule.selected.map((item) => item.actorId), ['DUE', 'QUIET']);
    assert.equal(schedule.selected[0].reasons.includes('action-due'), true);
    assert.equal(schedule.selected[1].slot, 'exploration');
});

test('local settlement blocks player sovereignty, teleportation, unknown facts and overspending', () => {
    const ledger = normalizeActorLedger({
        ...emptyActorLedger('chat-actor-ledger'),
        turn: 4,
        actors: [actor('ADA', {
            name: '艾达',
            knowledge: [{
                id: 'K1',
                claim: '北港仓库起火',
                kind: 'observed',
                confidence: 1,
                learnedTurn: 3,
                sourceRef: sourceRef(3),
                propagation: [],
            }],
        })],
    });
    const common = {
        actorId: 'ADA',
        actorName: '艾达',
        intent: 'execute',
        time: { turn: 4, window: 'now' },
        location: { from: '北港', to: '北港', travelTurns: 0 },
        action: '艾达寄出一封求助信',
        knowledgeRefs: ['K1'],
        resourceCosts: [{ resourceId: 'coin', amount: 1 }],
        capabilityUsed: '交涉',
        contact: { mode: 'letter', target: '玩家', observableConsequence: '信件送达旅店' },
        planUpdate: '等待回信',
        waitCondition: '',
        evidence: ['K1'],
    };
    const result = settleActorActionCandidates(ledger, [
        common,
        { ...common, action: '艾达让玩家接受委托并支付十枚银币' },
        {
            ...common,
            action: '艾达瞬间抵达南境并购买坐骑',
            location: { from: '北港', to: '南境', travelTurns: 0 },
            resourceCosts: [{ resourceId: 'coin', amount: 99 }],
        },
        { ...common, knowledgeRefs: ['UNKNOWN'], evidence: ['UNKNOWN'] },
    ], { turn: 4 });
    assert.equal(result.accepted.length, 1);
    assert.equal(result.rejected.length, 3);
    assert.deepEqual(
        new Set(result.rejected.flatMap((item) => item.reasons)),
        new Set([
            'player-sovereignty',
            'location-or-travel-invalid',
            'resource-insufficient',
            'knowledge-out-of-bounds',
            'evidence-out-of-bounds',
        ]),
    );
});

test('due actor must execute, replan, or wait on a concrete unmet condition and receives full receipts', () => {
    const ledger = normalizeActorLedger({
        ...emptyActorLedger('chat-actor-ledger'),
        turn: 5,
        actors: [actor('ADA', { name: '艾达', nextActionTurn: 5 })],
    });
    const invalidWait = settleActorActionCandidates(ledger, [{
        actorId: 'ADA',
        actorName: '艾达',
        intent: 'wait',
        time: { turn: 5, window: 'now' },
        location: { from: '北港', to: '北港', travelTurns: 0 },
        action: '等待',
        knowledgeRefs: [],
        resourceCosts: [],
        capabilityUsed: '',
        contact: null,
        planUpdate: '',
        waitCondition: '暂时不动',
        evidence: ['fixture'],
    }], { turn: 5 });
    assert.equal(invalidWait.accepted.length, 0);
    assert.equal(invalidWait.rejected[0].reasons.includes('wait-condition-not-concrete'), true);

    const executed = settleActorActionCandidates(ledger, [{
        actorId: 'ADA',
        actorName: '艾达',
        intent: 'execute',
        time: { turn: 5, window: 'now' },
        location: { from: '北港', to: '北港', travelTurns: 0 },
        action: '艾达把公开告示贴到北港布告栏',
        knowledgeRefs: [],
        resourceCosts: [{ resourceId: 'coin', amount: 1 }],
        capabilityUsed: '交涉',
        contact: {
            mode: 'public_notice',
            target: '北港居民',
            observableConsequence: '布告栏出现告示',
        },
        planUpdate: '等待线索',
        waitCondition: '',
        evidence: ['fixture'],
    }], { turn: 5 });
    assert.equal(executed.accepted.length, 1);
    assert.equal(executed.worldEvents.length, 1);
    assert.deepEqual(
        executed.receipts.map((item) => item.stage),
        ['planned', 'executed', 'world_settled', 'injected'],
    );
    assert.equal(executed.ledger.actors[0].resources[0].amount, 4);
});

test('injection settlement marks observable consequences consumed and keeps unrelated actions private', () => {
    const ledger = normalizeActorLedger({
        ...emptyActorLedger('chat-actor-ledger'),
        actionReceipts: [
            {
                receiptId: 'R1',
                actionId: 'A1',
                actorId: 'ADA',
                stage: 'injected',
                status: 'pending',
                observableConsequence: '布告栏出现告示',
                createdTurn: 5,
            },
            {
                receiptId: 'R2',
                actionId: 'A2',
                actorId: 'BELLA',
                stage: 'world_settled',
                status: 'settled',
                observableConsequence: '',
                createdTurn: 5,
            },
        ],
    });
    const next = settleActorInjectionReceipts(ledger, {
        content: '<content>旅店门口的布告栏出现告示，引起了议论。</content>',
        sourceRef: sourceRef(7),
    });
    assert.equal(next.actionReceipts.find((item) => item.receiptId === 'R1').status, 'consumed');
    assert.equal(next.actionReceipts.find((item) => item.receiptId === 'R2').stage, 'world_settled');
    assert.equal(actorLedgerView(next).privateThoughtsExposed, false);
});

test('80-turn low-attention exploration prevents starvation while receipts stay bounded', () => {
    let ledger = normalizeActorLedger({
        ...emptyActorLedger('chat-long-actor-ledger'),
        actors: Array.from({ length: 12 }, (_, index) => actor(`NPC-${index + 1}`, {
            tier: index < 2 ? 'secondary' : 'background',
            nextActionTurn: 1,
            silenceTurns: index,
            attentionScore: index < 2 ? 50 : 0,
        })),
    });
    const acted = new Set();
    for (let turn = 1; turn <= 80; turn += 1) {
        ledger.turn = turn;
        const schedule = scheduleActorTurns(ledger, {
            turn,
            maxActors: 2,
            explorationSlots: 1,
        });
        const candidates = schedule.selected.map(({ actorId, actorName }) => {
            const current = ledger.actors.find((item) => item.id === actorId);
            acted.add(actorId);
            return {
                actorId,
                actorName,
                intent: 'execute',
                time: { turn, window: 'now' },
                location: {
                    from: current.location.name,
                    to: current.location.name,
                    travelTurns: 0,
                },
                action: `${actorName}继续自己的日常事务`,
                knowledgeRefs: [],
                resourceCosts: [],
                capabilityUsed: '',
                contact: null,
                planUpdate: '继续当前计划',
                waitCondition: '',
                evidence: ['fixture'],
            };
        });
        ledger = settleActorActionCandidates(ledger, candidates, { turn }).ledger;
    }
    assert.equal(acted.size, 12);
    assert.equal(ledger.actors.every((item) => item.settledActionCount > 0), true);
    assert.equal(ledger.actionReceipts.length <= 240, true);
    assert.equal(actorLedgerView(ledger).actors.some((item) => 'hidden' in item), false);
});
