import assert from 'node:assert/strict';

import {
    applyForumUpdate,
    emptyForumState,
    extractForumUpdate,
    forumDigest,
    forumView,
    normalizeForumState,
} from '../forum-core.mjs';

const parsed = extractForumUpdate(`说明应被忽略
<ForumUpdate>{"summary":"港城午后","newPosts":[{"id":"FP-1","board":"闲聊广场","title":"北门那家面摊换老板了？","author":"盐汽水","body":"今天味道淡了点，有人知道吗","kind":"chat","tags":["吃喝"],"source":"港城日常","heat":3}],"comments":[],"heat":[],"archive":[]}</ForumUpdate>`);
assert.equal(parsed.error, '');
assert.equal(parsed.update.newPosts[0].id, 'FP-1');

const first = applyForumUpdate(emptyForumState('chat-a'), parsed.update, { chatId: 'chat-a' });
assert.equal(first.turn, 1);
assert.equal(first.posts.length, 1);
assert.equal(first.posts[0].kind, 'chat');

const second = applyForumUpdate(first, {
    summary: '面摊话题继续发酵',
    newPosts: [{
        id: 'FP-2',
        board: '求助区',
        title: '今晚北岸还有渡船吗',
        author: '赶夜路的人',
        body: '临时加班，怕赶不上末班。',
        kind: 'guide',
        source: '港城渡船班次',
    }],
    comments: [
        { postId: 'FP-1', author: '老食客', body: '没换，是老板感冒了。', likes: 2 },
        { postId: 'FP-1', author: '老食客', body: '没换，是老板感冒了。', likes: 2 },
    ],
    heat: [{ postId: 'FP-1', delta: 5 }],
    archive: [],
}, { chatId: 'chat-a' });
assert.equal(second.turn, 2);
assert.equal(second.posts.length, 2);
assert.equal(second.posts.find((post) => post.id === 'FP-1').comments.length, 1, '重复评论必须去重');
assert.equal(second.posts.find((post) => post.id === 'FP-1').heat, 8);

const archived = applyForumUpdate(second, {
    newPosts: [], comments: [], heat: [], archive: ['FP-1'],
}, { chatId: 'chat-a' });
const view = forumView(archived, { chatId: 'chat-a' });
assert.equal(view.active.length, 1);
assert.equal(view.archived.length, 1);

const capacityPosts = [
    ...Array.from({ length: 10 }, (_, index) => ({
        id: `ARCHIVE-${index}`,
        board: '归档',
        title: `归档帖${index}`,
        author: '旧网友',
        body: '已经结束的旧话题。',
        status: 'archived',
        createdTurn: index + 1,
        updatedTurn: 100 + index,
    })),
    ...Array.from({ length: 8 }, (_, index) => ({
        id: `ACTIVE-${index}`,
        board: '当前',
        title: `活跃帖${index}`,
        author: '新网友',
        body: '仍在讨论的当前话题。',
        status: 'active',
        createdTurn: 200 + index,
        updatedTurn: index + 1,
    })),
];
const capacityView = forumView({ chatId: 'chat-capacity', posts: capacityPosts }, {
    chatId: 'chat-capacity',
    maxPosts: 8,
});
assert.equal(capacityView.active.length, 8, 'recent archives must not evict active posts');
assert.equal(capacityView.archived.length, 8, 'archives use an independent bounded capacity');
assert.ok(view.boards.includes('求助区'));

const normalized = normalizeForumState({
    chatId: 'wrong',
    turn: 3,
    posts: [second.posts[0], second.posts[0]],
}, { chatId: 'chat-b' });
assert.equal(normalized.chatId, 'chat-b');
assert.equal(normalized.posts.length, 1, '相同ID和正文不得重复保存');
assert.equal(forumDigest(normalized), forumDigest(structuredClone(normalized)));

assert.match(extractForumUpdate('not json').error, /没有返回/u);

console.log('forum core tests passed');
