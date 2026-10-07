import { ACHIEVEMENTS } from '../data/achievements.js';
import { CAREER_MILESTONES, GLOBAL_GOALS, RECORD_SETTINGS, requirement as r } from '../config/progressionConfig.js';
import { LEGACY_UPGRADES } from '../config/legacyConfig.js';
import { DISTRICTS, DISTRICT_MASTERY } from '../config/districtConfig.js';
import { TRANSPORTS } from '../config/transportConfig.js';
import { COMPANY } from '../config/companyConfig.js';

export function progressValue(s, source) {
  const [kind, id] = source.split(':');
  if (kind === 'transport') return Number(s.ownedTransports.includes(id));
  if (kind === 'district') return Number(s.unlockedDistricts.includes(id));
  if (kind === 'event') return s.eventCounters[id] || 0;
  if (kind === 'career') return Number(s.careerMilestones.includes(id));
  switch (kind) {
    case 'deliveries': return s.completedOrders;
    case 'personalEarnings': return s.totalMoneyEarned;
    case 'companyEarnings': return s.companyLifetimeEarnings;
    case 'level': return s.level;
    case 'reputation': return s.personalRecords.highestReputation;
    case 'company': return Number(s.companyUnlocked);
    case 'companyLevel': return s.companyUnlocked ? s.companyLevel : 0;
    case 'employees': return s.companyRecords.mostEmployees;
    case 'districts': return Object.keys(DISTRICTS).filter(id => s.unlockedDistricts.includes(id)).length;
    case 'maxMastery': return Math.max(0, ...Object.values(s.districtStats).map(d => d.completedOrders));
    case 'minMastery': return Math.min(...Object.keys(DISTRICTS).map(id => s.districtStats[id]?.completedOrders || 0));
    case 'allTransport': return Number(TRANSPORTS.every(t => s.ownedTransports.includes(t.id)));
    case 'publicAchievements': return ACHIEVEMENTS.filter(a => !a.hidden && s.achievements.includes(a.id)).length;
    default: return 0;
  }
}
export const requirementsProgress = (s, definition) => definition.requirements.map(req => ({ ...req,
  current: req.source === 'reputation' ? s.reputation : req.source === 'employees' ? s.employees.length : progressValue(s, req.source) }));
export const completionRatio = rows => rows.length ? rows.reduce((sum, row) => sum + Math.min(1, row.current / row.target), 0) / rows.length : 1;
export const rewardText = reward => [reward.money && `+${reward.money} ₽`, reward.xp && `+${reward.xp} XP`,
  reward.reputation && `+${reward.reputation} реп.`, reward.legacy && `+${reward.legacy} очк. наследия`, reward.title && `Титул: ${reward.title}`].filter(Boolean).join(' · ') || 'Титул';
export const availableTitles = s => [...CAREER_MILESTONES.filter(m => s.careerMilestones.includes(m.id)).map(m => ({ id: `career:${m.id}`, title: m.title })),
  ...ACHIEVEMENTS.filter(a => a.reward.title && s.achievements.includes(a.id)).map(a => ({ id: `achievement:${a.id}`, title: a.reward.title }))];
export const selectedTitle = s => availableTitles(s).find(t => t.id === s.selectedTitle)?.title || null;

// Runs on GameState mutations, never on the render loop. Domain signatures skip
// unchanged definitions (e.g. company ticks cannot rescan delivery achievements).
export class AchievementManager {
  constructor(state) { this.state = state; this.listeners = new Set(); this.signatures = new Map(); }
  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  emit(event) { for (const listener of this.listeners) listener(event); }
  evaluate(silent = false) {
    const s = this.state.values;
    const pr = s.personalRecords, cr = s.companyRecords;
    pr.highestLevel = Math.max(pr.highestLevel, s.level); pr.highestReputation = Math.max(pr.highestReputation, s.reputation);
    cr.mostEmployees = Math.max(cr.mostEmployees, s.employees.length);
    cr.highestEmployeeLevel = Math.max(cr.highestEmployeeLevel, ...s.employees.map(e => e.level), 0);
    cr.bestEmployeeEarnings = Math.max(cr.bestEmployeeEarnings, ...s.employees.map(e => e.totalEarned), 0);
    for (const a of ACHIEVEMENTS) {
      if (s.achievements.includes(a.id)) continue;
      const value = progressValue(s, a.source);
      if (!silent && this.signatures.get(a.id) === value) continue;
      this.signatures.set(a.id, value);
      if (value >= a.target) {
        s.achievements.push(a.id);
        if (!silent) this.emit({ type: 'achievement', definition: a });
      }
    }
    for (const m of CAREER_MILESTONES) {
      if (s.careerMilestones.includes(m.id)) continue;
      if (requirementsProgress(s, m).every(req => req.current >= req.target)) {
        s.careerMilestones.push(m.id);
        if (!silent && m.id !== 'novice') this.emit({ type: 'career', definition: m });
      }
    }
    if (!availableTitles(s).some(t => t.id === s.selectedTitle)) s.selectedTitle = null;
  }
  status(definition, career = false) {
    const s = this.state.values;
    if ((career ? s.claimedCareerRewards : s.claimedAchievementRewards).includes(definition.id)) return 'CLAIMED';
    if ((career ? s.careerMilestones : s.achievements).includes(definition.id)) return 'COMPLETED';
    if (career) return completionRatio(requirementsProgress(s, definition)) > 0 ? 'IN_PROGRESS' : 'LOCKED';
    return progressValue(s, definition.source) > 0 ? 'IN_PROGRESS' : 'LOCKED';
  }
  claim(id, career = false) {
    const definition = (career ? CAREER_MILESTONES : ACHIEVEMENTS).find(d => d.id === id);
    if (!definition || this.status(definition, career) !== 'COMPLETED') return { ok: false, reason: 'Награда недоступна или уже получена' };
    const s = this.state.values, reward = definition.reward;
    // Mark before applying rewards or notifying subscribers; one persisted transaction.
    (career ? s.claimedCareerRewards : s.claimedAchievementRewards).push(id);
    s.money += reward.money || 0; s.xp += reward.xp || 0; s.reputation += reward.reputation || 0;
    s.legacyPoints += reward.legacy || 0; s.legacyPointsEarned += reward.legacy || 0;
    this.state.refresh();
    return { ok: true };
  }
  buyLegacy(id) {
    const u = LEGACY_UPGRADES.find(u => u.id === id), s = this.state.values;
    if (!u) return { ok: false, reason: 'Улучшение не найдено' };
    if (s.legacyUpgrades.includes(id)) return { ok: false, reason: 'Уже изучено' };
    if (s.legacyPoints < u.cost) return { ok: false, reason: 'Не хватает очков наследия' };
    this.state.beforeProgressionPurchase?.();
    s.legacyPoints -= u.cost; s.legacyUpgrades.push(id); this.state.refresh();
    return { ok: true };
  }
  selectTitle(id) {
    if (id !== null && !availableTitles(this.state.values).some(t => t.id === id)) return { ok: false, reason: 'Титул ещё не открыт' };
    this.state.values.selectedTitle = id; this.state.refresh(); return { ok: true };
  }
  delivery({ reward, distance, elapsedSeconds, orderMoney = reward, type }) {
    const s = this.state.values, p = s.personalRecords;
    p.highestDeliveryReward = Math.max(p.highestDeliveryReward, reward);
    p.mostMoneyInOrder = Math.max(p.mostMoneyInOrder, orderMoney);
    if (distance >= RECORD_SETTINGS.minimumRouteMeters && Number.isFinite(elapsedSeconds) && elapsedSeconds > 0)
      p.fastestDeliverySeconds = p.fastestDeliverySeconds === null ? elapsedSeconds : Math.min(p.fastestDeliverySeconds, elapsedSeconds);
    if (s.companyUnlocked && s.equippedTransport === 'WALKING') s.eventCounters.walkingOwner++;
    if (type === 'ELITE') s.eventCounters.eliteDelivery++;
  }
  event({ rarity, bad, positive, disputeWon, friesCaught, friesEscaped, friesHonest }) {
    const s = this.state.values, c = s.eventCounters;
    if (['RARE', 'VERY_RARE'].includes(rarity)) c.rareEvents++;
    if (rarity === 'VERY_RARE' && positive && !bad) c.veryRarePositive++;
    for (const [key, flag] of Object.entries({ disputeWon, friesCaught, friesEscaped, friesHonest })) if (flag) c[key]++;
    s.eventNegativeStreak = bad ? s.eventNegativeStreak + 1 : 0;
    if (s.eventNegativeStreak === 2) c.negativePair++;
    this.state.refresh();
  }
  acknowledgeMagnate() {
    const s = this.state.values;
    if (!s.careerMilestones.includes('magnate') || s.magnateCelebrationSeen) return false;
    s.magnateCelebrationSeen = true; this.state.refresh(); return true;
  }
  suggestedGoal() {
    const s = this.state.values, nextTransport = TRANSPORTS.find(t => !s.ownedTransports.includes(t.id));
    if (nextTransport) return { title: `Купить ${nextTransport.name.toLowerCase()}`, requirements: [r('level', nextTransport.requiredLevel, 'Уровень'), { source: 'wallet', target: nextTransport.purchasePrice, label: 'Деньги' }] };
    const nextDistrict = Object.entries(DISTRICTS).find(([id]) => !s.unlockedDistricts.includes(id));
    if (nextDistrict) {
      const [, d] = nextDistrict;
      return { title: `Открыть ${d.name}`, requirements: [r('level', d.level, 'Уровень'), r('reputation', d.reputation, 'Репутация'),
        r('wallet', d.cost, 'Деньги'), ...(d.requiredOwnedTransports ? [r('motorTransport', 1, 'Мопед или автомобиль')] : [])].filter(req => req.target > 0) };
    }
    if (!s.companyUnlocked) return { title: 'Открыть компанию', requirements: [r('level', COMPANY.unlockLevel, 'Уровень'), r('wallet', COMPANY.unlockPrice, 'Деньги')] };
    const milestone = CAREER_MILESTONES.find(m => !s.careerMilestones.includes(m.id)) || GLOBAL_GOALS.find(g => completionRatio(requirementsProgress(s, g)) < 1);
    if (milestone) return milestone;
    if (progressValue(s, 'minMastery') < DISTRICT_MASTERY.at(-1).min)
      return { title: 'Развивайте мастерство во всех районах', requirements: [r('minMastery', DISTRICT_MASTERY.at(-1).min, 'Доставки в каждом районе')] };
    const achievement = ACHIEVEMENTS.find(a => !a.hidden && !s.achievements.includes(a.id));
    return achievement ? { title: achievement.title, requirements: [r(achievement.source, achievement.target, achievement.description)] }
      : { title: 'Все большие цели достигнуты. Улучшайте рекорды доставки и дохода компании!', requirements: [] };
  }
  suggestedRequirements() {
    const s = this.state.values;
    return this.suggestedGoal().requirements.map(req => ({ ...req, current: req.source === 'wallet' ? s.money
      : req.source === 'motorTransport' ? Number(s.ownedTransports.some(id => ['MOPED', 'CAR'].includes(id)))
      : req.source === 'reputation' ? s.reputation : progressValue(s, req.source) }));
  }
}
