import { t as tr } from '../services/LocalizationService.js';
import { lifecycle } from '../services/LifecycleManager.js';
import { TutorialManager } from '../managers/TutorialManager.js';

export class TutorialUI {
  constructor(scene, state) {
    this.panel = document.querySelector('#tutorial');
    this.manager = new TutorialManager(state, scene.orders, scene.player, () => this.render());
    this.skip = () => this.manager.finish();
    this.next = () => this.manager.next();
    this.panel.querySelector('[data-tutorial-skip]').addEventListener('click', this.skip);
    this.panel.querySelector('[data-tutorial-next]').addEventListener('click', this.next);
    this.resize = () => this.render();
    window.addEventListener('resize', this.resize);
    this.observer = new ResizeObserver(() => {
      document.documentElement.style.setProperty('--tutorial-bottom', `${this.panel.getBoundingClientRect().bottom + 8}px`);
    });
    this.observer.observe(this.panel);
    this.render();
    scene.events.once('shutdown', () => {
      this.manager.destroy(); this.observer.disconnect(); this.panel.hidden = true;
      document.body.classList.remove('tutorial-active');
      lifecycle.set('TUTORIAL', false);
      window.removeEventListener('resize', this.resize);
      this.panel.querySelector('[data-tutorial-skip]').removeEventListener('click', this.skip);
      this.panel.querySelector('[data-tutorial-next]').removeEventListener('click', this.next);
    });
  }
  render() {
    const step = this.manager.step;
    this.panel.hidden = !step;
    document.body.classList.toggle('tutorial-active', Boolean(step));
    const blocking = ['welcome', 'reward', 'progression', 'final'].includes(step);
    lifecycle.set('TUTORIAL', blocking);
    document.querySelector('#order-panel').classList.toggle('tutorial-highlight', step === 'order');
    document.querySelector('#accept-order').disabled = step === 'welcome' || step === 'movement';
    if (!step) return;
    this.panel.dataset.step = step;
    this.panel.querySelector('h2').textContent = tr(`tutorial.${step}.title`);
    const compact = document.documentElement.classList.contains('compact');
    const key = ['movement', 'pickup'].includes(step) ? `tutorial.${step}.${compact ? 'mobile' : 'desktop'}` : `tutorial.${step}.text`;
    this.panel.querySelector('p').textContent = tr(key);
    const button = this.panel.querySelector('[data-tutorial-next]');
    button.hidden = !blocking;
    button.textContent = tr(step === 'welcome' ? 'tutorial.start' : step === 'final' ? 'tutorial.finish' : 'continue');
  }
  update() { this.manager.update(); }
}
