import type { Sim } from "@core/sim";
import { Cooldowns } from "@core/utils/cooldowns";
import { pickRandom } from "@core/utils/generators";
import settings from "@core/settings";
import Mustache from "mustache";
import { randomInt } from "mathjs";
import { relationThresholds } from "@core/components/relations";
import { System } from "./system";
import missions from "../world/data/missions.json";

Mustache.escape = (text) => text;

export class MissionGeneratingSystem extends System {
  cooldowns: Cooldowns<"exec">;

  constructor() {
    super();
    this.cooldowns = new Cooldowns("exec");
  }

  exec = (delta: number) => {
    this.cooldowns.update(delta);
    if (!this.cooldowns.canUse("exec")) return;
    this.cooldowns.use("exec", 5 * 60);

    const player = this.sim.queries.player.get()[0];

    if (
      player.cp.missions.value.length < 3 &&
      this.sim.getTime() > 5 * 60 + settings.bootTime &&
      player.cp.missions.offer === null
    ) {
      const faction = pickRandom(
        this.sim.queries.ai
          .get()
          .filter(
            (f) =>
              player.cp.relations.values[f.id] >= relationThresholds.mission
          )
      );
      if (!faction) return;

      const sector = pickRandom(
        this.sim.queries.sectors
          .get()
          .filter((s) => s.cp.owner?.id === faction.id)
      );
      const time = randomInt(1, 8) * 15;
      const template = pickRandom(missions.patrol);
      const transform = (text: string) =>
        Mustache.render(text, {
          faction: faction.cp.name.value,
          sector: sector.cp.name.value,
          time: `${time} minutes`,
        });

      player.cp.missions.offer = {
        title: template.title,
        description: transform(template.description),
        actorName: "Local Police",
        responses: template.responses.map((r) => ({
          next: transform(r.next),
          text: transform(r.text),
          actor: "player",
          type: r.type as "accept" | "decline" | "neutral",
        })),
      };
    }
  };

  apply = (sim: Sim): void => {
    super.apply(sim);
    sim.hooks.phase.update.tap(this.constructor.name, this.exec);
  };
}
