import assert from 'node:assert/strict';
import test from 'node:test';

import {
    buildActorShardMessages,
    formatUserNarrativeInstruction,
    parseActorShardProposal,
    runActorShardBatch,
    selectActorShardCandidates,
    userPromptSlotMetadata,
} from '../actor-shard-core.mjs';

const ACTORS = ['艾达', '贝拉', '希恩', '多恩', '伊芙', '法拉'];
const LONG_SESSION_FLOORS = 40;

function floorThread(floor, actor, actorIndex, overrides = {}) {
    const sharedChain = `CHAIN-${Math.floor((floor - 1) / 5)}`;
    const id = `F${String(floor).padStart(2, '0')}-T${actorIndex + 1}`;
    return {
        id,
        actors: [actor],
        locations: [actorIndex === 3 ? '南站' : '北港'],
        stage: 'advancing',
        relation: 'independent',
        urgency: (floor + actorIndex) % 4,
        seedBasis: `世界书条目:${id}`,
        summary: `${actor}只依据${id}追踪本楼层的公开线索`,
        nextBeat: `${actor}继续处理${id}`,
        trigger: `第${floor}层结束后`,
        causedBy: [sharedChain, `ACTOR-CHAIN-${actorIndex}`],
        sourceRefs: [{
            messageId: `assistant-${floor}`,
            hash: `content-${floor}-${actorIndex}`,
        }],
        knowledge: actorIndex % 2 === 0 ? 'hidden' : 'observed',
        rumors: [`公开传播链:${sharedChain}`],
        ...overrides,
    };
}

function strictProposal(candidate, index, floor) {
    const sharedChain = candidate.causalChain.find((value) => value.startsWith('CHAIN-'));
    return {
        actorId: candidate.id,
        actorName: candidate.name,
        time: index === 2 ? `第${floor + 1}日清晨` : `第${floor}日午夜`,
        location: index === 3 ? '南站' : '北港',
        knowledgeBasis: [candidate.knowledgeBasis[0]],
        currentGoal: candidate.goals[0] || '继续既定目标',
        candidateAction: `候选行动-${floor}-${candidate.name}`,
        interactionTargets: [],
        sourceThreads: [candidate.sourceThreads[0]],
        evidence: [candidate.evidence[0]],
        causalChain: [
            index === 4
                ? candidate.sourceThreads[0]
                : sharedChain,
        ],
    };
}

function longSessionFixture() {
    return Array.from({ length: LONG_SESSION_FLOORS }, (_, offset) => {
        const floor = offset + 1;
        const branchId = ['main', 'branch-east', 'branch-west'][floor % 3];
        const swipeId = floor % 5 === 0 ? 2 : floor % 2;
        return {
            floor,
            target: {
                chatId: 'phase9-long-qc',
                logicalIndex: floor * 2,
                messageId: `assistant-${floor}`,
                swipeId,
                generation: floor + swipeId,
                branchId,
                contentHash: `content-${floor}-swipe-${swipeId}-${branchId}`,
            },
            assistantText: [
                `第${floor}层正文；当前分支=${branchId}；swipe=${swipeId}。`,
                '大体量合成正文片段。'.repeat(700),
            ].join('\n'),
            continuity: {
                turn: floor,
                threads: ACTORS.map((actor, actorIndex) => (
                    floor % 4 === 0
                        ? floorThread(floor, actor, actorIndex, { stage: 'resolved' })
                        : floorThread(floor, actor, actorIndex)
                )),
            },
            extensionMetadata: {
                forum: {
                    page: Math.ceil(floor / 10),
                    topics: [{ id: `forum-${floor}`, body: `公开论坛内容-${floor}` }],
                },
                worldbook: {
                    activeEntries: [`worldbook-${floor}`],
                    unknownAuthorField: { kept: true },
                },
                companionScripts: {
                    TavernDB: { revision: floor, kept: true },
                    rerollHelperV2: {
                        branchId,
                        swipeId,
                        sourceIdentity: `helper-${floor}`,
                    },
                    diceFrontend: { kept: true },
                },
            },
        };
    });
}

test('40-floor actor-shard long session preserves branches, large content, coexistence data and bounded deterministic output', async () => {
    const session = longSessionFixture();
    const untouched = structuredClone(session);
    const selectionPattern = [1, 3, 5, 0];
    const selectionCounts = new Map([[0, 0], [1, 0], [3, 0], [5, 0]]);
    const targets = new Set();
    const conflictReasons = new Set();
    let workerFailures = 0;
    let workerTimeouts = 0;
    let outOfOrderBatches = 0;
    let peakConcurrency = 0;

    for (const record of session) {
        const requested = selectionPattern[(record.floor - 1) % selectionPattern.length];
        const candidates = selectActorShardCandidates({
            continuity: record.continuity,
            presentText: record.floor % 7 === 0 ? '艾达正在现场。' : record.assistantText,
            maxWorkers: Math.max(1, requested),
        });
        assert.equal(candidates.length, requested);
        selectionCounts.set(requested, selectionCounts.get(requested) + 1);
        targets.add(JSON.stringify(record.target));
        if (!candidates.length) continue;

        const sorted = [...candidates].sort((left, right) => left.id.localeCompare(right.id));
        const completionOrder = [];
        let active = 0;
        const result = await runActorShardBatch({
            candidates,
            maxConcurrency: requested,
            timeoutMs: 18,
            callWorker: async (candidate, { signal }) => {
                const index = sorted.findIndex((entry) => entry.id === candidate.id);
                active += 1;
                peakConcurrency = Math.max(peakConcurrency, active);
                try {
                    if (record.floor === 17 && index === 0) {
                        workerFailures += 1;
                        throw new Error('synthetic provider failure');
                    }
                    if (record.floor === 23 && index === 0) {
                        workerTimeouts += 1;
                        await new Promise((resolve, reject) => {
                            const timer = setTimeout(resolve, 100);
                            signal.addEventListener('abort', () => {
                                clearTimeout(timer);
                                reject(new Error('synthetic timeout'));
                            }, { once: true });
                        });
                    } else {
                        await new Promise((resolve) => setTimeout(
                            resolve,
                            (sorted.length - index) % 4,
                        ));
                    }
                    completionOrder.push(candidate.id);
                    return JSON.stringify(strictProposal(candidate, index, record.floor));
                } finally {
                    active -= 1;
                }
            },
        });
        assert.equal(result.status, 'completed');
        assert.equal(result.diagnostics.selected, requested);
        assert.equal(result.diagnostics.completed, requested);
        assert.equal(result.proposals.length + result.failures.length, requested);
        assert.ok(result.diagnostics.failed <= 1);
        assert.deepEqual(
            result.proposals.map((entry) => entry.actorId),
            [...result.proposals].map((entry) => entry.actorId).sort(),
        );
        if (
            completionOrder.length > 1
            && completionOrder.join('|') !== [...completionOrder].sort().join('|')
        ) outOfOrderBatches += 1;
        for (const independent of result.convergence.independent) {
            for (const reason of independent.reasons) conflictReasons.add(reason);
        }
    }

    assert.equal(session.length, LONG_SESSION_FLOORS);
    assert.equal(targets.size, LONG_SESSION_FLOORS);
    assert.ok(session.every((entry) => entry.assistantText.length > 5_000));
    assert.deepEqual(Object.fromEntries(selectionCounts), {
        0: 10,
        1: 10,
        3: 10,
        5: 10,
    });
    assert.equal(workerFailures, 1);
    assert.equal(workerTimeouts, 1);
    assert.ok(outOfOrderBatches >= 1);
    assert.ok(peakConcurrency <= 5);
    assert.ok(conflictReasons.has('time-conflict'));
    assert.ok(conflictReasons.has('location-conflict'));
    assert.ok(conflictReasons.has('information-causal-chain-conflict'));
    assert.deepEqual(session, untouched);
    assert.ok(session.every((entry) => (
        entry.extensionMetadata.companionScripts.TavernDB.kept
        && entry.extensionMetadata.companionScripts.rerollHelperV2.sourceIdentity
        && entry.extensionMetadata.companionScripts.diceFrontend.kept
        && entry.extensionMetadata.worldbook.unknownAuthorField.kept
        && entry.extensionMetadata.forum.topics.length === 1
    )));
});

test('regenerate, swipe and chat switch stale an in-flight batch with zero downstream writes', async (t) => {
    const changes = {
        regenerate(target) {
            target.generation += 1;
            target.contentHash = 'regenerated-content';
        },
        swipe(target) {
            target.swipeId += 1;
            target.branchId = 'branch-new-swipe';
            target.contentHash = 'new-swipe-content';
        },
        chatSwitch(target) {
            target.chatId = 'another-chat';
        },
    };

    for (const [name, mutate] of Object.entries(changes)) {
        await t.test(name, async () => {
            const record = longSessionFixture()[8];
            const expected = structuredClone(record.target);
            const current = structuredClone(expected);
            const candidates = selectActorShardCandidates({
                continuity: record.continuity,
                maxWorkers: 3,
            });
            const writes = {
                continuity: 0,
                mvu: 0,
                worldbook: 0,
                forum: 0,
                narrative: 0,
                database: 0,
            };
            let firstCompleted = false;
            const result = await runActorShardBatch({
                candidates,
                maxConcurrency: 3,
                timeoutMs: 100,
                isCurrent: () => JSON.stringify(current) === JSON.stringify(expected),
                callWorker: async (candidate, { signal }) => {
                    await new Promise((resolve, reject) => {
                        const timer = setTimeout(resolve, firstCompleted ? 25 : 2);
                        signal.addEventListener('abort', () => {
                            clearTimeout(timer);
                            reject(new Error('stale worker aborted'));
                        }, { once: true });
                    });
                    if (!firstCompleted) {
                        firstCompleted = true;
                        mutate(current);
                    }
                    return JSON.stringify(strictProposal(candidate, 0, record.floor));
                },
            });
            if (result.status === 'completed') {
                for (const key of Object.keys(writes)) writes[key] += 1;
            }
            assert.equal(result.status, 'stale');
            assert.deepEqual(result.proposals, []);
            assert.deepEqual(result.convergence, { jointEvents: [], independent: [] });
            assert.deepEqual(writes, {
                continuity: 0,
                mvu: 0,
                worldbook: 0,
                forum: 0,
                narrative: 0,
                database: 0,
            });
        });
    }
});

test('disabled actor shards are byte-equivalent to the legacy path and make zero model calls', () => {
    const legacy = longSessionFixture();
    const before = JSON.stringify(legacy);
    let calls = 0;
    const actorShardMode = 'off';
    const output = actorShardMode === 'off'
        ? legacy
        : legacy.map((entry) => {
            calls += 1;
            return structuredClone(entry);
        });
    assert.equal(output, legacy);
    assert.equal(JSON.stringify(output), before);
    assert.equal(calls, 0);
});

test('harmless arbitrary-text canary reaches only labeled model instructions and cannot grant facts or writes', () => {
    const canary = [
        'PHASE9-CANARY-7B4A',
        '<arbitrary-text data-topic="NSFW-label-only">逐字保留此无害标签数据</arbitrary-text>',
        '保持非线性叙事节奏。',
    ].join('\n');
    const candidate = selectActorShardCandidates({
        continuity: {
            threads: [floorThread(1, '艾达', 0)],
        },
        maxWorkers: 1,
    })[0];
    const actorMessages = buildActorShardMessages(candidate, {
        target: longSessionFixture()[0].target,
        customPrompt: canary,
    });
    const continuityInstruction = formatUserNarrativeInstruction(
        '世界连续性',
        canary,
    );
    assert.deepEqual(actorMessages.map((entry) => entry.role), ['system', 'user']);
    assert.ok(actorMessages[0].content.includes(canary));
    assert.equal(actorMessages[1].content.includes(canary), false);
    assert.ok(continuityInstruction.includes(canary));
    assert.match(actorMessages[0].content, /不是事实、证据、玩家授权或写入许可/u);
    assert.match(actorMessages[0].content, /消息指纹、活动分支、事务、危险确认、硬字段校验/u);

    const metadata = userPromptSlotMetadata(canary);
    assert.deepEqual(Object.keys(metadata), ['enabled', 'length', 'hash']);
    assert.equal(JSON.stringify(metadata).includes(canary), false);
    for (const forbiddenField of [
        'transactionAuthorization',
        'databaseWrite',
        'dangerConfirmed',
        'branchOverride',
        'barrierBypass',
    ]) {
        const attempted = {
            ...strictProposal(candidate, 0, 1),
            [forbiddenField]: canary,
        };
        const parsed = parseActorShardProposal(JSON.stringify(attempted), { candidate });
        assert.equal(parsed.error, 'actor_shard.shape_not_whitelisted');
        assert.equal(JSON.stringify(parsed).includes(canary), false);
    }
    const forgedFact = parseActorShardProposal(JSON.stringify({
        ...strictProposal(candidate, 0, 1),
        knowledgeBasis: [canary],
        evidence: [canary],
    }), { candidate });
    assert.equal(forgedFact.error, 'actor_shard.required_evidence_missing');
    assert.equal(JSON.stringify(forgedFact).includes(canary), false);
});
