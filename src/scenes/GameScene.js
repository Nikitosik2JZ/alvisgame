import Phaser from 'phaser';
import { Courier } from '../entities/Courier.js';
import { createCity, WORLD } from '../world/createCity.js';
import { gameState } from '../state/GameState.js';
import { createDeliveryLocations, districtDeliveryLocations } from '../world/deliveryLocations.js';
import { DISTRICT_TRANSITION_MS, DISTRICTS } from '../config/districtConfig.js';
import { OrderManager } from '../managers/OrderManager.js';
import { OrderUI } from '../ui/OrderUI.js';
import { ObjectiveMarker } from '../ui/ObjectiveMarker.js';
import { ShopManager } from '../managers/ShopManager.js';
import { ShopUI } from '../ui/ShopUI.js';
import { PlayerProfileUI } from '../ui/PlayerProfileUI.js';
import { setupDevelopmentCheats } from '../managers/DevelopmentCheats.js';
import { EventManager } from '../managers/EventManager.js';
import { EventUI } from '../ui/EventUI.js';
import { DistrictUI } from '../ui/DistrictUI.js';
import { GarageUI } from '../ui/GarageUI.js';
import { HUDUI } from '../ui/HUDUI.js';
import { EventHistoryUI } from '../ui/EventHistoryUI.js';
import { CompanyUI } from '../ui/CompanyUI.js';
import { CompanyEventUI } from '../ui/CompanyEventUI.js';
import { ProgressUI } from '../ui/ProgressUI.js';
import { TasksUI } from '../ui/TasksUI.js';
import { LeaderboardUI } from '../ui/LeaderboardUI.js';
import { lifecycle } from '../services/LifecycleManager.js';
import { finishLoading } from '../services/GameRuntime.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    this.districtTransition = false;
    this.physics.world.setBounds(0, 0, WORLD.width, WORLD.height);
    this.buildings = createCity(this);
    this.player = new Courier(this, WORLD.spawn.x, WORLD.spawn.y);
    lifecycle.bindScene(this);
    this.hudUI = new HUDUI(this, this.player);
    this.physics.add.collider(this.player, this.buildings);
    this.cameras.main.setBounds(0, 0, WORLD.width, WORLD.height);
    this.cameras.main.startFollow(this.player, true);
    const locations = districtDeliveryLocations(gameState.getSnapshot().selectedDistrict);
    const { restaurants, customers } = locations;
    createDeliveryLocations(this, locations);
    this.orders = new OrderManager({ restaurants, customers, state: gameState, now: lifecycle.now, debug: import.meta.env.DEV });
    this.events.once('shutdown', () => this.orders.destroy());
    if (this.deliveryEvents) {
      this.deliveryEvents.orders = this.orders; this.orders.events = this.deliveryEvents; this.deliveryEvents.pending = null;
    } else this.deliveryEvents = new EventManager(gameState, this.orders, Math.random, lifecycle.now);
    this.eventUI = new EventUI(this, this.player, this.deliveryEvents);
    this.orderUI = new OrderUI(this, this.orders, gameState, this.player);
    this.shop = new ShopManager(gameState);
    this.shopUI = new ShopUI(this, this.shop, gameState, this.player);
    this.garageUI = new GarageUI(this, gameState, this.player);
    this.profileUI = new PlayerProfileUI(this, gameState, this.player);
    this.eventHistoryUI = new EventHistoryUI(this, this.player, this.deliveryEvents);
    this.company = this.game.company;
    this.companyUI = new CompanyUI(this, this.company, gameState, this.player);
    this.companyEventUI = new CompanyEventUI(this, this.player, this.company.events);
    this.districtUI = new DistrictUI(this, gameState, this.player, this.orders, () => this.transitionDistrict());
    this.progressUI = new ProgressUI(this, gameState, this.player);
    this.tasksUI = new TasksUI(this, gameState, this.player);
    this.leaderboardUI = new LeaderboardUI(this, gameState, this.player);
    if (import.meta.env.DEV) setupDevelopmentCheats(this, gameState);
    this.objectiveMarker = new ObjectiveMarker(this, this.orders);
    this.orders.generate();
    lifecycle.set('TRANSITION', false);
    this.cameras.main.fadeIn(DISTRICT_TRANSITION_MS);
    finishLoading(this.game);
  }

  transitionDistrict() {
    this.districtTransition = true;
    lifecycle.set('TRANSITION', true);
    this.deliveryEvents.modifiers.items.clear(); this.deliveryEvents.pending = null;
    gameState.nextCloseOrder = false;
    const notice = document.createElement('div'); notice.id = 'district-transition'; notice.setAttribute('role', 'status');
    notice.textContent = `${DISTRICTS[gameState.values.selectedDistrict].name.toUpperCase()}\nЗагрузка района…`;
    document.body.append(notice);
    this.events.once('shutdown', () => notice.remove());
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.restart());
    this.cameras.main.fadeOut(DISTRICT_TRANSITION_MS);
  }

  update(time) {
    if (this.districtTransition || lifecycle.paused) return;
    this.player.speedMultiplier = this.deliveryEvents.modifiers.speed(gameState.getSnapshot().transport);
    this.player.update();
    this.orders.update();
    this.orderUI.update();
    this.objectiveMarker.update(time);
    this.garageUI.update();
    this.companyUI.update();
    this.company.events.update();
  }
}
