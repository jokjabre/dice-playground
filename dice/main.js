"use strict";
import { DiceBox } from './dice.js';
import { $t } from '../teal.js';
import { scene } from './objects/scene.js';
import { options } from '../src/config/options.js';
import { BannerResultPresenter } from '../src/presentation/ResultPresenter.js';
import { ContinuousMotionStrategy, StandardRollStrategy } from '../src/core/GameLoop.js';
import { world } from './objects/world.js';

export function dice_initialize(container) {

    var canvas = $t.id('canvas');
    canvas.style.width = window.innerWidth - 1 + 'px';
    canvas.style.height = window.innerHeight - 1 + 'px';
    var set = $t.id('set');

    if (set) {
        $t.bind(set, 'focus', function(ev) { $t.set(container, { class: '' }); });
        $t.bind(set, 'blur', function(ev) { $t.set(container, { class: 'noselect' }); });
    }

    var clearBtn = $t.id('clear');
    if (clearBtn) {
        $t.bind(clearBtn, ['mouseup', 'touchend'], function(ev) {
            ev.stopPropagation();
            if (set) set.value = '0';
        });
    }

    var params = $t.get_url_params();

    if (params.chromakey) {
        options.colors.desk = 0x00ff00;
        const cp = $t.id('control_panel');
        if (cp) cp.style.display = 'none';
    }
    if (params.shadows == 0) {
        $t.dice.use_shadows = false;
    }
    if (params.color == 'white') {
        options.colors.dice_body = '#808080';
        options.colors.dice_label = '#202020';
    }

    var box = new DiceBox(canvas, { w: 500, h: 300 });
    var presenter = new BannerResultPresenter({ container: document.body, autoHide: true, hideDelay: 4000 });

    $t.bind(window, 'resize', function() {
        canvas.style.width = window.innerWidth - 1 + 'px';
        canvas.style.height = window.innerHeight - 1 + 'px';
        box.reinit(canvas, { w: 500, h: 300 });
    });

    // Custom predetermined target values holder
    let customTargetValues = null;

    function before_roll(vectors, callback) {
        callback(customTargetValues);
    }

    function after_roll(result) {
        if (params.chromakey || params.noresult) return;
        if (presenter) {
            presenter.present(result);
        }
    }

    box.bind_mouse(container, before_roll, after_roll);
    $t.roll = function(targetValues = null) {
        customTargetValues = targetValues;
        box.start_throw(before_roll, after_roll);
    };

    $t.bind(container, ['mouseup', 'touchend'], function(ev) {
        ev.stopPropagation();
        var name = box.search_dice_by_mouse(ev);
        if (name != undefined) {
            // Die tapped
        }
    });

    // Setup interactive Multi-Mode UI controls
    setupDemoControls(box, presenter);

    // Initial roll
    $t.roll();

    return {
        box,
        presenter,
        options,
        roll: $t.roll
    };
}

/**
 * Attaches the multi-mode toolbar and controls for Task 8 demo.
 */
function setupDemoControls(box, presenter) {
    const enclosureSelect = $t.id('enclosure-select');
    const modeSelect = $t.id('mode-select');
    const predeterminedControls = $t.id('predetermined-controls');
    const predeterminedInputs = $t.id('predetermined-inputs');
    const btnPredeterminedRoll = $t.id('btn-predetermined-roll');
    const btnRoll = $t.id('btn-roll');
    const btnClear = $t.id('btn-clear');
    const motionControls = $t.id('motion-controls');
    const btnMotion = $t.id('btn-motion');
    const motionStatus = $t.id('motion-status');
    const toolbar = $t.id('demo-toolbar');
    const panelToggle = $t.id('engine-panel-toggle');
    const btnHidePanel = $t.id('btn-hide-panel');

    if (!modeSelect) return;

    // Engine options panel starts hidden and is opened by the "+" button.
    function setPanelVisible(visible) {
        if (toolbar) toolbar.hidden = !visible;
        if (panelToggle) {
            panelToggle.hidden = visible;
            panelToggle.setAttribute('aria-expanded', String(visible));
        }
    }

    if (panelToggle) {
        panelToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            setPanelVisible(true);
        });
    }

    if (btnHidePanel) {
        btnHidePanel.addEventListener('click', (e) => {
            e.stopPropagation();
            setPanelVisible(false);
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && toolbar && !toolbar.hidden) {
            setPanelVisible(false);
        }
    });

    setPanelVisible(false);

    function setMotionStatus(text) {
        if (motionStatus) motionStatus.textContent = text;
    }

    function enableMotion() {
        if (!box.motionController) {
            setMotionStatus('Motion controller unavailable');
            return Promise.resolve(false);
        }
        return box.motionController.enable()
            .then((granted) => {
                if (!granted) {
                    setMotionStatus(box.motionController.statusMessage || 'Motion sensors unavailable');
                }
                return granted;
            })
            .catch((err) => {
                console.warn('Unable to enable motion sensors:', err);
                setMotionStatus('Motion sensor error');
                return false;
            });
    }

    if (box.eventBus && typeof box.eventBus.on === 'function') {
        box.eventBus.on('motion:status', ({ message }) => setMotionStatus(message));
    }

    if (btnMotion) {
        btnMotion.addEventListener('click', (e) => {
            e.stopPropagation();
            enableMotion();
        });
    }

    function updateModeUI(mode) {
        if (predeterminedControls) predeterminedControls.style.display = (mode === 'predetermined') ? 'flex' : 'none';
        if (motionControls) motionControls.style.display = (mode === 'continuous') ? 'flex' : 'none';

        if (mode === 'continuous') {
            options.continuous_rolling = true;
            if (box.motionController) {
                enableMotion();
            }
            // Trigger roll to populate field if empty
            if (box.dices.length === 0) {
                $t.roll();
            } else {
                box.gameLoop.start(new ContinuousMotionStrategy());
            }
        } else {
            options.continuous_rolling = false;
            if (box.motionController) {
                box.motionController.disable();
            }
            setMotionStatus('Motion sensors off');
        }
    }

    if (enclosureSelect) {
        enclosureSelect.addEventListener('change', (e) => {
            e.stopPropagation();
            const switched = world.setEnclosure(e.target.value);
            if (switched) {
                box.clear();
                if (presenter) presenter.clear();
                $t.roll();
            } else {
                console.warn('Unknown enclosure type:', e.target.value);
            }
        });
    }

    modeSelect.addEventListener('change', (e) => {
        updateModeUI(e.target.value);
    });

    if (btnRoll) {
        btnRoll.addEventListener('click', (e) => {
            e.stopPropagation();
            $t.roll();
        });
    }

    if (btnClear) {
        btnClear.addEventListener('click', (e) => {
            e.stopPropagation();
            box.clear();
            if (presenter) presenter.clear();
        });
    }

    if (btnPredeterminedRoll) {
        btnPredeterminedRoll.addEventListener('click', (e) => {
            e.stopPropagation();
            const inputVal = predeterminedInputs ? predeterminedInputs.value.trim() : '6,6,6';
            const parsed = inputVal.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n >= 1 && n <= 6);
            const targetValues = parsed.length > 0 ? parsed : [6, 6, 6];
            options.diceCount = targetValues.length;
            $t.roll(targetValues);
        });
    }
}
