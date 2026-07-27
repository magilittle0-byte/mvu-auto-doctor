import {
    planDualSurfaceDomainAction,
    validateSurfaceActionCatalog,
} from './core.mjs';
import {
    createDualSurfaceViewModel,
} from './diagnostics.mjs';

function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function formatStatus(value) {
    const labels = {
        valid: '可提交',
        unresolved: '待补充',
        rejected: '已拒绝',
        pending: '等待输入',
        'confirmation-required': '等待确认',
        propose: '事务已规划',
        revert: '已安全回退',
        hold: '保持候选',
    };
    return labels[value] ?? String(value || '等待输入');
}

function setText(node, value) {
    if (node) node.textContent = value ?? '';
}

function clear(node) {
    while (node?.firstChild) node.firstChild.remove();
}

function renderList(node, values, emptyText) {
    clear(node);
    if (!values?.length) {
        node.append(element('li', 'mvuad-surface-empty', emptyText));
        return;
    }
    values.forEach((value) => {
        node.append(element('li', '', String(value)));
    });
}

function focusableWithin(root) {
    return [...root.querySelectorAll([
        'button:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        'input:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
    ].join(','))].filter((node) => !node.hidden && node.getClientRects().length > 0);
}

export function setControlledDisclosure(button, content, expanded) {
    const next = expanded === true;
    button.setAttribute('aria-expanded', String(next));
    button.classList.toggle('is-expanded', next);
    content.hidden = !next;
    return next;
}

function disclosureCard(title, className) {
    const section = element('section', `mvuad-surface-card ${className}`);
    const toggle = element('button', 'mvuad-surface-card-toggle', title);
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', 'true');
    const body = element('div', 'mvuad-surface-card-body');
    const bodyId = `mvuad-surface-${className}-${Math.random().toString(36).slice(2)}`;
    body.id = bodyId;
    toggle.setAttribute('aria-controls', bodyId);
    toggle.addEventListener('click', () => {
        setControlledDisclosure(
            toggle,
            body,
            toggle.getAttribute('aria-expanded') !== 'true',
        );
    });
    section.append(toggle, body);
    return { section, toggle, body };
}

function createShell() {
    const panel = element('div', 'mvuad-surface-panel');
    panel.id = 'mvuad-surface-panel';
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'mvuad-surface-title');

    const shell = element('div', 'mvuad-surface-shell');
    const header = element('header', 'mvuad-surface-header');
    const titleGroup = element('div', 'mvuad-surface-title-group');
    const eyebrow = element('span', 'mvuad-surface-eyebrow', 'MVU Auto Doctor 2.0');
    const title = element('h2', '', '导演台');
    title.id = 'mvuad-surface-title';
    const close = element('button', 'mvuad-surface-close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', '关闭导演台');
    titleGroup.append(eyebrow, title);
    header.append(titleGroup, close);

    const visibility = element('div', 'mvuad-surface-visibility');
    visibility.setAttribute('role', 'group');
    visibility.setAttribute('aria-label', '诊断可见度');
    for (const [value, label] of [
        ['immersive', '沉浸'],
        ['audit', '可审计'],
        ['debug', '调试'],
    ]) {
        const button = element('button', '', label);
        button.type = 'button';
        button.dataset.visibility = value;
        button.setAttribute('aria-pressed', String(value === 'audit'));
        visibility.append(button);
    }

    const entry = element('section', 'mvuad-surface-entry');
    const natural = element('div', 'mvuad-surface-entry-pane');
    const naturalLabel = element('label', '', '自然语言');
    naturalLabel.htmlFor = 'mvuad-surface-natural';
    const textarea = element('textarea', 'text_pole');
    textarea.id = 'mvuad-surface-natural';
    textarea.rows = 3;
    textarea.placeholder = '描述要执行的已注册动作；有歧义时会停在待补充。';
    const naturalPreview = element('button', 'menu_button', '预览自然语言动作');
    naturalPreview.type = 'button';
    natural.append(naturalLabel, textarea, naturalPreview);

    const uiEntry = element('div', 'mvuad-surface-entry-pane');
    const uiLabel = element('label', '', '可见控件');
    uiLabel.htmlFor = 'mvuad-surface-action';
    const select = element('select', 'text_pole');
    select.id = 'mvuad-surface-action';
    const uiPreview = element('button', 'menu_button', '预览所选动作');
    uiPreview.type = 'button';
    uiEntry.append(uiLabel, select, uiPreview);
    entry.append(natural, uiEntry);

    const status = element('div', 'mvuad-surface-status', '等待输入');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    const confirmation = element('section', 'mvuad-surface-confirmation');
    confirmation.hidden = true;
    const confirmationText = element('p', '', '此动作将改变领域状态，请核对动作与当前精确分支；确认后才会生成事务预览。');
    const confirm = element('button', 'menu_button mvuad-surface-confirm', '确认当前精确预览');
    confirm.type = 'button';
    confirmation.append(confirmationText, confirm);

    const cards = element('div', 'mvuad-surface-cards');
    const adjudication = disclosureCard('裁定', 'adjudication');
    const transaction = disclosureCard('事务', 'transaction');
    const branch = disclosureCard('分支', 'branch');
    const evidence = disclosureCard('证据', 'evidence');
    const migration = disclosureCard('迁移缺口', 'migration');
    const rollback = disclosureCard('撤销', 'rollback');
    cards.append(
        adjudication.section,
        transaction.section,
        branch.section,
        evidence.section,
        migration.section,
        rollback.section,
    );

    const execute = element('button', 'menu_button mvuad-surface-execute', '提交已验证事务');
    execute.type = 'button';
    execute.disabled = true;
    const undo = element('button', 'menu_button mvuad-surface-undo', '撤销最近一次安全写入');
    undo.type = 'button';
    undo.disabled = true;
    const footer = element('footer', 'mvuad-surface-footer');
    footer.append(execute, undo);

    shell.append(
        header,
        visibility,
        entry,
        status,
        confirmation,
        cards,
        footer,
    );
    panel.append(shell);
    return {
        panel,
        shell,
        close,
        visibility,
        textarea,
        naturalPreview,
        select,
        uiPreview,
        status,
        confirmation,
        confirm,
        execute,
        undo,
        cards: {
            adjudication,
            transaction,
            branch,
            evidence,
            migration,
            rollback,
        },
    };
}

function renderKeyValues(node, entries) {
    clear(node);
    const list = element('dl', 'mvuad-surface-kv');
    entries.forEach(([key, value]) => {
        list.append(
            element('dt', '', key),
            element('dd', '', value === null || value === undefined ? '—' : String(value)),
        );
    });
    node.append(list);
}

function renderIssues(node, issues) {
    const title = element('b', '', '诊断');
    const list = element('ul', 'mvuad-surface-issue-list');
    renderList(
        list,
        issues.map((issue) => `${issue.severity} · ${issue.code} · ${issue.message}`),
        '没有阻断诊断。',
    );
    node.append(title, list);
}

function renderView(ui, view, execution) {
    ui.status.dataset.kind = view.status;
    setText(ui.status, `${formatStatus(view.status)} · ${formatStatus(view.decision)}`);
    ui.confirmation.hidden = !(
        view.confirmation.required
        && !view.confirmation.confirmed
        && view.confirmation.digest
    );
    ui.execute.disabled = !(
        view.status === 'valid'
        && view.transaction.available
        && view.confirmation.confirmed
    );
    ui.undo.disabled = !view.rollback.available;

    renderKeyValues(ui.cards.adjudication.body, [
        ['动作', view.action.label || view.action.commandType || '—'],
        ['入口', view.action.source || '—'],
        ['裁定', formatStatus(view.adjudication.decision)],
        ['边界', formatStatus(view.adjudication.validationStatus)],
        ['阻断项', view.adjudication.blockedCount],
        ['违规项', view.adjudication.violationCount],
    ]);
    renderIssues(ui.cards.adjudication.body, view.issues);

    renderKeyValues(ui.cards.transaction.body, [
        ['可提交', view.transaction.available ? '是' : '否'],
        ['决策', formatStatus(view.transaction.decision)],
        ['类型', view.transaction.kind || '—'],
        ['状态', view.transaction.status || '—'],
        ['精确写入', view.transaction.writeCount ?? 0],
        ['前置条件', view.transaction.preconditionCount ?? 0],
        ...(view.transaction.idempotencyKey
            ? [['幂等键', view.transaction.idempotencyKey]]
            : []),
        ...(execution
            ? [['最近执行', execution.status ?? 'unknown']]
            : []),
    ]);
    if (view.transaction.paths?.length) {
        const paths = element('ul', 'mvuad-surface-paths');
        renderList(paths, view.transaction.paths, '没有写入路径。');
        ui.cards.transaction.body.append(paths);
    }

    renderKeyValues(ui.cards.branch.body, [
        ['状态', view.branch.status],
        ['分支摘要', view.branch.branchDigest],
        ['逻辑楼层', view.branch.logicalIndex],
        ['swipe', view.branch.swipeId],
        ['generation', view.branch.generation],
        ...(view.branch.contentHash ? [['正文指纹', view.branch.contentHash]] : []),
        ...(view.branch.parentHash ? [['父指纹', view.branch.parentHash]] : []),
    ]);

    renderKeyValues(ui.cards.evidence.body, [
        ['证据数量', view.evidence.count],
        ['证据类型', view.evidence.kinds?.join('、') || '—'],
    ]);
    if (view.evidence.references?.length) {
        const evidenceList = element('ul', 'mvuad-surface-evidence-list');
        renderList(
            evidenceList,
            view.evidence.references.map((entry) => (
                `${entry.kind} · ${entry.refDigest}`
            )),
            '没有可显示证据。',
        );
        ui.cards.evidence.body.append(evidenceList);
    }

    clear(ui.cards.migration.body);
    if (!view.migrations.length) {
        ui.cards.migration.body.append(
            element('p', 'mvuad-surface-empty', '没有迁移诊断，或宿主尚未提供迁移投影。'),
        );
    } else {
        const list = element('ul', 'mvuad-surface-migration-list');
        view.migrations.forEach((entry) => {
            list.append(element(
                'li',
                '',
                `${entry.kind} · ${entry.status} · ${entry.canTransact ? '可事务化' : '只读'}`,
            ));
        });
        ui.cards.migration.body.append(list);
    }

    renderKeyValues(ui.cards.rollback.body, [
        ['可撤销', view.rollback.available ? '是' : '否'],
        ['状态', view.rollback.status],
        ['受保护路径', view.rollback.pathCount],
        ['记录摘要', view.rollback.recordDigest],
    ]);
}

function missingSessionResult(message) {
    return {
        ok: false,
        status: 'unresolved',
        value: {
            decision: 'pending',
            candidate: null,
            director: null,
            validatedCommand: null,
            plan: null,
        },
        issues: [{
            code: 'surface.host_session_missing',
            path: '$.host',
            severity: 'unresolved',
            message,
        }],
    };
}

export function installDualSurfaceUI({
    host,
    mount = document.body,
    defaultVisibility = 'audit',
} = {}) {
    if (document.querySelector('#mvuad-surface-panel')) {
        throw new Error('阶段5导演台已经安装。');
    }
    const ui = createShell();
    mount.append(ui.panel);
    let visibility = defaultVisibility;
    let opener = null;
    let session = null;
    let result = missingSessionResult('尚未读取阶段5宿主会话。');
    let pendingSource = null;
    let pendingDigest = '';
    let execution = null;

    function viewOptions() {
        return {
            visibility,
            migrations: session?.migrations ?? [],
            rollback: session?.rollback ?? {},
        };
    }

    function render() {
        const view = createDualSurfaceViewModel(result, viewOptions());
        renderView(ui, view, execution);
        return view;
    }

    function setCatalog(catalog) {
        clear(ui.select);
        const validation = validateSurfaceActionCatalog(catalog);
        if (!validation.value.length) {
            const option = element('option', '', '没有可用动作');
            option.value = '';
            ui.select.append(option);
            ui.select.disabled = true;
            return;
        }
        ui.select.disabled = false;
        validation.value.forEach((entry) => {
            const option = element('option', '', entry.label);
            option.value = entry.id;
            ui.select.append(option);
        });
    }

    async function capture() {
        try {
            session = await host?.captureSession?.();
        } catch {
            session = null;
        }
        if (!session?.catalog || !session?.target || !session?.turnBoundary) {
            result = missingSessionResult(
                '宿主未提供完整动作目录、消息指纹、Turn Boundary 或战役配置；当前保持只读。',
            );
            setCatalog(session?.catalog ?? []);
            render();
            return null;
        }
        setCatalog(session.catalog);
        return session;
    }

    function resolutionInput(source, confirmation) {
        return {
            ...session,
            source,
            ...(confirmation ? { confirmation } : {}),
        };
    }

    async function preview(source, confirmation) {
        if (!await capture()) return result;
        pendingSource = source;
        execution = null;
        result = planDualSurfaceDomainAction(resolutionInput(source, confirmation));
        pendingDigest = result.value?.candidate?.confirmation?.digest ?? '';
        render();
        return result;
    }

    async function confirm() {
        if (!pendingSource || !pendingDigest) return result;
        return preview(pendingSource, {
            confirmed: true,
            digest: pendingDigest,
        });
    }

    async function execute() {
        if (
            result?.status !== 'valid'
            || !result?.value?.plan?.value?.transaction
            || result?.value?.candidate?.confirmation?.confirmed !== true
        ) {
            return {
                ok: false,
                status: 'rejected',
                issues: [{
                    code: 'surface.execute_unconfirmed',
                    severity: 'error',
                    path: '$',
                    message: '只有已确认且通过阶段4规划的事务可以提交。',
                }],
            };
        }
        if (typeof host?.executePlan !== 'function') {
            execution = {
                status: 'unresolved',
                reason: '宿主没有提供 TransactionKernel 执行桥。',
            };
        } else {
            execution = await host.executePlan(result.value.plan);
        }
        render();
        return execution;
    }

    async function undo() {
        if (typeof host?.undo !== 'function') {
            return { ok: false, status: 'unresolved' };
        }
        const undone = await host.undo();
        await capture();
        render();
        return undone;
    }

    async function open(trigger) {
        opener = trigger instanceof HTMLElement ? trigger : document.activeElement;
        ui.panel.hidden = false;
        document.body.classList.add('mvuad-surface-modal-open');
        await capture();
        requestAnimationFrame(() => ui.textarea.focus());
        return render();
    }

    function close() {
        ui.panel.hidden = true;
        document.body.classList.remove('mvuad-surface-modal-open');
        if (opener?.isConnected && typeof opener.focus === 'function') opener.focus();
        opener = null;
    }

    function keydown(event) {
        if (ui.panel.hidden) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            close();
            return;
        }
        if (event.key !== 'Tab') return;
        const focusable = focusableWithin(ui.shell);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }

    ui.close.addEventListener('click', close);
    ui.panel.addEventListener('mousedown', (event) => {
        if (event.target === ui.panel) close();
    });
    ui.panel.addEventListener('keydown', keydown);
    ui.naturalPreview.addEventListener('click', () => preview({
        kind: 'natural-language',
        text: ui.textarea.value,
    }));
    ui.uiPreview.addEventListener('click', () => preview({
        kind: 'ui',
        actionId: ui.select.value,
    }));
    ui.confirm.addEventListener('click', confirm);
    ui.execute.addEventListener('click', execute);
    ui.undo.addEventListener('click', undo);
    ui.visibility.addEventListener('click', (event) => {
        const button = event.target.closest('[data-visibility]');
        if (!button) return;
        visibility = button.dataset.visibility;
        ui.visibility.querySelectorAll('[data-visibility]').forEach((entry) => {
            entry.setAttribute('aria-pressed', String(entry === button));
        });
        render();
    });

    render();
    return Object.freeze({
        open,
        close,
        previewNaturalLanguage: (text, options = {}) => preview({
            kind: 'natural-language',
            text,
            ...(options.actionId ? { actionId: options.actionId } : {}),
            ...(options.semanticBasis
                ? { semanticBasis: options.semanticBasis }
                : {}),
        }),
        previewUiAction: (actionId) => preview({ kind: 'ui', actionId }),
        confirm,
        execute,
        undo,
        refresh: capture,
        getResult: () => result,
        getView: () => createDualSurfaceViewModel(result, viewOptions()),
        getPanel: () => ui.panel,
        destroy() {
            close();
            ui.panel.remove();
        },
    });
}
