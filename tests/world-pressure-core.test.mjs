import assert from 'node:assert/strict';
import test from 'node:test';
import {
    admitDoctorWorldCandidates,
    emptyWorldPressureState,
    observeAcceptedContentPressure,
} from '../world-pressure-core.mjs';

test('accepted content over-pressure is acknowledged without rewriting it and blocks new doctor threats', () => {
    const observed = observeAcceptedContentPressure(
        emptyWorldPressureState(),
        {
            turn: 36,
            content: [
                '<content>',
                '门外同时存在三项首领级事实：暴君胚胎、暴食者·生化温床与实验体高阳。',
                '【BOSS：暴君胚胎】【BOSS：暴食者·生化温床】【BOSS：实验体高阳】',
                '</content>',
            ].join(''),
        },
    );
    assert.equal(observed.external.sameSceneBossCount >= 3, true);
    assert.equal(observed.external.overCap, true);

    const result = admitDoctorWorldCandidates(observed, [
        {
            id: 'new-boss',
            channel: 'environment',
            actionKind: 'threat',
            pressureCost: 3,
            threatLevel: 'boss',
            sameScene: true,
        },
        {
            id: 'retreat-route',
            channel: 'faction',
            actionKind: 'recovery',
            pressureCost: 0,
            sameScene: true,
        },
        {
            id: 'remote-rumor',
            channel: 'faction',
            actionKind: 'information',
            pressureCost: 0,
            sameScene: false,
        },
    ], {
        turn: 36,
        phase: 'exploration',
        pressureCap: 3,
        sameSceneBossCap: 1,
        recoveryCadence: 'balanced',
        injectionLimit: 2,
    });
    assert.deepEqual(result.admitted.map((item) => item.id), ['retreat-route', 'remote-rumor']);
    assert.equal(result.delayed.some((item) => item.id === 'new-boss'), true);
    assert.equal(result.state.external.sameSceneBossCount, 3);
});

test('elite or boss pressure creates recovery debt before another threat may be admitted', () => {
    const first = admitDoctorWorldCandidates(emptyWorldPressureState(), [{
        id: 'elite-resolution',
        channel: 'actor',
        actionKind: 'threat',
        pressureCost: 2,
        threatLevel: 'elite',
        sameScene: true,
    }], {
        turn: 5,
        phase: 'escalation',
        pressureCap: 4,
        sameSceneBossCap: 1,
        recoveryCadence: 'balanced',
        injectionLimit: 2,
    });
    assert.equal(first.admitted.length, 1);
    assert.equal(first.state.recoveryDebt > 0, true);

    const second = admitDoctorWorldCandidates(first.state, [
        {
            id: 'follow-up-threat',
            channel: 'environment',
            actionKind: 'threat',
            pressureCost: 1,
            threatLevel: 'ordinary',
            sameScene: true,
        },
        {
            id: 'quiet-investigation',
            channel: 'faction',
            actionKind: 'information',
            pressureCost: 0,
            sameScene: false,
        },
    ], {
        turn: 6,
        phase: 'recovery',
        pressureCap: 4,
        sameSceneBossCap: 1,
        recoveryCadence: 'balanced',
        injectionLimit: 2,
    });
    assert.deepEqual(second.admitted.map((item) => item.id), ['quiet-investigation']);
    assert.equal(second.delayed.some((item) => item.id === 'follow-up-threat'), true);
});
