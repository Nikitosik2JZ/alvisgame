// Local adapter only. Replace internals when adding the platform SDK later.
class PlatformService {
  constructor() {
    this.mode = 'LOCAL';
    this.saveKey = 'courier-empire-save-v1';
  }

  async initialize() {
    return { mode: this.mode };
  }

  async loadSave() {
    try {
      return JSON.parse(localStorage.getItem(this.saveKey));
    } catch {
      return null;
    }
  }

  async save(data) {
    try {
      localStorage.setItem(this.saveKey, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  getLanguage() {
    return navigator.language.split('-')[0];
  }

  async authenticate() {
    return { authenticated: false, player: null };
  }

  async showAd() {
    return { shown: false, rewarded: false, reason: 'LOCAL mode' };
  }

  async getLeaderboard() {
    return [];
  }

  async submitScore() {
    return { submitted: false, reason: 'LOCAL mode' };
  }
}

export const platformService = new PlatformService();
