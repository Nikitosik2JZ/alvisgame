import { levelForXP } from '../config/gameBalance.js';
const initialState = { money: 0, level: 1, xp: 0, reputation: 0 };

// One owner for progression values. Scenes and the HUD share this instance.
export class GameState {
  constructor() {
    this.values = { ...initialState };
    this.listeners = new Set();
  }

  getSnapshot() {
    return { ...this.values };
  }

  update(changes) {
    for (const key of ['money', 'xp', 'reputation']) {
      if (Number.isFinite(changes[key])) {
        this.values[key] = key === 'reputation' ? Math.floor(changes[key]) : Math.max(0, Math.floor(changes[key]));
      }
    }
    this.values.level = levelForXP(this.values.xp);
    for (const listener of this.listeners) listener(this.getSnapshot());
  }

  addRewards({ reward, xpReward, reputationReward }) {
    this.update({ money: this.values.money + reward, xp: this.values.xp + xpReward, reputation: this.values.reputation + reputationReward });
  }

  getSaveData() {
    return this.getSnapshot();
  }

  loadSaveData(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
    this.values = { ...initialState };
    this.update(data); // Level is derived from total XP; inconsistent saves are repaired.
    return true;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }
}

export const gameState = new GameState();
