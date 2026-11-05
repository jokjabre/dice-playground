/**
 * ResultPresenter
 * Pluggable outcome reporters for dice roll results.
 * Supports:
 * - ResultPresenter (base interface)
 * - BannerResultPresenter (animated result banner with total score)
 * - SilentResultPresenter (events only, no DOM modification)
 * - CustomResultPresenter (user-provided callback formatter)
 */

export class ResultPresenter {
    /**
     * Called when dice have settled and results are available.
     * @param {Array<number>} values - Array of settled face values (e.g. [4, 5, 6]).
     * @param {Object} [metadata={}] - Additional details (e.g. roll duration, count).
     */
    present(values, metadata = {}) { }

    /**
     * Clears or hides presented results.
     */
    clear() { }

    /**
     * Destroys DOM elements or unbinds listeners.
     */
    destroy() {
        this.clear();
    }
}

/**
 * BannerResultPresenter
 * Creates or updates an animated banner displaying individual roll values and total sum.
 */
export class BannerResultPresenter extends ResultPresenter {
    /**
     * @param {Object} [config={}]
     * @param {HTMLElement|string} [config.container=document.body] - Parent container or CSS selector.
     * @param {string} [config.id='dice-result-banner'] - DOM element ID.
     * @param {boolean} [config.autoHide=false] - Auto-hide after duration.
     * @param {number} [config.hideDelay=3000] - Duration in ms before auto-hiding.
     */
    constructor(config = {}) {
        super();
        this.container = typeof config.container === 'string'
            ? document.querySelector(config.container)
            : (config.container || (typeof document !== 'undefined' ? document.body : null));
        this.id = config.id || 'dice-result-banner';
        this.autoHide = config.autoHide ?? false;
        this.hideDelay = config.hideDelay ?? 3000;
        this.hideTimeout = null;
        this.bannerElement = null;
    }

    _getBannerElement() {
        if (this.bannerElement && this.bannerElement.parentNode) {
            return this.bannerElement;
        }
        if (typeof document === 'undefined') return null;

        let el = document.getElementById(this.id);
        if (!el) {
            el = document.createElement('div');
            el.id = this.id;
            el.className = 'dice-banner-container';
            if (this.container) {
                this.container.appendChild(el);
            }
        }
        this.bannerElement = el;
        return el;
    }

    /**
     * Formats the result string (e.g. "3 + 5 = 8" or single "6").
     * @param {Array<number>} values
     * @returns {string} HTML markup
     */
    formatResults(values) {
        if (!values || values.length === 0) return '';
        if (values.length === 1) {
            return `<span class="dice-banner-total">${values[0]}</span>`;
        }

        const sum = values.reduce((acc, curr) => acc + curr, 0);
        const joined = values.sort((a, b) => b - a).join(' + ');
        return `<span class="dice-banner-values">${joined}</span> = <span class="dice-banner-total">${sum}</span>`;
    }

    present(values, metadata = {}) {
        const el = this._getBannerElement();
        if (!el) return;

        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
        }

        el.innerHTML = this.formatResults(values);
        el.classList.add('dice-banner-visible');

        if (this.autoHide) {
            this.hideTimeout = setTimeout(() => {
                this.clear();
            }, this.hideDelay);
        }
    }

    clear() {
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
        }
        if (this.bannerElement) {
            this.bannerElement.classList.remove('dice-banner-visible');
        }
    }

    destroy() {
        this.clear();
        if (this.bannerElement && this.bannerElement.parentNode) {
            this.bannerElement.parentNode.removeChild(this.bannerElement);
        }
        this.bannerElement = null;
    }
}

/**
 * SilentResultPresenter
 * Emits events or invokes listeners only; does not mutate the DOM.
 */
export class SilentResultPresenter extends ResultPresenter {
    /**
     * @param {Object} [config={}]
     * @param {import('../core/EventBus.js').EventBus} [config.eventBus]
     */
    constructor(config = {}) {
        super();
        this.eventBus = config.eventBus || null;
        this.lastResult = null;
    }

    present(values, metadata = {}) {
        this.lastResult = { values, total: values.reduce((a, b) => a + b, 0), metadata };
        if (this.eventBus) {
            this.eventBus.emit('result:present', this.lastResult);
        }
    }

    clear() {
        this.lastResult = null;
    }
}

/**
 * CustomResultPresenter
 * Executes a custom formatting function or presentation logic provided by user.
 */
export class CustomResultPresenter extends ResultPresenter {
    /**
     * @param {Function} presenterFn - Function called with (values, metadata).
     */
    constructor(presenterFn) {
        super();
        this.presenterFn = typeof presenterFn === 'function' ? presenterFn : () => { };
    }

    present(values, metadata = {}) {
        this.presenterFn(values, metadata);
    }
}

