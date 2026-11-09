// @ts-nocheck
import { describe, expect, it } from 'vitest';

import { RaycastPicker } from '../src/index.js';
import { createFakeContainer, createFakeHost, mouseEvent } from './fakes.js';

describe('RaycastPicker', () => {
  it('maps client points to NDC and toggles the picked die', () => {
    const host = createFakeHost({
      pickResult: { dieId: 'die-2', distance: 12, point: { x: 1, y: 2, z: 3 } }
    });
    const container = createFakeContainer({
      left: 0,
      top: 0,
      width: 200,
      height: 200
    });
    const picker = new RaycastPicker({ container });
    const picked = [];
    host.events.on('die:pick', (payload) => picked.push(payload));

    picker.attach(host);
    const result = picker.pickClientPoint(150, 50);

    expect(result).toEqual({
      dieId: 'die-2',
      distance: 12,
      point: { x: 1, y: 2, z: 3 }
    });
    const pickCalls = host.calls.filter((call) => call.method === 'pick');
    expect(pickCalls[0].args[0]).toEqual({ x: 0.5, y: 0.5 });
    expect(host.state.selection).toEqual(['die-2']);
    expect(picked).toEqual([{ dieId: 'die-2', point: { x: 1, y: 2, z: 3 } }]);
    picker.detach();
  });

  it('uses an injected picking service with the live dice ids', () => {
    const host = createFakeHost();
    const container = createFakeContainer();
    const seen = [];
    const pickingService = {
      pick(ndc, candidates) {
        seen.push({ ndc, candidates });
        return { dieId: candidates[0], distance: 5, point: { x: 0, y: 0, z: 0 } };
      }
    };
    const picker = new RaycastPicker({ container, pickingService });

    picker.attach(host);
    picker.pickClientPoint(100, 100);

    expect(seen).toHaveLength(1);
    expect(seen[0].candidates).toEqual(['die-1', 'die-2', 'die-3']);
    expect(host.calls.filter((call) => call.method === 'toggleSelection')).toHaveLength(1);
    picker.detach();
  });

  it('does not toggle or emit when nothing is picked', () => {
    const host = createFakeHost({ pickResult: null });
    const container = createFakeContainer();
    const picker = new RaycastPicker({ container });
    const picked = [];
    host.events.on('die:pick', (payload) => picked.push(payload));

    picker.attach(host);
    expect(picker.pickClientPoint(100, 100)).toBeNull();
    expect(host.calls.filter((call) => call.method === 'toggleSelection')).toHaveLength(0);
    expect(picked).toHaveLength(0);
    picker.detach();
  });

  it('picks on a tap but ignores drags', () => {
    const host = createFakeHost({
      pickResult: { dieId: 'die-1', point: { x: 0, y: 0, z: 0 } }
    });
    const container = createFakeContainer();
    const picker = new RaycastPicker({ container });

    picker.attach(host);
    container.dispatch('mousedown', mouseEvent(100, 100));
    container.dispatch('mouseup', mouseEvent(101, 101));
    expect(host.calls.filter((call) => call.method === 'pick')).toHaveLength(1);

    container.dispatch('mousedown', mouseEvent(100, 100));
    container.dispatch('mouseup', mouseEvent(150, 150));
    expect(host.calls.filter((call) => call.method === 'pick')).toHaveLength(1);
    picker.detach();
  });

  it('removes every listener on detach', () => {
    const host = createFakeHost();
    const container = createFakeContainer();
    const picker = new RaycastPicker({ container });

    picker.attach(host);
    expect(container.listenerCount()).toBe(4);
    picker.detach();
    expect(container.listenerCount()).toBe(0);
  });
});
