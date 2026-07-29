import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const [diagnosticPath, chatPath] = process.argv.slice(2);

if (!diagnosticPath || !chatPath) {
    throw new Error('usage: node qc/analyze-user-evidence.mjs <diagnostic.json> <chat.jsonl>');
}

function sha256(buffer) {
    return createHash('sha256').update(buffer).digest('hex');
}

function normalizeRawStringNewlines(source) {
    let output = '';
    let inString = false;
    let escaped = false;
    let repairedLineFeeds = 0;
    let repairedCarriageReturns = 0;

    for (let index = 0; index < source.length; index += 1) {
        const character = source[index];
        if (inString) {
            if (escaped) {
                output += character;
                escaped = false;
                continue;
            }
            if (character === '\\') {
                output += character;
                escaped = true;
                continue;
            }
            if (character === '"') {
                output += character;
                inString = false;
                continue;
            }
            if (character === '\n') {
                output += '\\n';
                repairedLineFeeds += 1;
                continue;
            }
            if (character === '\r') {
                if (source[index + 1] === '\n') continue;
                output += '\\r';
                repairedCarriageReturns += 1;
                continue;
            }
            output += character;
            continue;
        }

        output += character;
        if (character === '"') inString = true;
    }

    return {
        output,
        repairedLineFeeds,
        repairedCarriageReturns,
        unterminatedString: inString,
    };
}

function parseTransportJsonl(source) {
    const normalized = normalizeRawStringNewlines(source);
    const lines = normalized.output.split(/\r?\n/u).filter((line) => line.trim());
    const records = [];
    let invalidRecords = 0;

    for (const line of lines) {
        try {
            records.push(JSON.parse(line));
        } catch {
            invalidRecords += 1;
        }
    }

    return {
        records,
        invalidRecords,
        logicalRecordCount: lines.length,
        repairedLineFeeds: normalized.repairedLineFeeds,
        repairedCarriageReturns: normalized.repairedCarriageReturns,
        unterminatedString: normalized.unterminatedString,
    };
}

function topLevelSignatures(records) {
    const counts = new Map();
    for (const record of records) {
        if (!record || typeof record !== 'object' || Array.isArray(record)) continue;
        const signature = Object.keys(record).sort().join('|');
        counts.set(signature, (counts.get(signature) || 0) + 1);
    }
    return [...counts]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .map(([keys, count]) => ({ keys, count }));
}

function countValues(values) {
    const counts = new Map();
    for (const value of values) {
        const normalized = String(value ?? 'none');
        counts.set(normalized, (counts.get(normalized) || 0) + 1);
    }
    return Object.fromEntries([...counts].sort(([left], [right]) => (
        left.localeCompare(right)
    )));
}

function numericSummary(values) {
    const numbers = values.map(Number).filter(Number.isFinite);
    if (numbers.length === 0) {
        return { count: 0, min: null, max: null, total: 0 };
    }
    return {
        count: numbers.length,
        min: Math.min(...numbers),
        max: Math.max(...numbers),
        total: numbers.reduce((sum, value) => sum + value, 0),
    };
}

function safeDiagnosticSummary(diagnostic) {
    const modelDiagnostics = Array.isArray(diagnostic?.modelDiagnostics)
        ? diagnostic.modelDiagnostics
        : [];
    const hardContract = diagnostic?.latestHardContract || {};
    const latestStatuses = diagnostic?.latestStatuses || {};
    const prompts = diagnostic?.userPrompts || {};
    const environment = diagnostic?.environment || {};
    const currentChat = diagnostic?.currentChat || {};
    const legacySocialRepairAttempts = modelDiagnostics.filter((entry) => (
        ['social.invalid_structure_after_repair', 'social-structure-repaired']
            .includes(String(entry?.failureKind || ''))
    )).length;
    const legacySocialRepairRecovered = modelDiagnostics.filter((entry) => (
        entry?.failureKind === 'social-structure-repaired'
    )).length;

    return {
        schemaVersion: Number(diagnostic?.schemaVersion || 0),
        plugin: {
            id: String(diagnostic?.plugin?.id || ''),
            version: String(diagnostic?.plugin?.version || ''),
        },
        environment: {
            checkCounts: {
                ok: Number(environment?.checkCounts?.ok || 0),
                warn: Number(environment?.checkCounts?.warn || 0),
                error: Number(environment?.checkCounts?.error || 0),
                info: Number(environment?.checkCounts?.info || 0),
            },
            barrierProtocol: {
                required: environment?.barrierProtocol?.required === true,
                externalDatabaseDetected:
                    environment?.barrierProtocol?.externalDatabaseDetected === true,
                registered: environment?.barrierProtocol?.registered === true,
                clientCount: Number(environment?.barrierProtocol?.clientCount || 0),
                errorCode: String(environment?.barrierProtocol?.errorCode || ''),
                mode: String(environment?.barrierProtocol?.mode || ''),
                externalWriteConsistency: String(
                    environment?.barrierProtocol?.externalWriteConsistency || '',
                ),
            },
        },
        currentChat: {
            present: currentChat?.present === true,
            messageCount: Number(currentChat?.messageCount || 0),
            repairJournalCount: Number(currentChat?.repairJournalCount || 0),
            socialAuditCount: Number(currentChat?.socialAuditCount || 0),
            continuity: {
                activeCount: Number(currentChat?.continuity?.activeCount || 0),
                resolvedCount: Number(currentChat?.continuity?.resolvedCount || 0),
            },
            forum: {
                postCount: Number(currentChat?.forum?.postCount || 0),
                totalComments: Number(currentChat?.forum?.totalComments || 0),
            },
        },
        modelCalls: {
            total: Number(currentChat?.modelCalls?.total || 0),
            succeeded: Number(currentChat?.modelCalls?.succeeded || 0),
            failed: Number(currentChat?.modelCalls?.failed || 0),
            rateLimited: Number(currentChat?.modelCalls?.rateLimited || 0),
            byTask: Object.fromEntries(
                Object.entries(currentChat?.modelCalls?.byTask || {})
                    .filter(([, value]) => Number.isFinite(Number(value)))
                    .map(([key, value]) => [key, Number(value)])
                    .sort(([left], [right]) => left.localeCompare(right)),
            ),
        },
        longRunCallPressure: {
            legacySocialSecondModelAttempts: legacySocialRepairAttempts,
            legacySocialSecondModelRecovered: legacySocialRepairRecovered,
            legacySocialSecondModelFailed:
                legacySocialRepairAttempts - legacySocialRepairRecovered,
            projectedCallsWithoutSecondModelRepair: Math.max(
                0,
                Number(currentChat?.modelCalls?.total || 0) - legacySocialRepairAttempts,
            ),
        },
        actorShards: {
            selected: Number(diagnostic?.actorShards?.selected || 0),
            completed: Number(diagnostic?.actorShards?.completed || 0),
        },
        prompts: Object.fromEntries(
            Object.entries(prompts)
                .filter(([, value]) => value && typeof value === 'object')
                .map(([key, value]) => [key, {
                    enabled: value.enabled === true,
                    length: Number(value.length || 0),
                    hash: String(value.hash || ''),
                }])
                .sort(([left], [right]) => left.localeCompare(right)),
        ),
        latestStatuses: Object.fromEntries(
            Object.entries(latestStatuses)
                .filter(([, value]) => value && typeof value === 'object')
                .map(([key, value]) => [key, {
                    status: String(value.status || ''),
                    targetIndex: Number.isFinite(Number(value.targetIndex))
                        ? Number(value.targetIndex)
                        : null,
                }])
                .sort(([left], [right]) => left.localeCompare(right)),
        ),
        hardContract: {
            targetIndex: Number.isFinite(Number(hardContract?.targetIndex))
                ? Number(hardContract.targetIndex)
                : null,
            issueCount: Number(hardContract?.issueCount || 0),
            issues: (Array.isArray(hardContract?.issues) ? hardContract.issues : [])
                .map((issue) => ({
                    code: String(issue?.code || ''),
                    severity: String(issue?.severity || ''),
                    pathDigest: String(issue?.pathDigest || ''),
                })),
        },
        modelDiagnostics: {
            count: modelDiagnostics.length,
            byStatus: countValues(modelDiagnostics.map((entry) => entry?.status)),
            byPhase: countValues(modelDiagnostics.map((entry) => entry?.phase)),
            byChannel: countValues(modelDiagnostics.map((entry) => entry?.channel)),
            byFailureKind: countValues(
                modelDiagnostics.map((entry) => entry?.failureKind),
            ),
            byRootType: countValues(modelDiagnostics.map((entry) => entry?.rootType)),
            byTargetIndex: countValues(
                modelDiagnostics.map((entry) => entry?.targetIndex),
            ),
            durationMs: numericSummary(
                modelDiagnostics.map((entry) => entry?.durationMs),
            ),
            queueWaitMs: numericSummary(
                modelDiagnostics.map((entry) => entry?.queueWaitMs),
            ),
            outputChars: numericSummary(
                modelDiagnostics.map((entry) => entry?.outputChars),
            ),
            attempts: countValues(modelDiagnostics.map((entry) => entry?.attempt)),
            tagStates: {
                updateOpen: countValues(
                    modelDiagnostics.map((entry) => entry?.tags?.updateOpen),
                ),
                updateClose: countValues(
                    modelDiagnostics.map((entry) => entry?.tags?.updateClose),
                ),
                jsonOpen: countValues(
                    modelDiagnostics.map((entry) => entry?.tags?.jsonOpen),
                ),
                jsonClose: countValues(
                    modelDiagnostics.map((entry) => entry?.tags?.jsonClose),
                ),
                continuityOpen: countValues(
                    modelDiagnostics.map((entry) => entry?.tags?.continuityOpen),
                ),
                continuityClose: countValues(
                    modelDiagnostics.map((entry) => entry?.tags?.continuityClose),
                ),
                forumOpen: countValues(
                    modelDiagnostics.map((entry) => entry?.tags?.forumOpen),
                ),
                forumClose: countValues(
                    modelDiagnostics.map((entry) => entry?.tags?.forumClose),
                ),
                recovered: countValues(
                    modelDiagnostics.map((entry) => entry?.tags?.recovered),
                ),
            },
        },
    };
}

function tagCounts(text) {
    const source = String(text || '');
    const count = (pattern) => (source.match(pattern) || []).length;
    return {
        contentOpen: count(/<content(?:\s[^>]*)?>/giu),
        contentClose: count(/<\/content\s*>/giu),
        updateOpen: count(/<UpdateVariable(?:\s[^>]*)?>/giu),
        updateClose: count(/<\/UpdateVariable\s*>/giu),
        optionsOpen: count(/<(?:options|branches)(?:\s[^>]*)?>/giu),
        optionsClose: count(/<\/(?:options|branches)\s*>/giu),
        jsonPatchOpen: count(/<JsonPatch(?:\s[^>]*)?>/giu),
        jsonPatchClose: count(/<\/JsonPatch\s*>/giu),
        statusPlaceholder: count(/<StatusPlaceHolder(?:\s[^>]*)?>/giu),
    };
}

function contentFingerprint(text) {
    const source = String(text || '');
    return {
        chars: [...source].length,
        sha256: createHash('sha256').update(source).digest('hex'),
        tags: tagCounts(source),
    };
}

function stableJsonFingerprint(value) {
    const source = JSON.stringify(value ?? null);
    return {
        bytes: Buffer.byteLength(source),
        sha256: createHash('sha256').update(source).digest('hex'),
    };
}

function safeDatabaseFields(record) {
    const fields = [
        'TavernDB_ACU_IsolatedData',
        'TavernDB_ACU_InternalSheetGuide',
        'TavernDB_ACU_ScopedConfig',
    ];
    return Object.fromEntries(fields
        .filter((field) => Object.prototype.hasOwnProperty.call(record, field))
        .map((field) => {
            const value = record[field];
            return [field, {
                present: true,
                topLevelEntryCount: value && typeof value === 'object'
                    ? Object.keys(value).length
                    : 0,
                ...stableJsonFingerprint(value),
            }];
        }));
}

function collectNamedValues(value, targetKey, output = [], seen = new Set()) {
    if (!value || typeof value !== 'object' || seen.has(value)) return output;
    seen.add(value);
    if (Object.prototype.hasOwnProperty.call(value, targetKey)) {
        output.push(value[targetKey]);
    }
    if (Array.isArray(value)) {
        for (const entry of value) collectNamedValues(entry, targetKey, output, seen);
    } else {
        for (const child of Object.values(value)) {
            collectNamedValues(child, targetKey, output, seen);
        }
    }
    return output;
}

function safeJournalSummary(records) {
    const journals = collectNamedValues(records, 'repairJournal')
        .filter(Array.isArray)
        .flat();
    const modelDiagnostics = collectNamedValues(records, 'modelDiagnostics')
        .filter(Array.isArray)
        .flat();
    const receipts = collectNamedValues(records, 'receipts')
        .filter((value) => value && typeof value === 'object' && !Array.isArray(value))
        .flatMap((value) => Object.values(value));
    return {
        repairJournal: {
            count: journals.length,
            byStatus: countValues(journals.map((entry) => entry?.status)),
            byTargetIndex: countValues(journals.map((entry) => entry?.targetIndex)),
        },
        modelDiagnostics: {
            count: modelDiagnostics.length,
            byStatus: countValues(modelDiagnostics.map((entry) => entry?.status)),
            byPhase: countValues(modelDiagnostics.map((entry) => entry?.phase)),
            byFailureKind: countValues(
                modelDiagnostics.map((entry) => entry?.failureKind),
            ),
            byTargetIndex: countValues(
                modelDiagnostics.map((entry) => entry?.targetIndex),
            ),
        },
        terminalReceipts: {
            count: receipts.length,
            byStatus: countValues(receipts.map((entry) => (
                entry?.status || entry?.state
            ))),
        },
    };
}

function safeChatSummary(records) {
    const messages = records.filter((record) => (
        record
        && typeof record === 'object'
        && !Array.isArray(record)
        && Object.prototype.hasOwnProperty.call(record, 'mes')
    ));
    const assistantMessages = messages.filter((record) => (
        record.is_user !== true && record.is_system !== true
    ));
    const structureMismatch = (text) => {
        const tags = tagCounts(text);
        return (
            tags.contentOpen !== tags.contentClose
            || tags.updateOpen !== tags.updateClose
            || tags.optionsOpen !== tags.optionsClose
            || tags.jsonPatchOpen !== tags.jsonPatchClose
        );
    };
    return {
        records: {
            total: records.length,
            headers: records.length - messages.length,
            messages: messages.length,
            user: messages.filter((record) => record.is_user === true).length,
            assistant: messages.filter((record) => (
                record.is_user !== true && record.is_system !== true
            )).length,
            system: messages.filter((record) => record.is_system === true).length,
        },
        structure: {
            selectedAssistantMismatchCount: assistantMessages.filter((record) => (
                structureMismatch(record.mes)
            )).length,
            archivedNonselectedMismatchCount: assistantMessages.reduce(
                (sum, record) => {
                    const swipes = Array.isArray(record.swipes) ? record.swipes : [];
                    return sum + swipes.filter((text, swipeIndex) => (
                        swipeIndex !== record.swipe_id && structureMismatch(text)
                    )).length;
                },
                0,
            ),
            swipeMetadataMisalignmentCount: assistantMessages.filter((record) => (
                (Array.isArray(record.swipes) ? record.swipes.length : 0)
                !== (Array.isArray(record.swipe_info) ? record.swipe_info.length : 0)
            )).length,
        },
        messages: messages.map((record, index) => {
            const swipes = Array.isArray(record.swipes) ? record.swipes : [];
            const swipeInfo = Array.isArray(record.swipe_info)
                ? record.swipe_info
                : [];
            return {
                logicalRecordIndex: index,
                role: record.is_user === true
                    ? 'user'
                    : record.is_system === true ? 'system' : 'assistant',
                selectedSwipeId: Number.isInteger(record.swipe_id)
                    ? record.swipe_id
                    : null,
                swipeCount: swipes.length,
                swipeInfoCount: swipeInfo.length,
                swipeMetadataAligned: swipes.length === swipeInfo.length,
                selected: contentFingerprint(record.mes),
                swipes: swipes.map((text, swipeIndex) => ({
                    swipeIndex,
                    ...contentFingerprint(text),
                })),
                database: safeDatabaseFields(record),
                variables: stableJsonFingerprint(record.variables),
            };
        }),
        lifecycle: safeJournalSummary(records),
    };
}

const [diagnosticBuffer, chatBuffer] = await Promise.all([
    readFile(diagnosticPath),
    readFile(chatPath),
]);
const diagnostic = JSON.parse(diagnosticBuffer.toString('utf8').replace(/^\uFEFF/u, ''));
const chat = parseTransportJsonl(chatBuffer.toString('utf8').replace(/^\uFEFF/u, ''));

const report = {
    schemaVersion: 1,
    diagnostic: {
        bytes: diagnosticBuffer.length,
        sha256: sha256(diagnosticBuffer),
        summary: safeDiagnosticSummary(diagnostic),
    },
    chat: {
        bytes: chatBuffer.length,
        sha256: sha256(chatBuffer),
        logicalRecordCount: chat.logicalRecordCount,
        parsedRecordCount: chat.records.length,
        invalidRecordCount: chat.invalidRecords,
        repairedLineFeeds: chat.repairedLineFeeds,
        repairedCarriageReturns: chat.repairedCarriageReturns,
        unterminatedString: chat.unterminatedString,
        topLevelSignatures: topLevelSignatures(chat.records),
        summary: safeChatSummary(chat.records),
    },
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
