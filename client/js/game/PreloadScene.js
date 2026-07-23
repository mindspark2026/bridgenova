import { PLAYER_COLORS } from "../config.js";

// Every visual in this game is drawn at runtime with Phaser's Graphics API
// and baked into a texture. This keeps the project free of any external
// image files, so there's zero risk of shipping copyrighted/branded art.
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super("preload");
  }

  create() {
    this.makePlayerTextures();
    this.makePlankTexture();
    this.makeWaterTexture();
    this.makeCloudTexture();
    this.scene.start("race");
  }

  makePlayerTextures() {
    PLAYER_COLORS.forEach((color, i) => {
      const g = this.add.graphics();
      const size = 40;
      g.fillStyle(color, 1);
      g.fillCircle(size / 2, size / 2, size / 2 - 2);
      g.lineStyle(3, 0x0b1220, 1);
      g.strokeCircle(size / 2, size / 2, size / 2 - 2);
      // simple face so racers read as characters, not just dots
      g.fillStyle(0x0b1220, 1);
      g.fillCircle(size / 2 - 7, size / 2 - 4, 2.5);
      g.fillCircle(size / 2 + 7, size / 2 - 4, 2.5);
      g.generateTexture(`player_${i}`, size, size);
      g.destroy();
    });
  }

  makePlankTexture() {
    const g = this.add.graphics();
    const w = 46, h = 16;
    g.fillStyle(0xc98a4b, 1);
    g.fillRoundedRect(0, 0, w, h, 4);
    g.lineStyle(2, 0x8a5a2c, 1);
    g.strokeRoundedRect(0, 0, w, h, 4);
    g.generateTexture("plank", w, h);
    g.destroy();
  }

  makeWaterTexture() {
    const g = this.add.graphics();
    const w = 64, h = 64;
    g.fillStyle(0x123a52, 1);
    g.fillRect(0, 0, w, h);
    g.lineStyle(2, 0x1c5a80, 0.6);
    for (let y = 8; y < h; y += 16) g.strokeLineShape(new Phaser.Geom.Line(0, y, w, y));
    g.generateTexture("water", w, h);
    g.destroy();
  }

  makeCloudTexture() {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 0.5);
    g.fillEllipse(30, 20, 60, 26);
    g.fillEllipse(60, 16, 40, 20);
    g.fillEllipse(10, 18, 34, 18);
    g.generateTexture("cloud", 90, 40);
    g.destroy();
  }
}
