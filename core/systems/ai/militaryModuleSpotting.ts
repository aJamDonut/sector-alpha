import { filter, map, pipe, reduce, toArray } from "@fxts/core";
import type { Faction } from "@core/archetypes/faction";
import { relationThresholds } from "@core/components/relations";
import { distance } from "mathjs";
import type { RequireComponent } from "@core/tsHelpers";
import type { Facility } from "@core/archetypes/facility";
import { facilityComponents } from "@core/archetypes/facility";
import { pickRandom } from "@core/utils/generators";
import { System } from "../system";
import type { Sim } from "../../sim";
import { Cooldowns } from "../../utils/cooldowns";
import { Query } from "../utils/query";
import { SpottingSystem } from "./spotting";

export class MilitaryModuleSpottingSystem extends System {
  cooldowns: Cooldowns<"exec">;
  queries: {
    enemies: Query<"hitpoints" | "owner" | "position">;
    modules: Query<"parent" | "damage">;
  };

  constructor() {
    super();
    this.cooldowns = new Cooldowns("exec");
  }

  apply = (sim: Sim) => {
    super.apply(sim);

    this.queries = {
      enemies: new Query(sim, ["hitpoints", "owner", "position"]),
      modules: new Query(sim, ["parent", "damage"], ["facilityModule"]),
    };

    sim.hooks.phase.update.tap(this.constructor.name, this.exec);
  };

  exec = (delta: number): void => {
    this.cooldowns.update(delta);
    if (!this.cooldowns.canUse("exec")) return;

    const cache: Record<
      string,
      Array<RequireComponent<"hitpoints" | "owner" | "position">>
    > = {};

    this.queries.modules.get().forEach((entity) => {
      const facility = this.sim.getOrThrow<Facility>(entity.cp.parent.id);
      if (!facility.cp.owner) return;

      const enemy = pickRandom(
        SpottingSystem.getEnemies(
          this.queries.enemies.get(),
          cache,
          facility.requireComponents([...facilityComponents, "owner"])
        ).slice(0, 3)
      );

      if (enemy?.distance <= entity.cp.damage.range) {
        entity.cp.damage.targetId = enemy.entity.id;
      }
    });

    this.cooldowns.use("exec", 1.5);
  };
}
