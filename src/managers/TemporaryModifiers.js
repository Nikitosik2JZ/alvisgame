export class TemporaryModifiers {
  constructor(now = () => performance.now()) { this.now = now; this.items = new Map(); }
  add(id, value, duration, transport = null) { this.items.set(id, { id, effect: 'speed', value, transport, expires: this.now() + duration * 1000 }); }
  speed(transport) {
    let result = 1;
    for (const [id, item] of this.items) {
      if (item.expires <= this.now()) this.items.delete(id);
      else if (!item.transport || item.transport === transport) result *= item.value;
    }
    return result;
  }
}
