import { lifecycle } from '../services/LifecycleManager.js';
export class CompanyEventUI {
  constructor(scene, player, manager) {
    const dialog = document.createElement('dialog'); this.dialog = dialog;
    dialog.id = 'company-event-dialog'; dialog.className = 'progression-dialog event-dialog';
    dialog.setAttribute('aria-labelledby', 'company-event-title');
    dialog.innerHTML = '<div class="modal-header"><h2 id="company-event-title"></h2><span>КОМПАНИЯ</span></div><div class="modal-content"><p id="company-event-description"></p><p id="company-event-effects" role="status" aria-live="polite"></p><div id="company-event-buttons"></div><p class="modal-note">Событие компании. Доставка приостановлена. Штрафы списываются только из накоплений компании.</p></div>';
    document.body.append(dialog); const buttons = dialog.querySelector('#company-event-buttons');
    const close = () => {
      if (!manager.active?.resolved) return;
      dialog.close(); manager.finish(); lifecycle.set('MENU:COMPANY_EVENT', false);
      document.querySelector('#open-company').focus();
    };
    const button = (label, action) => { const b = document.createElement('button'); b.textContent = label; b.onclick = action; buttons.append(b); return b; };
    manager.isBlocked = () => Boolean(document.querySelector('dialog[open]')) || Boolean(scene.deliveryEvents.active);
    manager.onShow = event => {
      lifecycle.set('MENU:COMPANY_EVENT', true);
      dialog.querySelector('#company-event-title').textContent = event.title;
      const employee = manager.state.values.employees.find(e => e.id === manager.active.employeeId);
      dialog.querySelector('#company-event-description').textContent = `${employee?.name || 'Компания'} · ${event.description}`;
      const effects = dialog.querySelector('#company-event-effects'); effects.textContent = ''; buttons.replaceChildren();
      const resolve = index => {
        const result = manager.resolve(index); effects.textContent = result.ok ? result.message : result.reason;
        if (result.ok) { buttons.replaceChildren(); button('ПОНЯТНО', close); }
      };
      if (event.choices) event.choices.forEach((choice, i) => button(`${choice.label}\n${choice.consequence}`, () => resolve(i)));
      else resolve(0);
      dialog.showModal(); buttons.firstElementChild.focus();
    };
    dialog.addEventListener('cancel', e => { e.preventDefault(); close(); });
    scene.events.once('shutdown', () => {
      if (dialog.open) { dialog.close(); manager.finish(); }
      // An unresolved choice goes back into the queue after a scene restart.
      if (manager.active && !manager.active.resolved) { manager.pending = manager.active; manager.active = null; }
      dialog.remove(); manager.onShow = null; manager.isBlocked = null; lifecycle.set('MENU:COMPANY_EVENT', false);
    });
  }
}
