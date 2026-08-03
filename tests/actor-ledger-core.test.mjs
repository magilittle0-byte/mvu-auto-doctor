import assert from 'node:assert/strict';
import test from 'node:test';
import {
    actorLedgerView,
    applyAcceptedContentObservations,
    emptyActorLedger,
    mergeActorIdentityReveal,
    mergeActorProfilePatches,
    migrateActorLedgerFromContinuity,
    normalizeActorLedger,
    reconcileActorIdentityRevealsFromAcceptedContent,
    reconcileActorLifecycleFromAcceptedContent,
    reconcileActorMutationLineageFromAcceptedContent,
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
        generation: index,
        branchId: 'branch-main',
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

test('evidence-backed profile patches persist character DNA without overwriting established identity', () => {
    const ledger = normalizeActorLedger({
        ...emptyActorLedger('chat-actor-ledger'),
        turn: 6,
        actors: [actor('ADA', {
            name: '艾达',
            identity: {
                role: '商人',
                aliases: [],
                traits: ['谨慎'],
                desires: [],
                boundaries: [],
            },
        })],
    });
    const merged = mergeActorProfilePatches(ledger, [{
        actorId: 'ADA',
        name: '艾达',
        evidence: ['她先核对交货清单，再问能否留一条撤离路线；她自称不擅长交涉，却用多年柜台经验安抚了争执'],
        identity: {
            role: '情报官',
            traits: ['谨慎', '好奇'],
            desires: ['按时完成自己的交货'],
            boundaries: ['不把同伴当诱饵'],
            socialStyle: '先保持礼貌距离，再用具体问题试探',
            decisionStyle: '先核价并确认退路',
            speechStyle: '句子短，通常先问条件',
            copingStyle: '压力上升时转向核对清单和可控步骤',
            informationStyle: '先核对书面清单，再用具体问题补缺口',
            typicalMisread: '容易把临时善意先当成附带条件的交易',
            relationshipDistancePattern: '先保持礼貌距离，确认对方履约后才主动靠近',
            selfImageGap: '自称不擅长交涉，实际能用柜台经验安抚争执',
            learnedCounterDisposition: '不喜欢临场交涉，却因多年柜台经验能稳住争执',
            pressureResponse: '压力上升时先缩小问题并核对可控步骤',
            recoveryPath: '确认退路和责任边界后恢复正常交流',
            everydayHabits: ['说话前摸一下清单边角'],
            blindSpots: ['低估临时起意的善意'],
        },
        longTermGoals: ['保住北港商路'],
        hidden: {
            innerConflicts: ['想帮助同伴但不愿承担无上限风险'],
        },
    }], {
        turn: 7,
        sourceRef: sourceRef(7),
        evidenceCorpus: '她先核对交货清单，再问能否留一条撤离路线；她自称不擅长交涉，却用多年柜台经验安抚了争执。',
    });
    assert.equal(merged.accepted.length, 1);
    assert.equal(merged.rejected.length, 0);
    assert.equal(merged.ledger.version, 4);
    const ada = merged.ledger.actors[0];
    assert.equal(ada.identity.role, '商人', 'established role is not overwritten');
    assert.equal(ada.identity.socialStyle, '先保持礼貌距离，再用具体问题试探');
    assert.equal(ada.identity.informationStyle, '先核对书面清单，再用具体问题补缺口');
    assert.equal(ada.identity.typicalMisread, '容易把临时善意先当成附带条件的交易');
    assert.equal(ada.identity.relationshipDistancePattern, '先保持礼貌距离，确认对方履约后才主动靠近');
    assert.equal(ada.identity.selfImageGap, '自称不擅长交涉，实际能用柜台经验安抚争执');
    assert.equal(ada.identity.learnedCounterDisposition, '不喜欢临场交涉，却因多年柜台经验能稳住争执');
    assert.equal(ada.identity.pressureResponse, '压力上升时先缩小问题并核对可控步骤');
    assert.equal(ada.identity.recoveryPath, '确认退路和责任边界后恢复正常交流');
    assert.equal(ada.identity.traits.includes('好奇'), true);
    assert.equal(ada.identity.everydayHabits.includes('说话前摸一下清单边角'), true);
    assert.equal(ada.hidden.innerConflicts.includes('想帮助同伴但不愿承担无上限风险'), true);
    assert.equal(
        merged.ledger.observationReceipts.some((item) => item.kind === 'profile-enrichment'),
        true,
    );
});

test('profile patches reject unknown actors and evidence-free personality invention', () => {
    const ledger = normalizeActorLedger({
        ...emptyActorLedger('chat-actor-ledger'),
        actors: [actor('ADA', { name: '艾达' })],
    });
    const merged = mergeActorProfilePatches(ledger, [
        { actorId: 'UNKNOWN', name: '陌生人', evidence: ['猜测'], identity: { traits: ['冷酷'] } },
        { actorId: 'ADA', name: '艾达', evidence: [], identity: { traits: ['绝望'] } },
    ]);
    assert.equal(merged.accepted.length, 0);
    assert.deepEqual(merged.rejected.map((item) => item.reason), [
        'unknown-actor',
        'evidence-missing',
    ]);
    assert.deepEqual(merged.ledger.actors[0].identity.traits, ['谨慎']);
});

test('profile patches reject fabricated evidence and do not persist generic extreme labels as identity', () => {
    const ledger = normalizeActorLedger({
        ...emptyActorLedger('chat-actor-ledger'),
        actors: [actor('ADA', { name: '艾达' })],
    });
    const rejected = mergeActorProfilePatches(ledger, [{
        actorId: 'ADA',
        evidence: ['她残忍地威胁了所有人'],
        identity: { traits: ['冷酷'] },
    }], {
        evidenceCorpus: '艾达核对清单后询问了撤离路线。',
    });
    assert.equal(rejected.accepted.length, 0);
    assert.equal(rejected.rejected[0].reason, 'evidence-not-grounded');

    const filtered = mergeActorProfilePatches(ledger, [{
        actorId: 'ADA',
        evidence: ['艾达核对清单后询问了撤离路线'],
        identity: {
            traits: ['冷酷', 'INTJ 5w4 回避型依恋'],
            decisionStyle: '先核对事实，再为撤离保留余地',
            informationStyle: 'INTJ式直觉判断',
        },
    }], {
        evidenceCorpus: '艾达核对清单后询问了撤离路线。',
    });
    assert.equal(filtered.accepted.length, 1);
    assert.equal(filtered.ledger.actors[0].identity.traits.includes('冷酷'), false);
    assert.equal(filtered.ledger.actors[0].identity.traits.includes('INTJ 5w4 回避型依恋'), false);
    assert.equal(filtered.ledger.actors[0].identity.informationStyle, '');
    assert.equal(filtered.ledger.actors[0].identity.decisionStyle, '先核对事实，再为撤离保留余地');
});

test('v3 actor ledgers migrate to v4 dynamic evidence fields without inventing personality', () => {
    const legacy = {
        ...emptyActorLedger('chat-actor-ledger'),
        version: 3,
        migrations: { continuityV5: true, actorLedgerV2: true, actorLedgerV3: true },
        actors: [actor('ADA', {
            name: '艾达',
            identity: {
                role: '商人',
                aliases: [],
                traits: ['谨慎'],
                desires: ['按时交货'],
                boundaries: ['不拿同伴当诱饵'],
                copingStyle: '受压时先核对清单',
            },
        })],
    };
    const migrated = normalizeActorLedger(legacy);
    assert.equal(migrated.version, 4);
    assert.equal(migrated.migrations.actorLedgerV4, true);
    assert.equal(migrated.actors[0].identity.copingStyle, '受压时先核对清单');
    assert.equal(migrated.actors[0].identity.informationStyle, '');
    assert.equal(migrated.actors[0].identity.typicalMisread, '');
    assert.equal(migrated.actors[0].identity.relationshipDistancePattern, '');
    assert.equal(migrated.actors[0].identity.selfImageGap, '');
    assert.equal(migrated.actors[0].identity.learnedCounterDisposition, '');
    assert.equal(migrated.actors[0].identity.pressureResponse, '');
    assert.equal(migrated.actors[0].identity.recoveryPath, '');
});

test('repeated grounded observations extend a behavior pattern instead of replacing it', () => {
    const ledger = normalizeActorLedger({
        ...emptyActorLedger('chat-actor-ledger'),
        actors: [actor('ADA', {
            name: '艾达',
            identity: {
                role: '商人', aliases: [], traits: [], desires: [], boundaries: [],
                informationStyle: '先查书面记录',
            },
        })],
    });
    const merged = mergeActorProfilePatches(ledger, [{
        actorId: 'ADA',
        evidence: ['记录缺页时，她转而询问亲历者并比较两份说法'],
        identity: { informationStyle: '记录缺页时询问亲历者并交叉比较说法' },
    }], {
        evidenceCorpus: '记录缺页时，她转而询问亲历者并比较两份说法。',
    });
    assert.equal(merged.accepted.length, 1);
    assert.match(merged.ledger.actors[0].identity.informationStyle, /先查书面记录；记录缺页时询问亲历者/u);
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

test('accepted content writes back only direct observations and is idempotent for one target identity', () => {
    const ledger = normalizeActorLedger({
        ...emptyActorLedger('chat-actor-ledger'),
        turn: 3,
        actors: [actor('ADA', { name: '艾达' }), actor('BELLA', { name: '贝拉' })],
    });
    const payload = {
        content: [
            '<content>',
            '艾达看见码头仓库起火。',
            '贝拉在另一处密室把钥匙藏进靴子，艾达对此一无所知。',
            '旁白知道第三方候选准备伏击，但消息尚未传播。',
            '</content>',
        ].join(''),
        sourceRef: sourceRef(9),
        observerActorIds: ['ADA'],
    };
    const first = applyAcceptedContentObservations(ledger, payload);
    const second = applyAcceptedContentObservations(first, payload);
    const ada = second.actors.find((item) => item.id === 'ADA');
    assert.equal(ada.knowledge.some((item) => item.claim.includes('仓库起火')), true);
    assert.equal(ada.knowledge.some((item) => item.claim.includes('钥匙')), false);
    assert.equal(ada.knowledge.some((item) => item.claim.includes('伏击')), false);
    assert.equal(second.observationReceipts.length, 1);
});

test('identity reveal keeps the original stable actor id and merges aliases', () => {
    const ledger = normalizeActorLedger({
        ...emptyActorLedger('chat-actor-ledger'),
        turn: 4,
        actors: [actor('NPC-MASKED-01', {
            name: '蒙面女人',
            identity: {
                role: '身份未知',
                aliases: ['红围巾'],
                traits: [],
                desires: [],
                boundaries: [],
            },
        })],
    });
    const next = mergeActorIdentityReveal(ledger, {
        actorId: 'NPC-MASKED-01',
        revealedName: '艾达·王',
        aliases: ['蒙面女人', '红围巾'],
        evidence: ['message-10:hash-10'],
        turn: 5,
    });
    assert.equal(next.actors.length, 1);
    assert.equal(next.actors[0].id, 'NPC-MASKED-01');
    assert.equal(next.actors[0].name, '艾达·王');
    assert.equal(next.actors[0].identity.aliases.includes('蒙面女人'), true);
});

test('accepted explicit identity reveal merges a duplicate revealed-name actor into the unknown stable id', () => {
    const ledger = normalizeActorLedger({
        ...emptyActorLedger('chat-actor-ledger'),
        turn: 5,
        actors: [
            actor('NPC-MASKED-01', { name: '蒙面女人' }),
            actor('NPC-ADA-DUPLICATE', {
                name: '艾达',
                knowledge: [{
                    id: 'K-ADA',
                    claim: '北港仓库起火',
                    kind: 'reported',
                    confidence: 0.6,
                    learnedTurn: 5,
                    sourceRef: sourceRef(10),
                    propagation: [],
                }],
            }),
        ],
    });
    const next = reconcileActorIdentityRevealsFromAcceptedContent(ledger, {
        content: '<content>蒙面女人摘下面具，确认自己的真实身份是艾达。</content>',
        sourceRef: sourceRef(10),
    });
    assert.equal(next.actors.length, 1);
    assert.equal(next.actors[0].id, 'NPC-MASKED-01');
    assert.equal(next.actors[0].name, '艾达');
    assert.equal(next.actors[0].identity.aliases.includes('蒙面女人'), true);
    assert.equal(next.actors[0].knowledge.some((item) => item.id === 'K-ADA'), true);
});

test('migration excludes player system environment and group labels from the actor pool', () => {
    const migrated = migrateActorLedgerFromContinuity(
        emptyActorLedger('chat-actor-ledger'),
        {
            turn: 7,
            threads: [{
                id: 'PUBLIC',
                actors: ['艾达', '玩家', '系统', '环境', '码头商会'],
                locations: ['北港'],
                stage: 'advancing',
                knowledge: 'observed',
                summary: '公开调度信息。',
                nextBeat: '第八日出发',
                seedBasis: 'message-4:hash-4',
                sourceRefs: [sourceRef()],
            }],
        },
    );
    assert.deepEqual(migrated.actors.map((item) => item.name), ['艾达']);
});

test('mutation lineage keeps one actor id and records forms instead of spawning a second actor', () => {
    const ledger = normalizeActorLedger({
        ...emptyActorLedger('chat-actor-ledger'),
        turn: 12,
        actors: [
            actor('NPC-GAO', { name: '高阳' }),
            actor('NPC-MUTANT-DUP', { name: '暴食者·生化温床' }),
        ],
    });
    const next = reconcileActorMutationLineageFromAcceptedContent(ledger, {
        content: '<content>高阳在病毒冲击下异变为暴食者·生化温床。</content>',
        sourceRef: sourceRef(13),
    });
    assert.equal(next.actors.length, 1);
    assert.equal(next.actors[0].id, 'NPC-GAO');
    assert.equal(next.actors[0].lineage.currentForm, '暴食者·生化温床');
    assert.deepEqual(
        next.actors[0].lineage.forms.map((item) => item.name),
        ['高阳', '暴食者·生化温床'],
    );
});

test('death departure sleep and wake transitions stop or resume scheduling without reviving the dead', () => {
    const ledger = normalizeActorLedger({
        ...emptyActorLedger('chat-actor-ledger'),
        turn: 8,
        actors: [
            actor('ADA', { name: '艾达', nextActionTurn: 8 }),
            actor('BELLA', { name: '贝拉', nextActionTurn: 8 }),
            actor('CARLO', { name: '卡洛', nextActionTurn: 8 }),
        ],
    });
    const terminal = reconcileActorLifecycleFromAcceptedContent(ledger, {
        content: '<content>艾达已经死亡。贝拉已经离开港区。卡洛陷入昏迷。</content>',
        sourceRef: sourceRef(11),
    });
    assert.equal(terminal.actors.find((item) => item.id === 'ADA').status, 'deceased');
    assert.equal(terminal.actors.find((item) => item.id === 'BELLA').status, 'departed');
    assert.equal(terminal.actors.find((item) => item.id === 'CARLO').status, 'dormant');
    assert.equal(scheduleActorTurns(terminal, { turn: 8, maxActors: 3 }).selected.length, 0);

    const woke = reconcileActorLifecycleFromAcceptedContent(terminal, {
        content: '<content>卡洛苏醒并重新回到岗位。艾达的尸体被搬走。</content>',
        sourceRef: sourceRef(12),
    });
    assert.equal(woke.actors.find((item) => item.id === 'CARLO').status, 'active');
    assert.equal(woke.actors.find((item) => item.id === 'ADA').status, 'deceased');
    assert.deepEqual(
        scheduleActorTurns(woke, { turn: 9, maxActors: 3 }).selected.map((item) => item.actorId),
        ['CARLO'],
    );
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

test('actor injection receipts are settled only by the exact generation branch and swipe', () => {
    const ledger = normalizeActorLedger({
        ...emptyActorLedger('chat-actor-ledger'),
        actionReceipts: [{
            receiptId: 'R-BRANCH',
            actionId: 'A-BRANCH',
            actorId: 'ADA',
            stage: 'injected',
            status: 'pending',
            observableConsequence: '布告栏出现告示',
            createdTurn: 5,
            target: {
                chatId: 'chat-actor-ledger',
                messageId: 'message-20',
                swipeId: 1,
                generation: 4,
                branchId: 'branch-main',
                hash: 'hash-20',
            },
        }],
    });
    const stale = settleActorInjectionReceipts(ledger, {
        content: '<content>布告栏出现告示。</content>',
        sourceRef: {
            ...sourceRef(20),
            swipeId: 0,
            generation: 3,
        },
    });
    assert.equal(stale.actionReceipts[0].status, 'pending');
    const exact = settleActorInjectionReceipts(stale, {
        content: '<content>布告栏出现告示。</content>',
        sourceRef: {
            ...sourceRef(20),
            swipeId: 1,
            generation: 4,
        },
    });
    assert.equal(exact.actionReceipts[0].status, 'consumed');
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
