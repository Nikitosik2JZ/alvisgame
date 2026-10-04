const initialState = { money: 0, level: 1, xp: 0, reputation: 0 };

// One owner for progression values. Scenes and the HUD share this instance.
class GameState {
  constructor() {
    this.values = { ...initialState };
    this.listeners = new Set();
  }

  getSnapshot() {
    return { ...this.values };
  }

  update(changes) {
    for (const key of Object.keys(initialState)) {
      if (Number.isFinite(changes[key])) {
        this.values[key] = Math.max(key === 'level' ? 1 : 0, Math.floor(changes[key]));
      }
    }
    for (const listener of this.listeners) listener(this.getSnapshot());
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }
}

export const gameState = new GameState();
