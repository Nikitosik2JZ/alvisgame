import { PLATFORM_CONFIG as C } from '../config/platformConfig.js';

// Only progression goes through this layer; old flat local saves remain readable.
export function decodeSave(raw) {
  const data = raw?.gameState ?? raw;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const version = data.version ?? raw.saveVersion ?? 1;
  if (raw.saveVersion != null && (!Number.isInteger(raw.saveVersion) || raw.saveVersion < 1 || raw.saveVersion > 12)) return null;
  if (!Number.isInteger(version) || version < 1 || version > 12) return null;
  if (!['money', 'xp', 'completedOrders', 'ownedItems', 'ownedTransports', 'companyUnlocked'].some(k => Object.hasOwn(data, k))) return null;
  for (const key of ['money', 'xp', 'completedOrders']) if (data[key] !== undefined && (!Number.isFinite(data[key]) || data[key] < 0)) return null;
  return { data, revision: Number.isSafeInteger(raw.revision) ? Math.max(0, raw.revision) : 0,
    savedAt: Number.isFinite(raw.savedAt) ? raw.savedAt : 0 };
}

export class SaveManager {
  constructor(state, platform, { clock = () => performance.now(), reload = () => location.reload() } = {}) {
    this.state = state; this.platform = platform; this.clock = clock; this.reload = reload;
    this.revision = 0; this.blockers = new Set(); this.cloudWritable = false;
    this.lastRequest = -Infinity; this.lastMinor = -Infinity; this.dirty = false;
  }
  async initialize() {
    const local = decodeSave(this.platform.readLocal());
    let selected = local, cloud = null;
    if (this.platform.isYandex()) {
      try {
        const raw = await this.platform.loadCloudSave(); cloud = decodeSave(raw);
        // Non-empty but unrecognized saves must never be replaced by defaults.
        this.cloudWritable = raw == null || Boolean(cloud);
        if (cloud) {
          // Only the current account's scoped backup may supersede its cloud.
          // A failed/throttled write must not roll back purchases on reload.
          selected = local && local.revision > cloud.revision && local.savedAt >= cloud.savedAt ? local : cloud;
        }
        else if (raw == null && !selected && !this.accountReload) {
          const marker = this.platform.readLocal(`${this.platform.saveKey}:migrated`);
          if (!marker) {
            selected = decodeSave(this.platform.readLocal(this.platform.saveKey));
            if (selected) this.platform.writeLocal({ migrated: true }, `${this.platform.saveKey}:migrated`);
          }
        }
      } catch {
        this.cloudWritable = false;
        if (!selected && !this.accountReload && !this.platform.readLocal(`${this.platform.saveKey}:migrated`)) selected = decodeSave(this.platform.readLocal(this.platform.saveKey));
      }
    }
    this.state.tasks.date = () => {
      const time = this.platform.getServerTime();
      return time == null ? null : new Date(time).toISOString().slice(0, 10);
    };
    if (selected) { this.revision = selected.revision; this.state.loadSaveData(selected.data); }
    else this.state.tasks.checkDate();
    this.initialized = true;
    this.request();
    this.unsubscribe = this.state.subscribe((snapshot, options) => this.request(options));
    return { source: selected === cloud && cloud ? 'cloud' : selected ? 'local' : 'new', cloudWritable: this.cloudWritable };
  }
  snapshot() {
    return { saveVersion: 12, revision: ++this.revision, savedAt: this.platform.getServerTime(), gameState: this.state.getSaveData() };
  }
  request({ minor = false } = {}) {
    if (!this.initialized || this.blockers.size || this.settling) return;
    if (minor && this.clock() - this.lastMinor < C.minorSaveMs) return;
    if (minor) this.lastMinor = this.clock();
    try { this.settling = true; this.settle?.(); } finally { this.settling = false; }
    this.pending = this.snapshot(); this.dirty = true;
    // Keep the existing flat LOCAL format, plus synchronization metadata.
    this.platform.writeLocal({ ...this.pending.gameState, revision: this.pending.revision, savedAt: this.pending.savedAt });
    this.schedule();
  }
  schedule() {
    if (!this.platform.isYandex() || !this.cloudWritable || this.blockers.size || this.timer || this.inFlight || !this.dirty) return;
    this.timer = setTimeout(() => { this.timer = null; void this.flush(); }, Math.max(C.saveDebounceMs, C.cloudIntervalMs - (this.clock() - this.lastRequest)));
  }
  async flush() {
    if (!this.dirty || this.blockers.size || !this.cloudWritable || this.inFlight) return false;
    if (this.clock() - this.lastRequest < C.cloudIntervalMs) { this.schedule(); return false; }
    clearTimeout(this.timer); this.timer = null;
    const pending = this.pending, epoch = this.platform.accountEpoch;
    this.inFlight = true; this.lastRequest = this.clock(); this.dirty = false;
    const success = await this.platform.saveCloudData(pending);
    this.inFlight = false;
    if (epoch !== this.platform.accountEpoch) return false;
    if (!success) this.dirty = true;
    this.schedule(); return success;
  }
  interrupt() { this.request(); void this.flush(); }
  suspend(reason) { this.blockers.add(reason); clearTimeout(this.timer); this.timer = null; }
  resume(reason) { this.blockers.delete(reason); this.schedule(); }
  switchAccount() {
    this.suspend('ACCOUNT');
    // Prevent a legacy guest backup being imported into the selected empty account.
    try { sessionStorage.setItem('courier-account-reload', '1'); } catch { /* Scoped backups still isolate accounts. */ }
    this.reload();
  }
  destroy() { clearTimeout(this.timer); this.unsubscribe?.(); }
}
