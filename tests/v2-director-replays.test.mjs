import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
    adjudicateClaim,
    adjudicateTurnBoundary,
    adjudicateUnverifiedCode,
    createTurnBoundary,
    recallDirectorRisks,
} from '../v2/director/index.mjs';
import {
    compareMessageFingerprints,
    createBranch,
    createMessageFingerprint,
    hashText,
} from '../v2/transaction/index.mjs';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const CORPUS_PATH = path.resolve(TEST_DIR, '..', 'fixtures', '2.0', 'replay-cases.json');
const corpus = JSON.parse(await readFile(CORPUS_PATH, 'utf8'));
const replayById = new Map(corpus.cases.map((entry) => [entry.id, entry]));

function replay(id) {
    const value = replayById.get(id);
    assert.ok(value, `missing replay fixture ${id}`);
    return value;
}

function messageFingerprint({
    branchId = 'branch-current',
    logicalIndex = 4,
    messageId = 'msg-current',
    contentHash = hashText('current'),
    generation = 4,
} = {}) {
    const result = createMessageFingerprint({
        chatId: 'fixture-chat',
        logicalIndex,
        messageId,
        swipeId: 0,
        generation,
        branchId,
        parentHash: 'digest-parent',
        contentHash,
    });
    assert.equal(result.status, 'valid');
    return result.value;
}

function activeBranch(target) {
    const result = createBranch({
        id: target.branchId,
        divergenceFingerprint: target,
        headFingerprint: target,
        checkpointRef: 'fixture:checkpoint',
    });
    assert.equal(result.status, 'valid');
    return result.value;
}

function evidence(branchId = 'branch-current') {
    return {
        kind: 'message',
        ref: 'fixture:user-turn',
        branchId,
    };
}

function adjudicateFixtureClaim(id, assessment, h2Resolution) {
    const fixture = replay(id);
    const target = messageFingerprint({ branchId: fixture.input.context.branchId });
    const result = adjudicateClaim({
        claim: {
            id: `claim:${id}`,
            factId: `fact:${id}`,
            proposition: fixture.input.operation.payload.claim,
            branchId: fixture.input.context.branchId,
            subjectIds: [],
            evidence: [evidence(fixture.input.context.branchId)],
        },
        assessment,
        context: {
            target,
            currentFingerprint: target,
            activeBranch: activeBranch(target),
            explicitRetcon: fixture.input.context.explicitRetconMode === true,
            checkpointRef: 'fixture:checkpoint',
            ...(h2Resolution ? { h2Resolution } : {}),
        },
    });
    return { fixture, result };
}

test('replay.agency.no_move — RR-AGENCY-NO-MOVE', () => {
    const fixture = replay('RR-AGENCY-NO-MOVE');
    const user = fixture.input.turns.find((entry) => entry.role === 'user');
    const candidate = fixture.input.turns.find((entry) => entry.label === 'candidate');
    const target = messageFingerprint();
    const created = createTurnBoundary({
        branchId: fixture.input.context.branchId,
        target,
        authorizations: [{
            id: 'authorization:exact-dialogue',
            kind: 'dialogue',
            actorId: 'player',
            exactText: '青灯四十',
            evidence: [evidence()],
        }],
        negativeConstraints: fixture.input.context.negativeConstraints,
        protectedPlayerStateRefs: ['/player/position'],
    });
    assert.equal(created.status, 'valid');
    const result = adjudicateTurnBoundary(created.value, {
        riskRecall: recallDirectorRisks(candidate.text),
        contributions: [
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
        ],
    }, {
        currentFingerprint: target,
        activeBranch: activeBranch(target),
    });

    assert.match(user.text, /站在原地/);
    assert.equal(result.decision, fixture.expected.decision);
    assert.equal(
        result.allowedContributions.some((entry) => entry.actor === 'player'),
        false,
    );
    assert.ok(result.violations.some((entry) => (
        entry.code === 'boundary.explicit_negative_constraint'
    )));
});

test('replay.adjudication.reasonable — RR-BULLSHIT-REASONABLE', () => {
    const { fixture, result } = adjudicateFixtureClaim(
        'RR-BULLSHIT-REASONABLE',
        {
            impact: 'local',
            createsPersistentFact: true,
            semanticBasis: ['fixture-context:reasonable-low-impact-no-conflict'],
        },
    );
    assert.equal(result.adjudication.level, 'H1');
    assert.equal(result.adjudication.decision, fixture.expected.decision);
    assert.equal(result.fact.status, 'confirmed');
    assert.equal(result.fact.branchId, fixture.input.context.branchId);
});

test('replay.adjudication.advantage — RR-BULLSHIT-ADVANTAGE', () => {
    const { fixture, result } = adjudicateFixtureClaim(
        'RR-BULLSHIT-ADVANTAGE',
        {
            impact: 'material',
            createsPersistentFact: true,
            mechanicalAdvantage: true,
            semanticBasis: ['fixture-context:material-passage-advantage'],
        },
        {
            type: 'check',
            checkId: 'fixture:access-check',
        },
    );
    assert.equal(result.adjudication.level, 'H2');
    assert.equal(result.adjudication.decision, fixture.expected.decision);
    assert.equal(result.fact.status, 'candidate');
    assert.ok(result.adjudication.commands.some((entry) => entry.type === 'check'));
});

test('replay.adjudication.rewrite — RR-BULLSHIT-REWRITE', () => {
    const { fixture, result } = adjudicateFixtureClaim(
        'RR-BULLSHIT-REWRITE',
        {
            impact: 'structural',
            createsPersistentFact: true,
            contradictsConfirmedFact: true,
            rewritesBranchHistory: true,
            semanticBasis: ['fixture-state:confirmed-bridge-and-position-conflict'],
        },
    );
    assert.equal(result.adjudication.level, 'H3');
    assert.equal(result.adjudication.decision, fixture.expected.decision);
    assert.equal(result.fact, null);
    assert.deepEqual(result.adjudication.commands, []);
    assert.deepEqual(fixture.input.stateBefore, {
        bridge: 'collapsed',
        partyBank: 'east',
    });
});

test('replay.fact.random_code — RR-FACT-RANDOM-CODE', () => {
    const fixture = replay('RR-FACT-RANDOM-CODE');
    const branchId = fixture.input.context.branchId;
    const target = messageFingerprint({ branchId });
    const result = adjudicateUnverifiedCode({
        fact: {
            id: 'fact:fixture-random-code',
            proposition: fixture.input.operation.payload.candidateFact,
            branchId,
            scope: 'branch',
            subjectIds: [],
            evidence: [evidence(branchId)],
            impact: 'material',
        },
        npcKnowledge: {
            id: 'knowledge:fixture-random-code',
            knowerId: 'fixture-npc',
            factId: 'fact:fixture-random-code',
            branchId,
            visibility: 'private',
            acquiredBy: [evidence(branchId)],
        },
        activeBranch: activeBranch(target),
    });
    assert.equal(result.decision, 'reject-confirmation');
    assert.equal(result.fact.status, 'candidate');
    assert.notEqual(result.knowledge.state, 'verified');
    assert.deepEqual(result.grants, []);
});

test('replay.fingerprint.previous_reply remains stale under phase-3 regression', () => {
    const fixture = replay('RR-FINGERPRINT-PREVIOUS-REPLY');
    const { expectedFingerprint, candidateFingerprint } = fixture.input.context;
    const expected = messageFingerprint({
        logicalIndex: 4,
        messageId: expectedFingerprint.logicalMessageId,
        contentHash: expectedFingerprint.contentDigest,
        generation: 4,
    });
    const candidate = messageFingerprint({
        logicalIndex: 2,
        messageId: candidateFingerprint.logicalMessageId,
        contentHash: candidateFingerprint.contentDigest,
        generation: 2,
    });
    const compared = compareMessageFingerprints(expected, candidate);
    assert.equal(compared.status, fixture.expected.decision);
    assert.equal(compared.ok, false);
});
