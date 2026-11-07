// @ts-nocheck
import { describe, expect, it } from 'vitest';

import { ProgrammaticInput } from '../src/index.js';
import { createFakeHost } from './fakes.js';

describe('ProgrammaticInput', () => {
  it('records roll, selection, and gravity calls on the host', async () => {
    const host = createFakeHost();
    const input = new ProgrammaticInput();
    input.attach(host);

    await input.throw([{ pos: { x: 0, y: 0, z: 200 } }]);
    input.setGravity(0, 0, -1000);
    input.setSelection(['die-1']);
    input.toggleSelection('die-2');
    input.applyImpulse(['die-1'], { x: 1, y: 2, z: 3 });

    const methods = host.calls.map((call) => call.method);
    expect(methods).toContain('roll');
    expect(methods).toContain('setGravity');
    expect(methods).toContain('setSelection');
    expect(methods).toContain('toggleSelection');
    expect(methods).toContain('applyImpulse');
    expect(input.getSelection()).toEqual(['die-1', 'die-2']);

    input.detach();
    expect(() => input.getSelection()).toThrow(/not attached/);
  });
});
