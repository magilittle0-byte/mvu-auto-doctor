import assert from 'node:assert/strict';
import test from 'node:test';

import {
    actorActionCandidatesFromShard,
    emptyActorLedger,
    mergeActorWorldEventsIntoContinuity,
    migrateActorLedgerFromContinuity,
    scheduleActorTurns,
    settleActorActionCandidates,
} from '../actor-ledger-core.mjs';
import {
    parseActorShardProposal,
    selectActorShardCandidates,
} from '../actor-shard-core.mjs';

const sourceRef = (turn) => ({
    chatId: 'synthetic-world-behavior',
    messageId: `assistant-${turn}`,
    index: turn * 2,
    swipeId: 0,
    generation: turn,
    branchId: 'main',
    hash: `synthetic-${turn}`,
});

test('an offscreen NPC keeps producing constrained semantic facts when the player never mentions them', () => {
    let continuity = {
        version: 5,
        chatId: 'synthetic-world-behavior',
        turn: 1,
        threads: [{
            id: 'EVT-VALEN-LIKE',
            title: '离场联络人的恢复与准备',
            kind: 'personal',
            eventType: 'progress',
            origin: 'main_derivative',
            relation: 'linked',
            stage: 'advancing',
            summary: '联络人带伤离开酒吧，准备回家治疗。',
            offscreenBeat: '联络人刚刚离开酒吧。',
            nextBeat: '等待Roy主动联系瓦伦。',
            trigger: 'Roy决定是否召唤瓦伦。',
            seedBasis: 'synthetic branch fixture',
            actors: ['Roy', '瓦伦', '恶魔旅团'],
            locations: ['酒吧'],
            knowledge: 'observed',
            urgency: 3,
            createdTurn: 1,
            lastAdvancedTurn: 1,
            sourceRefs: [sourceRef(1)],
        }],
        world: {},
    };
    let ledger = migrateActorLedgerFromContinuity(
        emptyActorLedger(continuity.chatId),
        continuity,
        { excludedActorNames: ['Roy'] },
    );
    const semanticFacts = [
        ['location', '瓦伦抵达宅邸并进入私人诊疗室'],
        ['condition', '瓦伦完成第一轮排毒并恢复基本行动能力'],
        ['risk', '瓦伦让医生使用普通食物中毒作为对外病历说明'],
        ['relationship', '瓦伦向管家维持了独处休养的身份掩护'],
        ['plan', '瓦伦核对了父亲书房的日常出入时段'],
        ['resource', '瓦伦准备了一套不触发家族警报的备用衣物与现金'],
        ['knowledge', '瓦伦确认父亲当晚仍会按惯例进入书房'],
        ['commitment', '瓦伦把等待联系设为不主动发信但继续准备的行动约束'],
        ['condition', '瓦伦的手部震颤减轻，能够进行精细操作'],
        ['plan', '瓦伦完成保险柜外围观察方案并保留退出路线'],
        ['risk', '瓦伦清除了诊疗室内可能暴露外出经历的痕迹'],
    ];
    const settledWorldEvents = [];

    for (let turn = 2; turn <= 13; turn += 1) {
        ledger.turn = turn;
        const schedule = scheduleActorTurns(ledger, {
            turn,
            maxActors: 1,
            explorationSlots: 0,
            excludedActorNames: ['Roy'],
        });
        assert.deepEqual(schedule.selected.map((item) => item.actorName), ['瓦伦']);

        if (turn === 4) {
            ledger = settleActorActionCandidates(ledger, [], {
                turn,
                attemptedActorIds: schedule.selected.map((item) => item.actorId),
            }).ledger;
            continue;
        }

        const candidate = selectActorShardCandidates({
            continuity,
            actorLedger: ledger,
            schedule,
            presentText: 'Roy继续与卡尔处理当前现场，没有提及离场联络人。',
            excludedActorNames: ['Roy'],
            maxWorkers: 1,
        })[0];
        assert.equal(candidate.name, '瓦伦');
        const [kind, summary] = semanticFacts[settledWorldEvents.length];
        const destination = turn === 2 ? '哈克南宅邸' : candidate.actorState.location.name;
        const parsed = parseActorShardProposal(JSON.stringify({
            actorId: candidate.id,
            actorName: candidate.name,
            time: `后台第${turn}回合`,
            location: destination,
            travelTurns: turn === 2 ? 1 : 0,
            knowledgeBasis: [candidate.knowledgeBasis[0]],
            currentGoal: '在不主动联系Roy的前提下恢复、掩护并准备后续行动',
            intent: 'execute',
            candidateAction: summary,
            stateChanges: [{ kind, summary }],
            interactionTargets: [],
            resourceCosts: [],
            capabilityUsed: '',
            waitCondition: '',
            sourceThreads: [candidate.sourceThreads[0]],
            evidence: [candidate.evidence[0]],
            causalChain: [candidate.causalChain[0]],
        }), { candidate });
        assert.equal(parsed.error, undefined);
        const actionCandidates = actorActionCandidatesFromShard(
            ledger,
            [parsed.proposal],
            { turn, collisionIntensity: 0 },
        );
        const settlement = settleActorActionCandidates(ledger, actionCandidates, {
            turn,
            attemptedActorIds: schedule.selected.map((item) => item.actorId),
        });
        assert.equal(settlement.accepted[0].semanticProgress, true);
        ledger = settlement.ledger;
        settledWorldEvents.push(...settlement.worldEvents);
        continuity = mergeActorWorldEventsIntoContinuity(continuity, settlement.worldEvents);
    }

    const valen = ledger.actors[0];
    assert.equal(ledger.actors.length, 1);
    assert.equal(valen.name, '瓦伦');
    assert.equal(valen.currentGoals.some((item) => /Roy/u.test(item)), false);
    assert.equal(valen.constraints.some((item) => /Roy/u.test(item)), false);
    assert.equal(valen.stimuli.some((item) => /Roy/u.test(item.summary)), true);
    assert.equal(valen.semanticProgressCount, 11);
    assert.equal(valen.stateFacts.length, 11);
    assert.equal(valen.location.name, '哈克南宅邸');
    assert.equal(valen.lastSemanticTurn, 13);
    assert.equal(settledWorldEvents.length, 11);
    assert.equal(
        continuity.threads.filter((thread) => thread.id.startsWith('ACTOR-')).length,
        11,
    );
});
