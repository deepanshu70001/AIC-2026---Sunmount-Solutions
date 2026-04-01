"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergeNodeSnapshotIntoState = exports.applyDeltaToStockState = exports.serializeCounter = exports.materializeStockCounterState = exports.normalizeNodeId = void 0;
const toNonNegativeInt = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed))
        return 0;
    const whole = Math.trunc(parsed);
    return whole > 0 ? whole : 0;
};
const sanitizeNodeToken = (value) => value
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
const normalizeNodeId = (value) => {
    const sanitized = sanitizeNodeToken(String(value || '').trim());
    return sanitized || 'UNSPECIFIED_NODE';
};
exports.normalizeNodeId = normalizeNodeId;
const parseCounterObject = (raw) => {
    if (!raw)
        return {};
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
            return {};
        const counter = {};
        for (const [rawNodeId, rawValue] of Object.entries(parsed)) {
            const nodeId = (0, exports.normalizeNodeId)(rawNodeId);
            const value = toNonNegativeInt(rawValue);
            if (value > 0) {
                counter[nodeId] = value;
            }
        }
        return counter;
    }
    catch {
        return {};
    }
};
const sumCounter = (counter) => Object.values(counter).reduce((total, value) => total + toNonNegativeInt(value), 0);
const materializeStockCounterState = (rawP, rawN) => {
    const p = parseCounterObject(rawP);
    const n = parseCounterObject(rawN);
    return {
        p,
        n,
        value: sumCounter(p) - sumCounter(n)
    };
};
exports.materializeStockCounterState = materializeStockCounterState;
const serializeCounter = (counter) => JSON.stringify(counter || {});
exports.serializeCounter = serializeCounter;
const applyDeltaToStockState = (state, nodeIdInput, deltaInput) => {
    const delta = Math.trunc(Number(deltaInput || 0));
    if (!Number.isFinite(delta) || delta === 0) {
        return { ...state, changed: false, appliedDelta: 0 };
    }
    const nodeId = (0, exports.normalizeNodeId)(nodeIdInput);
    const p = { ...state.p };
    const n = { ...state.n };
    if (delta > 0) {
        p[nodeId] = toNonNegativeInt(p[nodeId]) + delta;
    }
    else {
        n[nodeId] = toNonNegativeInt(n[nodeId]) + Math.abs(delta);
    }
    const nextState = {
        p,
        n,
        value: sumCounter(p) - sumCounter(n)
    };
    return { ...nextState, changed: true, appliedDelta: delta };
};
exports.applyDeltaToStockState = applyDeltaToStockState;
const mergeNodeSnapshotIntoState = (state, nodeIdInput, snapshotInput) => {
    const nodeId = (0, exports.normalizeNodeId)(nodeIdInput);
    const incomingP = toNonNegativeInt(snapshotInput?.p);
    const incomingN = toNonNegativeInt(snapshotInput?.n);
    const p = { ...state.p };
    const n = { ...state.n };
    const currentP = toNonNegativeInt(p[nodeId]);
    const currentN = toNonNegativeInt(n[nodeId]);
    const nextP = Math.max(currentP, incomingP);
    const nextN = Math.max(currentN, incomingN);
    if (nextP > 0)
        p[nodeId] = nextP;
    if (nextN > 0)
        n[nodeId] = nextN;
    const changed = nextP !== currentP || nextN !== currentN;
    const nextState = {
        p,
        n,
        value: sumCounter(p) - sumCounter(n)
    };
    return {
        ...nextState,
        changed,
        mergedPositive: nextP - currentP,
        mergedNegative: nextN - currentN,
        nodeId
    };
};
exports.mergeNodeSnapshotIntoState = mergeNodeSnapshotIntoState;
