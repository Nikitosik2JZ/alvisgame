import Phaser from 'phaser';
import { Courier } from '../entities/Courier.js';
import { createCity, WORLD } from '../world/createCity.js';
import { gameState } from '../state/GameState.js';
import { createDeliveryLocations, restaurants, customers } from '../world/deliveryLocations.js';
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

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    this.physics.world.setBounds(0, 0, WORLD.width, WORLD.height);
    this.buildings = createCity(this);
    this.player = new Courier(this, WORLD.spawn.x, WORLD.spawn.y);
    this.physics.add.collider(this.player, this.buildings);
    this.cameras.main.setBounds(0, 0, WORLD.width, WORLD.height);
    this.cameras.main.startFollow(this.player, true);
    createDeliveryLocations(this);
    this.orders = new OrderManager({ restaurants, customers, state: gameState, debug: import.meta.env.DEV });
    if (this.deliveryEvents) {
      this.deliveryEvents.orders = this.orders; this.orders.events = this.deliveryEvents; this.deliveryEvents.pending = null;
    } else this.deliveryEvents = new EventManager(gameState, this.orders);
    this.eventUI = new EventUI(this, this.player, this.deliveryEvents);
    this.orderUI = new OrderUI(this, this.orders, gameState, this.player);
    this.shop = new ShopManager(gameState);
    this.shopUI = new ShopUI(this, this.shop, gameState, this.player);
    this.profileUI = new PlayerProfileUI(this, gameState, this.player, this.deliveryEvents);
    this.districtUI = new DistrictUI(this, gameState, this.player, this.orders, () => this.scene.restart());
    if (import.meta.env.DEV) setupDevelopmentCheats(this, gameState);
    this.objectiveMarker = new ObjectiveMarker(this, this.orders);
    this.orders.generate();
  }

  update(time) {
    this.player.speedMultiplier = this.deliveryEvents.modifiers.speed(gameState.getSnapshot().transport);
    this.player.update();
    this.orders.update();
    this.orderUI.update();
    this.objectiveMarker.update(time);
  }
}
