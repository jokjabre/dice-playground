import { createElement } from '@dice/ui';

/**
 * Dice tray rendering for Yamb.
 *
 * Five focusable buttons showing the current values. Activating a die
 * toggles its hold flag (kept across rerolls). Buttons are disabled
 * outside the `selecting` phase. Keyboard users can Tab to a die and
 * press Space/Enter to hold or release it.
 */

/**
 * @param {import('../game/gameState.js').GameState} state
 * @param {(index: number) => void} onToggle
 * @returns {HTMLElement}
 */
export function renderDiceTray(state, onToggle) {
  const values = state.turn.values;
  const kept = state.turn.kept;
  const enabled = state.phase === 'selecting';

  const dice = [];
  for (let index = 0; index < 5; index += 1) {
    const value = values[index];
    const isKept = Boolean(kept[index]);
    const button = /** @type {HTMLButtonElement} */ (
      createElement('button', {
        type: 'button',
        className: isKept ? 'yamb-die yamb-die-kept' : 'yamb-die',
        'data-testid': `tray-die-${index + 1}`,
        'aria-label':
          value === undefined
            ? `Die ${index + 1}, not rolled yet`
            : `Die ${index + 1}, showing ${value}${isKept ? ', held' : ''}`,
        'aria-pressed': isKept ? 'true' : 'false',
        disabled: enabled ? undefined : 'disabled',
        text: value === undefined ? '–' : String(value)
      })
    );
    button.addEventListener('click', () => onToggle(index));
    dice.push(button);
  }

  const label = createElement('span', {
    className: 'yamb-tray-label',
    text:
      state.phase === 'selecting'
        ? 'Activate dice to hold them for the reroll.'
        : state.phase === 'rolling'
          ? 'Rolling…'
          : 'Dice appear here after the first roll.'
  });

  return createElement('div', { className: 'yamb-tray-inner' }, [
    label,
    createElement('div', { className: 'yamb-dice', role: 'group', 'aria-label': 'Dice' }, dice)
  ]);
}
