import { ModalUI } from './ModalUI.js';

export class EventHistoryUI extends ModalUI {
  constructor(scene, player, events) {
    super(scene, player, 'event-history-dialog', 'open-events');
    this.render = () => {
      const history = this.dialog.querySelector('#event-history');
      history.replaceChildren();
      if (!events.history.length) history.textContent = 'Пока без приключений. Подозрительно спокойно.';
      for (const event of events.history) {
        const row = document.createElement('p');
        row.textContent = `${event.bad ? '−' : '+'} ${event.title}: ${event.text}`;
        history.append(row);
      }
    };
    this.opener.addEventListener('click', this.render);
    scene.events.once('shutdown', () => this.opener.removeEventListener('click', this.render));
  }
}
