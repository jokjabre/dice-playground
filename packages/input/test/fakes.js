// @ts-nocheck
/**
 * In-memory fakes for input tests. The fake container records every listener
 * so detach tests can prove removal; the fake host records every host call.
 */
import { EventBus } from '@dice/core';

/**
 * @param {Object} [overrides]
 * @returns {any}
 */
export function createFakeHost(overrides = {}) {
  const calls = [];
  const events = new EventBus();
  const state = {
    diceIds: overrides.diceIds ?? ['die-1', 'die-2', 'die-3'],
    selection: overrides.selection ? [...overrides.selection] : [],
    metrics: overrides.metrics ?? {
      containerWidth: 1000,
      containerHeight: 600,
      sceneWidth: 1000,
      sceneHeight: 600,
      scale: 50,
      aspect: 1,
      wallHeight: 1000,
      pixelRatio: 1
    },
    spawnProfile: overrides.spawnProfile ?? { mode: 'box', radius: 700 },
    pickResult: overrides.pickResult ?? null,
    gravity: { x: 0, y: 0, z: -2940 }
  };

  const host = {
    calls,
    events,
    state,
    roll(request) {
      calls.push({ method: 'roll', args: [request] });
      return Promise.resolve(request);
    },
    setGravity(x, y, z) {
      state.gravity = { x, y, z };
      calls.push({ method: 'setGravity', args: [x, y, z] });
    },
    applyImpulse(ids, impulse, worldPoint) {
      calls.push({ method: 'applyImpulse', args: [ids, impulse, worldPoint] });
    },
    getDiceIds() {
      calls.push({ method: 'getDiceIds', args: [] });
      return [...state.diceIds];
    },
    getSelection() {
      calls.push({ method: 'getSelection', args: [] });
      return [...state.selection];
    },
    setSelection(ids) {
      state.selection = [...ids];
      calls.push({ method: 'setSelection', args: [ids] });
    },
    toggleSelection(id) {
      const index = state.selection.indexOf(id);
      if (index >= 0) state.selection.splice(index, 1);
      else state.selection.push(id);
      calls.push({ method: 'toggleSelection', args: [id] });
    },
    pick(ndc) {
      calls.push({ method: 'pick', args: [ndc] });
      if (typeof state.pickResult === 'function') return state.pickResult(ndc);
      return state.pickResult;
    },
    getMetrics() {
      calls.push({ method: 'getMetrics', args: [] });
      return { ...state.metrics };
    },
    getSpawnProfile() {
      calls.push({ method: 'getSpawnProfile', args: [] });
      return { ...state.spawnProfile };
    }
  };

  return host;
}

/**
 * Minimal DOM container that records listeners and dispatches synthetic
 * mouse/touch events.
 *
 * @param {{ left?: number, top?: number, width?: number, height?: number }} [rect]
 * @returns {any}
 */
export function createFakeContainer(rect = {}) {
  const listeners = new Map();
  const container = {
    listeners,
    _rect: {
      left: rect.left ?? 0,
      top: rect.top ?? 0,
      width: rect.width ?? 200,
      height: rect.height ?? 200
    },
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(handler);
    },
    removeEventListener(type, handler) {
      const handlers = listeners.get(type);
      if (!handlers) return;
      handlers.delete(handler);
      if (handlers.size === 0) listeners.delete(type);
    },
    listenerCount(type) {
      if (type) return listeners.get(type)?.size ?? 0;
      let total = 0;
      for (const handlers of listeners.values()) total += handlers.size;
      return total;
    },
    getBoundingClientRect() {
      return { ...container._rect };
    },
    dispatch(type, event) {
      const handlers = listeners.get(type);
      if (!handlers) return;
      for (const handler of [...handlers]) handler(event);
    }
  };
  return container;
}

/**
 * Mouse-event shaped object.
 *
 * @param {number} x
 * @param {number} y
 * @returns {any}
 */
export function mouseEvent(x, y) {
  return { clientX: x, clientY: y };
}

/**
 * Fake window target for motion sensors.
 *
 * @param {Object} [options]
 * @returns {any}
 */
export function createFakeTarget(options = {}) {
  const listeners = new Map();
  const target = {
    listeners,
    isSecureContext: options.isSecureContext ?? true,
    added: [],
    removed: [],
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(handler);
      target.added.push(type);
    },
    removeEventListener(type, handler) {
      const handlers = listeners.get(type);
      if (!handlers) return;
      handlers.delete(handler);
      if (handlers.size === 0) listeners.delete(type);
      target.removed.push(type);
    },
    listenerCount(type) {
      if (type) return listeners.get(type)?.size ?? 0;
      let total = 0;
      for (const handlers of listeners.values()) total += handlers.size;
      return total;
    },
    dispatch(type, event) {
      const handlers = listeners.get(type);
      if (!handlers) return;
      for (const handler of [...handlers]) handler(event);
    }
  };
  return target;
}
