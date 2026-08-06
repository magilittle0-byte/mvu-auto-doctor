import assert from 'node:assert/strict';
import test from 'node:test';

import {
    adjudicateSovereigntyBlackboard,
    allocateSovereigntyRouteSlot,
    createSovereigntyBlackboard,
    runSovereigntyAgentPool,
} from '../sovereignty-orchestrator-core.mjs';

test('balanced coordinator runs at most two actor agents and one world agent in one parallel round', async () => {
    const started = [];
    const release = [];
    const jobs = [
        { agentType: 'actor', agentId: 'actor-a', actorId: 'A', input: { isolated: true } },
        { agentType: 'actor', agentId: 'actor-b', actorId: 'B', input: { isolated: true } },
        { agentType: 'actor', agentId: 'actor-c', actorId: 'C', input: { isolated: true } },
        { agentType: 'world', agentId: 'world-a', input: { isolated: true } },
        { agentType: 'world', agentId: 'world-b', input: { isolated: true } },
    ];
    const running = runSovereigntyAgentPool({
        blackboard: createSovereigntyBlackboard({ turn: 4 }),
        jobs,
        runAgent: (job) => new Promise((resolve) => {
            started.push(job.agentId);
            release.push(() => resolve({ from: job.agentId }));
        }),
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(started.sort(), ['actor-a', 'actor-b', 'world-a']);
    release.forEach((resolve) => resolve());
    const result = await running;
    assert.equal(result.rounds, 1);
    assert.equal(result.agentConversationCount, 0);
    assert.equal(result.selected, 3);
    assert.equal(result.succeeded, 3);
});

test('one failed agent is isolated and does not suppress other candidates', async () => {
    const result = await runSovereigntyAgentPool({
        blackboard: createSovereigntyBlackboard({ turn: 2 }),
        jobs: [
            { agentType: 'actor', agentId: 'broken', actorId: 'A' },
            { agentType: 'actor', agentId: 'healthy', actorId: 'B' },
            { agentType: 'world', agentId: 'world' },
        ],
        runAgent: async (job) => {
            if (job.agentId === 'broken') throw new Error('slot unavailable');
            return { candidate: job.agentId };
        },
    });
    assert.equal(result.failed, 1);
    assert.equal(result.succeeded, 2);
    assert.equal(result.blackboard.failures[0].isolated, true);
    assert.equal(result.blackboard.candidates.length, 2);
});

test('agents publish candidates only and deterministic local adjudicator owns final writes', () => {
    const blackboard = {
        ...createSovereigntyBlackboard({ turn: 1 }),
        candidates: [
            { id: '2', agentType: 'world', actorId: '', status: 'candidate', writeAuthority: false },
            { id: '1', agentType: 'actor', actorId: 'A', status: 'candidate', writeAuthority: false },
        ],
    };
    const adjudicated = adjudicateSovereigntyBlackboard(blackboard, {
        acceptCandidate: (candidate) => candidate.id === '1'
            ? true
            : { accepted: false, reason: 'conflict' },
    });
    assert.equal(adjudicated.adjudication.accepted.length, 1);
    assert.equal(adjudicated.adjudication.rejected.length, 1);
    assert.equal(adjudicated.adjudication.agentWriteCount, 0);
    assert.equal(adjudicated.adjudication.finalWriteAuthority, 'local_coordinator_only');
});

test('healthy slot allocation preserves each endpoint model preset and credential reference', () => {
    const slots = [
        {
            id: 'slow', endpoint: 'https://one.invalid', model: 'model-one', preset: 'p1',
            credentialRef: 'credential-one', route: 'backend', latencyMs: 900, failureRate: 0,
        },
        {
            id: 'healthy', endpoint: 'https://two.invalid', model: 'model-two', preset: 'p2',
            credentialRef: 'credential-two', route: 'browser', latencyMs: 200, failureRate: 0,
        },
    ];
    const selected = allocateSovereigntyRouteSlot(slots);
    assert.equal(selected.id, 'healthy');
    assert.equal(selected.endpoint, 'https://two.invalid');
    assert.equal(selected.model, 'model-two');
    assert.equal(selected.preset, 'p2');
    assert.equal(selected.credentialRef, 'credential-two');
    assert.equal(selected.route, 'browser');
    const failover = allocateSovereigntyRouteSlot(slots, { excludeIds: ['healthy'] });
    assert.equal(failover.endpoint, 'https://one.invalid');
    assert.equal(failover.credentialRef, 'credential-one');
});
