import { t as tr } from '../services/LocalizationService.js';
export const LEGACY_UPGRADES = [
  { id: 'experience', title: tr('legacy-config.001'), cost: 1, effect: 'xp', bonus: .03, description: tr('legacy-config.002') },
  { id: 'reputation', title: tr('legacy-config.003'), cost: 2, effect: 'reputation', bonus: .05, description: tr('legacy-config.004') },
  { id: 'business', title: tr('legacy-config.005'), cost: 2, effect: 'companyIncome', bonus: .03, description: tr('legacy-config.006') },
  { id: 'tips', title: tr('legacy-config.007'), cost: 3, effect: 'tips', bonus: .05, description: tr('legacy-config.008') },
  { id: 'city', title: tr('legacy-config.009'), cost: 3, effect: 'speed', bonus: .03, description: tr('legacy-config.010') },
];
