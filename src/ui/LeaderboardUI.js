import { formatNumber } from '../services/LocalizationService.js';
import { t as tr } from '../services/LocalizationService.js';
import { ModalUI } from './ModalUI.js';
import { platformService as platform } from '../services/PlatformService.js';
import { lifecycle } from '../services/LifecycleManager.js';
import { localization as l } from '../services/LocalizationService.js';
import { courierScore } from '../services/LeaderboardManager.js';
import { saves } from '../services/GameRuntime.js';

export class LeaderboardUI extends ModalUI {
  constructor(scene, state, player) {
    super(scene, player, 'rating-dialog', 'open-rating');
    this.state = state; this.content = this.dialog.querySelector('#rating-content'); this.generation = 0;
    this.onOpen = () => void this.render(); this.opener.addEventListener('click', this.onOpen);
    scene.events.once('shutdown', () => { this.generation++; this.opener.removeEventListener('click', this.onOpen); });
  }
  node(tag, text) { const node = document.createElement(tag); node.textContent = text; return node; }
  async render() {
    const generation = ++this.generation;
    this.content.replaceChildren(this.node('h3', `${l.t('score')}: ${formatNumber(courierScore(this.state.values))}`));
    if (!platform.isYandex()) { this.content.append(this.node('p', tr('leaderboard-ui.001'))); return; }
    if (!platform.isAuthorized()) {
      this.content.append(this.node('p', l.t('loginBenefits')));
      const login = this.node('button', l.t('login')); login.id = 'yandex-login';
      login.onclick = () => {
        login.hidden = true;
        const confirm = this.node('button', tr('leaderboard-ui.002')); confirm.id = 'confirm-yandex-login';
        confirm.onclick = async () => {
          confirm.disabled = true; saves.interrupt(); saves.suspend('AUTH'); lifecycle.set('AUTH:LOGIN', true);
          const epoch = platform.accountEpoch;
          const success = await platform.requestAuthorization();
          if (success || epoch !== platform.accountEpoch) { saves.switchAccount(); return; }
          saves.resume('AUTH'); lifecycle.set('AUTH:LOGIN', false);
          confirm.remove(); login.hidden = false; this.content.append(this.node('p', l.t('authCancelled')));
        };
        this.content.append(confirm); confirm.focus();
      };
      this.content.append(login); return;
    }
    const name = platform.getPlayerName(); if (name) this.content.append(this.node('p', name));
    const [own, top] = await Promise.all([platform.getPlayerLeaderboardEntry(), platform.getLeaderboardEntries()]);
    if (generation !== this.generation || !this.dialog.open) return;
    if (own) this.content.append(this.node('p', tr('leaderboard-ui.003', { v0: own.rank, v1: own.score })));
    if (top?.entries?.length) {
      const list = this.node('ol', '');
      for (const entry of top.entries) list.append(this.node('li', `${entry.rank}. ${entry.player?.publicName || tr('leaderboard-ui.004')} — ${entry.score}`));
      this.content.append(list);
    } else this.content.append(this.node('p', l.t('rankingUnavailable')));
  }
}
