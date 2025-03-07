import { stopCruise } from "@core/components/drive";
import { changeHp } from "@core/components/hitpoints";
import settings from "@core/settings";
import type { Sim } from "@core/sim";
import type { RequireComponent } from "@core/tsHelpers";
import { findInAncestors } from "@core/utils/findInAncestors";
import { distance } from "mathjs";
import type { DockSize } from "@core/components/dockable";
import type { Entity } from "@core/entity";
import { regenCooldown } from "./hitpointsRegenerating";
import { Query } from "./utils/query";
import { System } from "./system";

const sizeMultipliers: Record<DockSize, [number, number, number]> = {
  large: [0.1, -5, 10],
  medium: [0.5, -1, 25],
  small: [0.05, -10, 45],
};
export function getEvasionChance(speed: number, size: DockSize): number {
  const [a, b, c] = sizeMultipliers[size];
  return Math.max(0, ((b / speed) * 10 * a + c) / 100);
}

export function isInDistance(
  entity: RequireComponent<"damage">,
  target: RequireComponent<"position">,
  r: number = entity.cp.damage.range
): boolean {
  return (
    distance(
      findInAncestors(entity, "position").cp.position.coord,
      target.cp.position.coord
    ) <= r
  );
}

function shouldAttackBack(
  attacker: RequireComponent<"damage">,
  target: RequireComponent<"position">
): boolean {
  const attackerOrParent = findInAncestors(attacker, "position");

  return (
    !!target.cp.damage &&
    target.tags.has("role:military") &&
    (target.cp.orders?.value[0]?.type !== "attack" ||
      (target.cp.orders.value[0].targetId !== attackerOrParent.id &&
        !attacker.sim
          .getOrThrow(target.cp.orders.value[0].targetId)
          .tags.has("role:military") &&
        isInDistance(target.requireComponents(["damage"]), attackerOrParent)))
  );
}

function attack(attacker: RequireComponent<"orders">, target: Entity) {
  if (attacker.cp.orders.value[0]) {
    attacker.cp.orders.value[0].interrupt = true;
  }
  attacker.cp.orders.value.splice(1, 0, {
    type: "attack",
    actions: [],
    followOutsideSector: false,
    ordersForSector: 0,
    origin: "auto",
    targetId: findInAncestors(target, "position").id,
  });
}

const cdKey = "attack";

export class AttackingSystem extends System {
  query: Query<"damage">;

  apply = (sim: Sim) => {
    super.apply(sim);

    this.query = new Query(sim, ["damage"]);

    sim.hooks.phase.update.tap(this.constructor.name, this.exec);
  };

  exec = (): void => {
    if (this.sim.getTime() < settings.bootTime) return;

    for (const entity of this.query.getIt()) {
      if (entity.cp.damage.targetId && entity.cooldowns.canUse(cdKey)) {
        if (!this.sim.entities.has(entity.cp.damage.targetId)) {
          entity.cp.damage.targetId = null;
          continue;
        }

        const target = this.sim
          .getOrThrow(entity.cp.damage.targetId)
          .requireComponents(["position", "hitpoints"]);

        if (isInDistance(entity, target)) {
          entity.cooldowns.use(cdKey, entity.cp.damage.cooldown);
          if (
            !target.cp.drive ||
            !target.cp.dockable ||
            Math.random() >
              getEvasionChance(
                target.cp.drive.currentSpeed,
                target.cp.dockable.size
              )
          ) {
            changeHp(target, entity.cp.damage.value);
            const parentEntity = findInAncestors(entity, "position");

            if (target.cp.drive) {
              stopCruise(target.cp.drive);
            }
            if (shouldAttackBack(entity, target)) {
              if (target.cp.orders) {
                attack(target.requireComponents(["orders"]), entity);
              }
            } else if (
              target.cp.damage &&
              !target.tags.has("role:military") &&
              (!target.cp.damage.targetId ||
                (this.sim.get(target.cp.damage.targetId) &&
                  !isInDistance(
                    target.requireComponents(["damage"]),
                    this.sim.get(target.cp.damage.targetId)!
                  )))
            ) {
              target.cp.damage.targetId = parentEntity.id;
            }
            target.cp.subordinates?.ids.forEach((subordinateId) => {
              const subordinate = this.sim
                .getOrThrow(subordinateId)
                .requireComponents(["orders"]);

              if (subordinate.cp.orders.value[0]?.type === "escort") {
                attack(subordinate, parentEntity);
              }
            });
          }

          target.cooldowns.use(regenCooldown, 2);
        }
      }
    }
  };
}
