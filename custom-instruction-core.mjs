import { fingerprint } from './core.mjs';

export const GLOBAL_INSTRUCTION_SCOPES = Object.freeze([
    'profile',
    'physiology',
    'actor',
    'world',
    'forum',
    'social',
    'variable',
    'strict',
    'fast',
    'all',
]);

const SCOPE_SET = new Set(GLOBAL_INSTRUCTION_SCOPES);

function verbatim(value, limit = 12_000) {
    return String(value ?? '').slice(0, Math.max(0, Number(limit) || 12_000));
}

function normalizeScopes(value) {
    const source = Array.isArray(value) ? value : [];
    const scopes = [...new Set(source.map((entry) => String(entry || '')).filter((entry) => (
        SCOPE_SET.has(entry)
    )))];
    return scopes.length ? scopes : ['all'];
}

export function normalizeGlobalInstructionConfig(value, { maxChars = 12_000 } = {}) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const text = verbatim(source.text, maxChars);
    return {
        enabled: source.enabled !== false && Boolean(text.trim()),
        text,
        scopes: normalizeScopes(source.scopes),
    };
}

export function globalInstructionApplies(value, {
    module = '',
    channel = '',
} = {}) {
    const config = normalizeGlobalInstructionConfig(value);
    if (!config.enabled) return false;
    return config.scopes.includes('all')
        || config.scopes.includes(String(module || ''))
        || config.scopes.includes(String(channel || ''));
}

export function composeScopedModelInstruction(value, {
    module = '',
    channel = '',
    moduleInstruction = '',
} = {}) {
    const config = normalizeGlobalInstructionConfig(value);
    const moduleText = verbatim(moduleInstruction, 6_000);
    const blocks = [];
    const globalInjected = globalInstructionApplies(config, { module, channel });
    if (globalInjected) {
        blocks.push([
            `【用户全局模型补充指令｜范围 ${module || 'unknown'}/${channel || 'unknown'}】`,
            config.text,
            '【用户全局模型补充指令结束】',
        ].join('\n'));
    }
    if (moduleText.trim()) {
        blocks.push([
            `【用户模块专属指令｜${module || 'unknown'}】`,
            moduleText,
            '【用户模块专属指令结束】',
        ].join('\n'));
    }
    return {
        text: blocks.join('\n\n'),
        globalInjected,
        moduleInjected: Boolean(moduleText.trim()),
        metadata: globalInstructionMetadata(config, {
            module,
            channel,
            injected: globalInjected,
        }),
    };
}

export function globalInstructionMetadata(value, {
    module = '',
    channel = '',
    injected = false,
} = {}) {
    const config = normalizeGlobalInstructionConfig(value);
    return {
        enabled: config.enabled,
        scopes: [...config.scopes],
        length: [...config.text].length,
        hash: config.text ? `${[...config.text].length}:${fingerprint(config.text)}` : '',
        module: SCOPE_SET.has(module) ? module : String(module || ''),
        channel: ['strict', 'fast'].includes(channel) ? channel : String(channel || ''),
        injected: injected === true,
    };
}

export function customInstructionDiagnosticProjection(value, injectionRecords = []) {
    const config = normalizeGlobalInstructionConfig(value);
    const records = (Array.isArray(injectionRecords) ? injectionRecords : [])
        .filter((entry) => entry && typeof entry === 'object')
        .map((entry) => ({
            module: String(entry.module || ''),
            channel: String(entry.channel || ''),
            injected: entry.injected === true,
        }))
        .slice(-80);
    return {
        ...globalInstructionMetadata(config),
        injectionCount: records.filter((entry) => entry.injected).length,
        records,
    };
}
