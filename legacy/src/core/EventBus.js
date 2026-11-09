export class EventBus {
    constructor() {
        this.listeners = new Map();
    }

    /**
     * Subscribe to an event.
     * @param {string} event - Name of the event.
     * @param {Function} callback - Callback function.
     * @returns {Function} Unsubscribe function.
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
        return () => this.off(event, callback);
    }

    /**
     * Subscribe to an event once.
     * @param {string} event - Name of the event.
     * @param {Function} callback - Callback function.
     * @returns {Function} Unsubscribe function.
     */
    once(event, callback) {
        const wrapper = (...args) => {
            this.off(event, wrapper);
            callback(...args);
        };
        return this.on(event, wrapper);
    }

    /**
     * Unsubscribe from an event.
     * @param {string} event - Name of the event.
     * @param {Function} callback - Callback function to remove.
     */
    off(event, callback) {
        if (!this.listeners.has(event)) return;
        const set = this.listeners.get(event);
        set.delete(callback);
        if (set.size === 0) {
            this.listeners.delete(event);
        }
    }

    /**
     * Emit an event to all subscribers.
     * @param {string} event - Name of the event.
     * @param {...*} args - Arguments passed to callbacks.
     */
    emit(event, ...args) {
        if (!this.listeners.has(event)) return;
        const callbacks = Array.from(this.listeners.get(event));
        for (const cb of callbacks) {
            try {
                cb(...args);
            } catch (err) {
                console.error(`Error in event listener for "${event}":`, err);
            }
        }
    }

    /**
     * Clear all listeners for a given event, or all listeners if no event provided.
     * @param {string} [event]
     */
    clear(event) {
        if (event) {
            this.listeners.delete(event);
        } else {
            this.listeners.clear();
        }
    }
}

