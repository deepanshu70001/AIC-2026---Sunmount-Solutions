export type NodeCounterMap = Record<string, number>;

export type StockCounterState = {
  p: NodeCounterMap;
  n: NodeCounterMap;
  value: number;
};

type NodeSnapshot = {
  p: number;
  n: number;
};

const toNonNegativeInt = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  const whole = Math.trunc(parsed);
  return whole > 0 ? whole : 0;
};

const sanitizeNodeToken = (value: string) =>
  value
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

export const normalizeNodeId = (value: unknown) => {
  const sanitized = sanitizeNodeToken(String(value || '').trim());
  return sanitized || 'UNSPECIFIED_NODE';
};

const parseCounterObject = (raw: string | null | undefined): NodeCounterMap => {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    const counter: NodeCounterMap = {};
    for (const [rawNodeId, rawValue] of Object.entries(parsed as Record<string, unknown>)) {
      const nodeId = normalizeNodeId(rawNodeId);
      const value = toNonNegativeInt(rawValue);
      if (value > 0) {
        counter[nodeId] = value;
      }
    }
    return counter;
  } catch {
    return {};
  }
};

const sumCounter = (counter: NodeCounterMap) =>
  Object.values(counter).reduce((total, value) => total + toNonNegativeInt(value), 0);

export const materializeStockCounterState = (
  rawP: string | null | undefined,
  rawN: string | null | undefined
): StockCounterState => {
  const p = parseCounterObject(rawP);
  const n = parseCounterObject(rawN);
  return {
    p,
    n,
    value: sumCounter(p) - sumCounter(n)
  };
};

export const serializeCounter = (counter: NodeCounterMap) => JSON.stringify(counter || {});

export const applyDeltaToStockState = (
  state: StockCounterState,
  nodeIdInput: unknown,
  deltaInput: unknown
) => {
  const delta = Math.trunc(Number(deltaInput || 0));
  if (!Number.isFinite(delta) || delta === 0) {
    return { ...state, changed: false, appliedDelta: 0 };
  }

  const nodeId = normalizeNodeId(nodeIdInput);
  const p = { ...state.p };
  const n = { ...state.n };

  if (delta > 0) {
    p[nodeId] = toNonNegativeInt(p[nodeId]) + delta;
  } else {
    n[nodeId] = toNonNegativeInt(n[nodeId]) + Math.abs(delta);
  }

  const nextState: StockCounterState = {
    p,
    n,
    value: sumCounter(p) - sumCounter(n)
  };

  return { ...nextState, changed: true, appliedDelta: delta };
};

export const mergeNodeSnapshotIntoState = (
  state: StockCounterState,
  nodeIdInput: unknown,
  snapshotInput: NodeSnapshot
) => {
  const nodeId = normalizeNodeId(nodeIdInput);
  const incomingP = toNonNegativeInt(snapshotInput?.p);
  const incomingN = toNonNegativeInt(snapshotInput?.n);

  const p = { ...state.p };
  const n = { ...state.n };

  const currentP = toNonNegativeInt(p[nodeId]);
  const currentN = toNonNegativeInt(n[nodeId]);
  const nextP = Math.max(currentP, incomingP);
  const nextN = Math.max(currentN, incomingN);

  if (nextP > 0) p[nodeId] = nextP;
  if (nextN > 0) n[nodeId] = nextN;

  const changed = nextP !== currentP || nextN !== currentN;
  const nextState: StockCounterState = {
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
