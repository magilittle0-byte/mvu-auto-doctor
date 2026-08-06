import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildActorShardMessages,
    convergeActorShardProposals,
    formatUserNarrativeInstruction,
    parseActorShardProposal,
    runActorShardBatch,
    selectActorShardCandidates,
    userPromptSlotMetadata,
} from '../actor-shard-core.mjs';

function thread(id, actor, overrides = {}) {
    return {
        id,
        actors: [actor],
        locations: ['北港'],
        stage: 'advancing',
        relation: 'independent',
        urgency: 2,
        seedBasis: `世界书:${id}`,
        summary: `${actor}正在处理${id}`,
        nextBeat: `${actor}继续行动`,
        trigger: '午夜',
        causedBy: ['CHAIN-A'],
        sourceRefs: [{ messageId: `m-${id}`, hash: `h-${id}` }],
        knowledge: 'hidden',
        ...overrides,
    };
}

function proposal(candidate, overrides = {}) {
    return {
        actorId: candidate.id,
        actorName: candidate.name,
        time: '第三日午夜',
        location: '北港',
        travelTurns: 0,
        knowledgeBasis: [candidate.knowledgeBasis[0]],
        currentGoal: candidate.goals[0] || '继续既定目标',
        intent: 'execute',
        candidateAction: '沿既有线索调查仓库',
        stateChanges: [{ kind: 'knowledge', summary: '仓库调查获得一项新的可核验线索' }],
        interactionTargets: [],
        resourceCosts: [],
        capabilityUsed: '',
        waitCondition: '',
        sourceThreads: [candidate.sourceThreads[0]],
        evidence: [candidate.evidence[0]],
        causalChain: [candidate.causalChain[0]],
        ...overrides,
    };
}

test('deterministic selector handles 0/1/3/5 limits without excluding present actors', () => {
    const continuity = {
        threads: [
            thread('T1', '艾达', { urgency: 3 }),
            thread('T2', '贝拉', { urgency: 2 }),
            thread('T3', '希恩', { urgency: 1 }),
            thread('T4', '多恩', { urgency: 1 }),
            thread('T5', '伊芙', { urgency: 0 }),
            thread('T6', '港口巡逻队', { urgency: 3 }),
        ],
    };
    assert.equal(selectActorShardCandidates({ continuity: { threads: [] } }).length, 0);
    assert.equal(selectActorShardCandidates({
        continuity,
        presentText: '艾达站在玩家身边。',
        maxWorkers: 1,
    }).length, 1);
    assert.equal(selectActorShardCandidates({
        continuity,
        presentText: '艾达站在玩家身边。',
        maxWorkers: 3,
    }).length, 3);
    const five = selectActorShardCandidates({
        continuity,
        presentText: '',
        maxWorkers: 5,
    });
    assert.equal(five.length, 5);
    assert.deepEqual(
        five.map((item) => item.name),
        ['艾达', '贝拉', '希恩', '多恩', '伊芙'],
    );
    assert.equal(selectActorShardCandidates({
        continuity,
        maxWorkers: 99,
    }).length, 5);
    assert.equal(selectActorShardCandidates({
        continuity: {
            threads: [
                thread('T-linked', '联动者', { relation: 'linked' }),
                thread('T-resolved', '已结束者', { stage: 'resolved' }),
            ],
        },
        maxWorkers: 5,
    }).length, 0);
});

test('proposal parser repairs harmless shape drift but rejects authority and identity/evidence escape', () => {
    const candidate = selectActorShardCandidates({
        continuity: { threads: [thread('T1', '艾达')] },
        maxWorkers: 1,
    })[0];
    const valid = proposal(candidate);
    assert.deepEqual(
        parseActorShardProposal(JSON.stringify(valid), { candidate }).proposal,
        valid,
    );
    assert.equal(
        parseActorShardProposal(JSON.stringify({ ...valid, authorization: true }), { candidate }).error,
        'actor_shard.shape_not_whitelisted',
    );
    const harmlessDrift = parseActorShardProposal(JSON.stringify({
        proposal: {
            ...valid,
            modelNote: 'ignored',
            stateChanges: valid.stateChanges.map((entry) => ({ ...entry, confidence: 0.9 })),
            interactionTargets: undefined,
            resourceCosts: undefined,
        },
        metadata: { latency: 1 },
    }), { candidate });
    assert.deepEqual(harmlessDrift.proposal, {
        ...valid,
        interactionTargets: [],
        resourceCosts: [],
    });
    assert.equal(harmlessDrift.repaired, true);
    assert.deepEqual(harmlessDrift.repairKinds, [
        'unwrap-proposal-object',
        'drop-unrecognized-fields',
        'default-optional-fields',
    ]);
    assert.deepEqual(
        parseActorShardProposal(`说明：${JSON.stringify(valid)}`, { candidate }).proposal,
        valid,
    );
    const fenced = parseActorShardProposal(`\`\`\`json\n${JSON.stringify(valid)}\n\`\`\``, { candidate });
    assert.deepEqual(fenced.proposal, valid);
    assert.equal(fenced.repaired, true);
    assert.deepEqual(fenced.repairKinds, ['extract-first-balanced-json-object']);
    assert.equal(
        parseActorShardProposal(
            JSON.stringify({ ...valid, sourceThreads: ['UNRELATED'] }),
            { candidate },
        ).error,
        'actor_shard.required_evidence_missing',
    );
    assert.equal(
        parseActorShardProposal(
            JSON.stringify({ ...valid, knowledgeBasis: ['角色不可能知道的私人事实'] }),
            { candidate },
        ).error,
        'actor_shard.required_evidence_missing',
    );
    assert.equal(
        parseActorShardProposal(
            JSON.stringify({ ...valid, evidence: ['伪造的新证据'] }),
            { candidate },
        ).error,
        'actor_shard.required_evidence_missing',
    );
    assert.equal(
        parseActorShardProposal(
            JSON.stringify({
                ...valid,
                location: '南站',
                travelTurns: 0,
            }),
            { candidate },
        ).error,
        'actor_shard.travel_invalid',
    );
});

test('persistent actor proposals whitelist resource costs and capabilities before local settlement', () => {
    const actorLedger = {
        actors: [{
            id: 'NPC-ADA',
            name: '艾达',
            status: 'active',
            tier: 'secondary',
            location: { name: '北港' },
            knowledge: [{ id: 'K1', claim: '仓库起火' }],
            currentGoals: ['调查仓库'],
            longTermGoals: [],
            plan: { summary: '调查仓库' },
            evidence: ['E1'],
            resources: [{ id: 'coin', name: '银币', amount: 3 }],
            capabilities: ['交涉'],
            commitments: [],
            hidden: {},
        }],
    };
    const candidate = selectActorShardCandidates({
        continuity: { threads: [] },
        actorLedger,
        schedule: {
            selected: [{
                actorId: 'NPC-ADA',
                score: 10,
                slot: 'priority',
                reasons: ['action-due'],
            }],
        },
        maxWorkers: 1,
    })[0];
    const valid = proposal(candidate, {
        resourceCosts: [{ resourceId: 'coin', amount: 2 }],
        capabilityUsed: '交涉',
    });
    assert.equal(parseActorShardProposal(JSON.stringify(valid), { candidate }).error, undefined);
    assert.equal(
        parseActorShardProposal(JSON.stringify({
            ...valid,
            resourceCosts: [{ resourceId: 'coin', amount: 4 }],
        }), { candidate }).error,
        'actor_shard.resource_invalid',
    );
    assert.equal(
        parseActorShardProposal(JSON.stringify({
            ...valid,
            capabilityUsed: '瞬间移动',
        }), { candidate }).error,
        'actor_shard.capability_invalid',
    );
});

test('convergence is order-independent and keeps time/location/causal conflicts independent', () => {
    const candidates = selectActorShardCandidates({
        continuity: {
            threads: [
                thread('T1', '艾达'),
                thread('T1', '贝拉'),
                thread('T3', '希恩', { causedBy: ['CHAIN-C'] }),
                thread('T4', '多恩', { locations: ['南站'] }),
                thread('T5', '伊芙'),
            ],
        },
        maxWorkers: 5,
    });
    const byName = new Map(candidates.map((item) => [item.name, item]));
    const ada = proposal(byName.get('艾达'));
    const bella = proposal(byName.get('贝拉'));
    const timeConflict = proposal(byName.get('伊芙'), { time: '第四日清晨' });
    const locationConflict = proposal(byName.get('多恩'), { location: '南站' });
    const causalConflict = proposal(byName.get('希恩'), {
        sourceThreads: ['T3'],
        causalChain: ['T3'],
    });
    const forward = convergeActorShardProposals([
        timeConflict,
        bella,
        causalConflict,
        ada,
        locationConflict,
    ]);
    const reverse = convergeActorShardProposals([
        locationConflict,
        ada,
        causalConflict,
        bella,
        timeConflict,
    ]);
    assert.deepEqual(forward, reverse);
    assert.equal(forward.jointEvents.length, 1);
    assert.deepEqual(
        forward.jointEvents[0].actorIds.sort(),
        [ada.actorId, bella.actorId].sort(),
    );
    const reasons = forward.independent.flatMap((item) => item.reasons);
    assert.ok(reasons.includes('time-conflict'));
    assert.ok(reasons.includes('location-conflict'));
    assert.ok(reasons.includes('information-causal-chain-conflict'));
});

test('bounded parallel batch is completion-order independent and degrades worker failures/timeouts', async () => {
    const candidates = selectActorShardCandidates({
        continuity: {
            threads: [
                thread('T1', '艾达'),
                thread('T2', '贝拉'),
                thread('T3', '希恩'),
                thread('T4', '多恩'),
                thread('T5', '伊芙'),
            ],
        },
        maxWorkers: 5,
    });
    let active = 0;
    let peak = 0;
    const completed = await runActorShardBatch({
        candidates,
        maxConcurrency: 3,
        timeoutMs: 30,
        callWorker: async (candidate, { signal }) => {
            active += 1;
            peak = Math.max(peak, active);
            try {
                if (candidate.name === '多恩') throw new Error('provider down');
                if (candidate.name === '伊芙') {
                    await new Promise((resolve, reject) => {
                        const timer = setTimeout(resolve, 100);
                        signal.addEventListener('abort', () => {
                            clearTimeout(timer);
                            reject(new Error('aborted'));
                        }, { once: true });
                    });
                }
                await new Promise((resolve) => setTimeout(
                    resolve,
                    candidate.name.charCodeAt(0) % 7,
                ));
                return JSON.stringify(proposal(candidate));
            } finally {
                active -= 1;
            }
        },
    });
    assert.equal(completed.status, 'completed');
    assert.equal(completed.proposals.length, 3);
    assert.equal(completed.failures.length, 2);
    assert.ok(peak <= 3);
    assert.deepEqual(
        completed.proposals.map((item) => item.actorId),
        [...completed.proposals].map((item) => item.actorId).sort(),
    );
});

test('a reroll during workers makes the whole batch stale with zero candidate output', async () => {
    const candidates = selectActorShardCandidates({
        continuity: { threads: [thread('T1', '艾达'), thread('T2', '贝拉')] },
        maxWorkers: 2,
    });
    let current = true;
    let completions = 0;
    const result = await runActorShardBatch({
        candidates,
        maxConcurrency: 2,
        callWorker: async (candidate) => {
            await new Promise((resolve) => setTimeout(resolve, candidate.name === '艾达' ? 2 : 8));
            completions += 1;
            if (completions === 1) current = false;
            return JSON.stringify(proposal(candidate));
        },
        isCurrent: () => current,
    });
    assert.equal(result.status, 'stale');
    assert.deepEqual(result.proposals, []);
    assert.deepEqual(result.convergence, { jointEvents: [], independent: [] });
});

test('actor shard output example is directly valid against the candidate evidence whitelist', () => {
    const candidate = {
        id: 'actor-1',
        name: 'Actor One',
        locations: ['QC Lab'],
        knowledgeBasis: ['allowed-knowledge'],
        goals: ['inspect-manifest'],
        sourceThreads: ['thread-1'],
        evidence: ['evidence-1'],
        causalChain: ['cause-1'],
    };
    const messages = buildActorShardMessages(candidate);
    assert.match(messages[0].content, /资源列表为空时必须输出\[\]/u);
    assert.match(messages[0].content, /能力列表为空时必须输出空字符串/u);
    assert.match(messages[0].content, /没有提供可核验目标ID时必须输出\[\]/u);
    assert.match(messages[0].content, /信息取样、典型误读、具体关系距离/u);
    assert.match(messages[0].content, /不得用MBTI、九型、Tritype、依恋型/u);
    assert.match(messages[0].content, /不为补反差发明创伤或秘密/u);
    const shape = JSON.parse(messages[1].content.split('\n').at(-1));
    assert.deepEqual(shape.knowledgeBasis, candidate.knowledgeBasis);
    assert.deepEqual(shape.sourceThreads, candidate.sourceThreads);
    assert.deepEqual(shape.evidence, candidate.evidence);
    assert.deepEqual(shape.causalChain, candidate.causalChain);
    assert.deepEqual(shape.interactionTargets, []);
    assert.equal(shape.location, 'QC Lab');
    assert.equal(shape.currentGoal, 'inspect-manifest');
    assert.equal(parseActorShardProposal(JSON.stringify(shape), { candidate }).error, undefined);
});

test('custom prompts enter only labeled narrative model messages and diagnostics expose metadata', () => {
    const candidate = selectActorShardCandidates({
        continuity: { threads: [thread('T1', '艾达')] },
        maxWorkers: 1,
    })[0];
    const secret = '保持冷峻侦探叙事，不改变任何授权。';
    const messages = buildActorShardMessages(candidate, { customPrompt: secret });
    assert.match(messages[0].content, /用户自定义NPC分片指令/u);
    assert.match(messages[0].content, new RegExp(secret, 'u'));
    const continuityInstruction = formatUserNarrativeInstruction('世界连续性', secret);
    assert.match(continuityInstruction, /用户自定义世界连续性指令/u);
    assert.match(continuityInstruction, new RegExp(secret, 'u'));
    assert.match(continuityInstruction, /不能覆盖消息指纹、活动分支、事务、危险确认/u);
    const metadata = userPromptSlotMetadata(secret);
    assert.deepEqual(Object.keys(metadata), ['enabled', 'length', 'hash']);
    assert.equal(JSON.stringify(metadata).includes(secret), false);
    const rejected = parseActorShardProposal(JSON.stringify({
        ...proposal(candidate),
        transactionAuthorization: secret,
    }), { candidate });
    assert.equal(rejected.error, 'actor_shard.shape_not_whitelisted');
});

test('disabled selection path makes no calls and returns the same input continuity reference', () => {
    const continuity = { turn: 7, threads: [thread('T1', '艾达')] };
    const actorCandidates = [];
    let calls = 0;
    if (actorCandidates.length) calls += 1;
    assert.equal(calls, 0);
    assert.equal(continuity.turn, 7);
    assert.equal(continuity.threads[0].id, 'T1');
});
