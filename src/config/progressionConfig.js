import { t as tr } from '../services/LocalizationService.js';
import { DISTRICTS, DISTRICT_MASTERY } from './districtConfig.js';

export const RECORD_SETTINGS = { minimumRouteMeters: 200 };
export const requirement = (source, target, label) => ({ source, target, label });
const r = requirement;
const stage = (id, title, requirements, reward = {}) => ({ id, title, requirements, reward });
export const CAREER_MILESTONES = [
  stage('novice', tr('company-config.021'), []),
  stage('walker', tr('progression-config.001'), [r('deliveries', 5, tr('progression-config.002'))], { money: 150, xp: 20 }),
  stage('cyclist', tr('progression-config.003'), [r('transport:BICYCLE', 1, tr('company-config.018')), r('deliveries', 15, tr('progression-config.002'))], { money: 500, xp: 40 }),
  stage('pro', tr('progression-config.004'), [r('level', 6, tr('progression-config.005')), r('reputation', 25, tr('progression-config.006'))], { money: 600, xp: 60 }),
  stage('driver', tr('progression-config.007'), [r('transport:CAR', 1, tr('company-config.020'))], { money: 800, xp: 80 }),
  stage('entrepreneur', tr('company-config.011'), [r('company', 1, tr('progression-config.008'))], { money: 1500, legacy: 1 }),
  stage('owner', tr('company-config.013'), [r('companyLevel', 2, tr('progression-config.009')), r('employees', 4, tr('progression-config.010'))], { money: 1500, xp: 100 }),
  stage('boss', tr('company-config.015'), [r('companyLevel', 4, tr('progression-config.009')), r('companyEarnings', 250000, tr('progression-config.011'))], { money: 2000, legacy: 2 }),
  stage('king', tr('progression-config.012'), [r('districts', Object.keys(DISTRICTS).length, tr('progression-config.013')), r('maxMastery', DISTRICT_MASTERY.at(-1).min, tr('progression-config.014'))], { legacy: 3 }),
  stage('magnate', tr('progression-config.015'), [r('level', 20, tr('progression-config.005')), r('transport:CAR', 1, tr('company-config.020')),
    r('districts', Object.keys(DISTRICTS).length, tr('progression-config.013')), r('reputation', 100, tr('progression-config.006')), r('companyLevel', 4, tr('progression-config.009')),
    r('employees', 8, tr('progression-config.010')), r('personalEarnings', 500000, tr('progression-config.016')), r('companyEarnings', 1000000, tr('progression-config.011')),
    r('deliveries', 100, tr('progression-config.002')), r('publicAchievements', 15, tr('progression-config.017'))], { legacy: 5 }),
];
export const GLOBAL_GOALS = [
  stage('car', tr('progression-config.018'), [r('transport:CAR', 1, tr('company-config.020'))]),
  stage('business', tr('progression-config.019'), [r('company', 1, tr('progression-config.020'))]),
  stage('team', tr('progression-config.021'), [r('employees', 5, tr('progression-config.010'))]),
  stage('city', tr('progression-config.022'), [r('districts', Object.keys(DISTRICTS).length, tr('progression-config.013'))]),
  stage('hundred', tr('progression-config.023'), [r('deliveries', 100, tr('progression-config.002'))]),
  stage('personal', tr('progression-config.024'), [r('personalEarnings', 500000, tr('progression-config.025'))]),
  stage('empire', tr('progression-config.026'), [r('companyEarnings', 1000000, tr('progression-config.027'))]),
  stage('magnate-goal', tr('progression-config.028'), [r('career:magnate', 1, tr('progression-config.029'))]),
];
