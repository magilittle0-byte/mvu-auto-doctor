const POST_KINDS = new Set(['chat', 'reaction', 'rumor', 'guide', 'trade']);
const POST_STATUSES = new Set(['active', 'archived']);

function plainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function text(value, limit = 800) {
    return String(value ?? '').trim().slice(0, limit);
}

function list(value, limit = 8, itemLimit = 120) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.map((item) => text(item, itemLimit)).filter(Boolean))].slice(0, limit);
}

function integer(value, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(min, Math.min(max, Math.trunc(number)));
}

function stableId(prefix, ...parts) {
    const source = parts.map((part) => String(part ?? '')).join('|');
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
        hash ^= source.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return `${prefix}-${(hash >>> 0).toString(36)}`;
}

function normalizeComment(value, postId, index, turn) {
    if (!plainObject(value)) return null;
    const body = text(value.body || value.content, 600);
    if (!body) return null;
    const author = text(value.author || value.user || '路过网友', 60);
    return {
        id: text(value.id, 100) || stableId('FC', postId, author, body, index),
        author,
        body,
        tone: text(value.tone, 40),
        likes: integer(value.likes, 0, 0, 999999),
        createdTurn: integer(value.createdTurn, turn, 0, 999999),
    };
}

function normalizePost(value, index, turn, maxComments) {
    if (!plainObject(value)) return null;
    const title = text(value.title, 160);
    const body = text(value.body || value.content, 1800);
    if (!title || !body) return null;
    const author = text(value.author || value.user || '匿名回廊客', 60);
    const board = text(value.board || value.section || '闲聊广场', 40);
    const id = text(value.id, 100) || stableId('FP', board, title, author, index);
    const comments = (Array.isArray(value.comments) ? value.comments : [])
        .map((comment, commentIndex) => normalizeComment(comment, id, commentIndex, turn))
        .filter(Boolean)
        .slice(-maxComments);
    return {
        id,
        board,
        title,
        author,
        body,
        kind: POST_KINDS.has(value.kind) ? value.kind : 'chat',
        tags: list(value.tags, 6, 32),
        source: text(value.source || value.evidence, 300),
        sourceThreadIds: list(value.sourceThreadIds, 6, 100),
        causalSignal: value.causalSignal === true,
        impact: text(value.impact, 500),
        heat: integer(value.heat, comments.length, 0, 999999),
        status: POST_STATUSES.has(value.status) ? value.status : 'active',
        createdTurn: integer(value.createdTurn, turn, 0, 999999),
        updatedTurn: integer(value.updatedTurn, turn, 0, 999999),
        comments,
    };
}

export function emptyForumState(chatId = '') {
    return {
        version: 1,
        chatId: String(chatId || ''),
        turn: 0,
        updatedAt: 0,
        summary: '',
        posts: [],
        lastSource: null,
    };
}

export function normalizeForumState(value, {
    chatId = '',
    maxPosts = 36,
    maxComments = 16,
} = {}) {
    const source = plainObject(value) ? value : {};
    const turn = integer(source.turn, 0, 0, 999999);
    const posts = (Array.isArray(source.posts) ? source.posts : [])
        .map((post, index) => normalizePost(post, index, turn, maxComments))
        .filter(Boolean);
    const deduped = [];
    const seenIds = new Set();
    const seenContent = new Set();
    for (const post of posts) {
        const contentKey = `${post.board}\n${post.title}\n${post.body}`.toLocaleLowerCase();
        if (seenIds.has(post.id) || seenContent.has(contentKey)) continue;
        seenIds.add(post.id);
        seenContent.add(contentKey);
        deduped.push(post);
    }
    return {
        version: 1,
        chatId: String(chatId || source.chatId || ''),
        turn,
        updatedAt: integer(source.updatedAt, 0, 0),
        summary: text(source.summary, 500),
        posts: deduped
            .sort((left, right) => right.updatedTurn - left.updatedTurn || right.createdTurn - left.createdTurn)
            .slice(0, Math.max(8, integer(maxPosts, 36, 8, 100))),
        lastSource: plainObject(source.lastSource) ? {
            index: integer(source.lastSource.index, -1, -1, 999999),
            messageId: text(source.lastSource.messageId, 160),
            swipeId: text(source.lastSource.swipeId, 80),
        } : null,
    };
}

export function extractForumUpdate(output) {
    const source = String(output || '');
    const tagged = [...source.matchAll(/<ForumUpdate>\s*([\s\S]*?)\s*<\/ForumUpdate>/giu)].at(-1)?.[1];
    const candidate = tagged || source.match(/\{[\s\S]*\}/u)?.[0] || '';
    if (!candidate) return { update: null, error: '模型没有返回 <ForumUpdate> JSON' };
    try {
        const parsed = JSON.parse(candidate);
        if (!plainObject(parsed)) throw new Error('论坛更新不是对象');
        return { update: parsed, error: '' };
    } catch (error) {
        return { update: null, error: `论坛 JSON 无法解析：${error.message || error}` };
    }
}

export function applyForumUpdate(previous, rawUpdate, {
    chatId = '',
    maxPosts = 36,
    maxComments = 16,
} = {}) {
    const base = normalizeForumState(previous, { chatId, maxPosts, maxComments });
    const update = plainObject(rawUpdate) ? rawUpdate : {};
    const nextTurn = base.turn + 1;
    const byId = new Map(base.posts.map((post) => [post.id, structuredClone(post)]));

    for (const candidate of Array.isArray(update.newPosts) ? update.newPosts : []) {
        const post = normalizePost(candidate, byId.size, nextTurn, maxComments);
        if (!post) continue;
        post.createdTurn = nextTurn;
        post.updatedTurn = nextTurn;
        if (!byId.has(post.id)) byId.set(post.id, post);
    }

    for (const item of Array.isArray(update.comments) ? update.comments : []) {
        if (!plainObject(item)) continue;
        const postId = text(item.postId, 100);
        const post = byId.get(postId);
        if (!post) continue;
        const comment = normalizeComment(item, postId, post.comments.length, nextTurn);
        if (!comment) continue;
        const duplicate = post.comments.some((old) => (
            old.id === comment.id
            || (old.author === comment.author && old.body === comment.body)
        ));
        if (!duplicate) post.comments.push(comment);
        post.comments = post.comments.slice(-maxComments);
        post.updatedTurn = nextTurn;
        post.heat = Math.max(post.heat, post.comments.length);
    }

    for (const item of Array.isArray(update.heat) ? update.heat : []) {
        if (!plainObject(item)) continue;
        const post = byId.get(text(item.postId, 100));
        if (!post) continue;
        post.heat = integer(post.heat + Number(item.delta || 0), post.heat, 0, 999999);
        post.updatedTurn = nextTurn;
    }

    for (const postId of list(update.archive, maxPosts, 100)) {
        const post = byId.get(postId);
        if (!post) continue;
        post.status = 'archived';
        post.updatedTurn = nextTurn;
    }

    return normalizeForumState({
        ...base,
        turn: nextTurn,
        updatedAt: Date.now(),
        summary: text(update.summary, 500) || base.summary,
        posts: [...byId.values()],
    }, { chatId, maxPosts, maxComments });
}

export function forumDigest(state) {
    const normalized = normalizeForumState(state, { chatId: state?.chatId || '' });
    return JSON.stringify({
        turn: normalized.turn,
        summary: normalized.summary,
        posts: normalized.posts.map((post) => ({
            id: post.id,
            board: post.board,
            title: post.title,
            author: post.author,
            body: post.body,
            kind: post.kind,
            causalSignal: post.causalSignal,
            impact: post.impact,
            heat: post.heat,
            status: post.status,
            comments: post.comments,
        })),
    });
}

export function forumView(state, options = {}) {
    const normalized = normalizeForumState(state, options);
    const active = normalized.posts.filter((post) => post.status === 'active');
    const archived = normalized.posts.filter((post) => post.status === 'archived');
    const boards = [...new Set(active.map((post) => post.board))];
    return {
        ...normalized,
        active,
        archived,
        boards,
        unread: active.filter((post) => post.updatedTurn === normalized.turn).length,
    };
}
