/**
 * TonyRandazzo.js · Expansión "El Resurgir de Mister Alex IA" (v2.0).
 * Fixer con doble personalidad: sevillano relajado por defecto, argentino furioso al enfadarse.
 */
import { NPC } from '../../entities/NPC.js?v=8';
import { EXPANSION_NPCS } from '../ExpansionData.js?v=8';

const ANGER_COOLDOWN_DISTANCE = 64;

export class TonyRandazzo extends NPC {
  constructor({ x = 160, y = 120, animator = null, sceneId = 'valleverde_corp', dialogues = null } = {}) {
    const data = EXPANSION_NPCS.tony_randazzo;
    super({
      name: data.name,
      jobTitle: data.role,
      homeSceneId: sceneId,
      x,
      y,
      animator,
      sceneId,
      behavior: 'idle',
      talkSfx: data.talkSfx || null,
      dialogues: dialogues || data.normalDialogues,
      initialDirection: 'down'
    });
    this.expansionId = data.id;
    this.baseName = data.name;
    this.angryName = data.angryName || `${data.name} (Furioso)`;
    this.spriteColor = data.spriteColor;
    this.talkSfx = data.talkSfx || null;
    this.isAngry = false;
    this.forgiven = false;
    this.interactCount = 0;
    this.normalDialogues = [...(dialogues || data.normalDialogues)];
    this.angryDialogues = [...data.angryDialogues];
    this.smokeTimer = 0;
    this.boundingBox = { offsetX: 3, offsetY: 10, width: 10, height: 6 };
  }

  /** Cambia entre personalidad sevillana relajada y argentina furiosa. */
  setAngry(angry) {
    this.isAngry = Boolean(angry);
    this.name = this.isAngry ? this.angryName : this.baseName;
    this.dialogues = this.isAngry ? this.angryDialogues : this.normalDialogues;
    return this.isAngry;
  }

  /**
   * Al interactuar 3 veces seguidas sin alejarse o al elegir "Me caes mal",
   * Tony Randazzo entra en estado furioso.
   */
  resolveDialogues(dialogueBox = null) {
    this.interactCount += 1;
    if (this.interactCount >= 3 && !this.isAngry) {
      this.setAngry(true);
    }

    if (this.isAngry) {
      return {
        lines: [...this.angryDialogues],
        choices: [
          {
            label: 'Perdóname, hermano (Hacer las paces)',
            onSelect: () => {
              this.forgiven = true;
              this.interactCount = 0;
              this.setAngry(false);
              if (dialogueBox && typeof dialogueBox.showMessage === 'function') {
                dialogueBox.showMessage(this.baseName, [
                  'Bueno, venga... pasa ná, quillo. Todo perdonao.'
                ]);
              }
            }
          },
          {
            label: 'Mejor me voy',
            onSelect: () => {
              if (dialogueBox && typeof dialogueBox.close === 'function') dialogueBox.close();
            }
          }
        ]
      };
    }

    return {
      lines: [...this.normalDialogues],
      choices: [
        {
          label: 'Tranquilo, quillo, solo pasaba',
          onSelect: () => {
            this.forgiven = true;
            if (dialogueBox && typeof dialogueBox.close === 'function') dialogueBox.close();
          }
        },
        {
          label: 'Me caes mal',
          onSelect: () => {
            this.forgiven = false;
            this.setAngry(true);
            if (dialogueBox && typeof dialogueBox.showMessage === 'function') {
              dialogueBox.showMessage(this.name, [...this.angryDialogues]);
            }
          }
        }
      ]
    };
  }

  /** Si el jugador se aleja más de ANGER_COOLDOWN_DISTANCE px, el enfado se enfría. */
  update(dt, tilemap, obstacles, isTalking = false, player = null, threat = null) {
    this.isTalking = Boolean(isTalking);
    this.isMoving = false;
    this.jobAnimTimer += dt;
    this.promptBobTimer += dt * 4.5;
    this.smokeTimer += dt;
    this.tickReactionTimers(dt);

    if (player && !this.isTalking) {
      const dist = Math.hypot(player.centerX - this.centerX, player.centerY - this.centerY);
      if (dist > ANGER_COOLDOWN_DISTANCE && (this.isAngry || this.interactCount > 0)) {
        this.interactCount = 0;
        this.setAngry(false);
      }
    }

    if (this.animator) this.animator.update(dt, this.direction, false);
  }

  render(ctx, camera) {
    const sx = Math.round(this.centerX - camera.renderX);
    const sy = Math.round(this.y - camera.renderY);

    ctx.save();
    ctx.strokeStyle = this.isAngry ? 'rgba(239, 68, 68, 0.85)' : `${this.spriteColor}aa`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(sx, sy + 15, 8, 3, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = this.isAngry ? 'rgba(239, 68, 68, 0.25)' : `${this.spriteColor}22`;
    ctx.beginPath();
    ctx.ellipse(sx, sy + 15, 7, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    super.render(ctx, camera);

    // Tinte rojizo, cigarro (humo blanco normal / llama ardiente en angry) y marca de furia
    ctx.save();
    if (this.isAngry) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.32)';
      ctx.fillRect(sx - 5, sy + 2, 10, 12);
    }

    // Cigarro en la boca
    const cigX = this.direction === 'left' ? sx - 6 : sx + 3;
    const cigY = sy + 6;
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(cigX, cigY, 3, 1);

    const bob = Math.round(Math.sin(this.smokeTimer * 6));
    if (this.isAngry) {
      // Cigarro ardiendo con llama más grande
      ctx.fillStyle = '#f97316';
      ctx.fillRect(cigX + 2, cigY - 2 + bob, 3, 3);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(cigX + 3, cigY - 1 + bob, 1, 2);
      // Humo rojo
      ctx.fillStyle = 'rgba(239, 68, 68, 0.75)';
      ctx.fillRect(cigX + 3, cigY - 5 - Math.abs(bob), 2, 2);

      // Vena de cómic / icono de furia encima de la cabeza
      const vx = sx + 4;
      const vy = sy - 5 + (bob > 0 ? 0 : -1);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(vx - 1, vy, 3, 1);
      ctx.fillRect(vx, vy - 1, 1, 3);
      ctx.fillStyle = '#fecaca';
      ctx.fillRect(vx, vy, 1, 1);
    } else {
      // Brasa discreta + humo blanco tranquilo
      ctx.fillStyle = '#fb923c';
      ctx.fillRect(cigX + 2, cigY, 1, 1);
      ctx.fillStyle = 'rgba(241, 245, 249, 0.75)';
      ctx.fillRect(cigX + 2, cigY - 2 + bob, 1, 1);
      ctx.fillRect(cigX + 3, cigY - 4 + bob, 2, 1);
    }
    ctx.restore();
    this.renderAmbientBubble(ctx, camera);
  }
}
