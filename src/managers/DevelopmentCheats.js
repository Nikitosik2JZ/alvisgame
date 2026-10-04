export function setupDevelopmentCheats(scene, state) {
  const handler = (event) => {
    if (event.repeat) return;
    if (['F4', 'F5', 'F6'].includes(event.code)) {
      event.preventDefault(); scene.deliveryEvents.debug({ F4: 'POSITIVE', F5: 'NEGATIVE', F6: 'CHOICE' }[event.code]); return;
    }
    if (event.code === 'F7') { event.preventDefault(); state.update({ xp: Math.max(450, state.getSnapshot().xp), money: Math.max(3000, state.getSnapshot().money) }); return; }
    const player = state.getSnapshot();
    if (event.code === 'F2') {
      event.preventDefault();
      state.update({ money: player.money + 1000 });
      console.debug('[Development] F2: +1000 ₽');
    } else if (event.code === 'F3') {
      event.preventDefault();
      state.update({ xp: player.xp + 100 });
      console.debug('[Development] F3: +100 XP');
    }
  };
  window.addEventListener('keydown', handler);
  scene.events.once('shutdown', () => window.removeEventListener('keydown', handler));
}
