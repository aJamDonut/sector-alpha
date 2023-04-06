import { filter, map, pipe, reduce, toArray } from "@fxts/core";
import type { Faction } from "@core/archetypes/faction";
import { relationThresholds } from "@core/components/relations";
import { distance } from "mathjs";
import type { RequireComponent } from "@core/tsHelpers";
import { System } from "../system";
import type { Sim } from "../../sim";
import { Cooldowns } from "../../utils/cooldowns";
import { Query } from "../utils/query";

export class SpottingSystem extends System {
  cooldowns: Cooldowns<"exec">;
  query: Query<"hitpoints" | "owner" | "position">;

  constructor() {
    super();
    this.cooldowns = new Cooldowns("exec");
  }

  apply = (sim: Sim) => {
    super.apply(sim);

    this.query = new Query(sim, ["hitpoints", "owner", "position"]);

    sim.hooks.phase.update.tap(this.constructor.name, this.exec);
  };

  exec = (delta: number): void => {
    this.cooldowns.update(delta);
    if (!this.cooldowns.canUse("exec")) return;

    const cache: Record<
      string,
      Array<RequireComponent<"hitpoints" | "owner" | "position">>
    > = {};

    this.sim.queries.orderable.get().forEach((entity) => {
      if (
        entity.cp.orders.value[0]?.type !== "patrol" &&
        entity.cp.orders.value[0]?.type !== "escort"
      )
        return;

      if (
        !entity.cp.owner ||
        (entity.cp.orders.value[0].type === "patrol" &&
          entity.cp.position.sector !== entity.cp.orders.value[0].sectorId)
      )
        return;
      const entityOwner = this.sim.getOrThrow<Faction>(entity.cp.owner.id);

      const cacheKey = [entity.cp.owner!.id, entity.cp.position.sector].join(
        ":"
      );
      const enemies =
        cache[cacheKey] ??
        pipe(
          this.query.get(),
          filter(
            (e) =>
              e.tags.has("ship") &&
              e.cp.owner.id !== entityOwner.id &&
              e.cp.position.sector === entity.cp.position.sector &&
              (entityOwner.cp.relations.values[e.cp.owner.id]! <
                relationThresholds.attack ||
                (entityOwner.cp.ai?.restrictions.mining &&
                  e.cp.mining?.entityId))
          ),
          toArray
        );
      if (!cache[cacheKey]) {
        cache[cacheKey] = enemies;
      }
      const closestEnemy = pipe(
        enemies,
        map((e) => ({
          entity: e,
          distance: distance(
            e.cp.position.coord,
            entity.cp.position.coord
          ) as number,
        })),
        reduce((acc, e) => (acc.distance > e.distance ? e : acc))
      );

      if (closestEnemy?.distance <= 8) {
        entity.cp.orders.value[0].interrupt = true;
        entity.cp.orders.value.splice(1, 0, {
          type: "attack",
          ordersForSector: entity.cp.position.sector,
          origin: "auto",
          targetId: closestEnemy.entity.id,
          actions: [],
          followOutsideSector: entity.cp.orders.value[0]?.type !== "patrol",
        });
      }
    });

    this.cooldowns.use("exec", 1.5);
  };
}
