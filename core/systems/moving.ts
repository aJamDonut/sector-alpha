import { normalizeAngle } from "@core/utils/misc";
import type { Sim } from "../sim";
import type { RequireComponent } from "../tsHelpers";
import { Query } from "./utils/query";
import { System } from "./system";

type Driveable = RequireComponent<"drive" | "position">;

function move(entity: Driveable, delta: number) {
  if (!entity.cp.drive.active) return;

  const entityPosition = entity.cp.position;
  const drive = entity.cp.drive;

  const entityAngle = normalizeAngle(
    // Offsetting so sprite (facing upwards) matches coords (facing rightwards)
    entityPosition.angle - Math.PI / 2
  );
  const moveVec = [Math.cos(entityAngle), Math.sin(entityAngle)];
  const dPos = [
    moveVec[0] * drive.currentSpeed * delta,
    moveVec[1] * drive.currentSpeed * delta,
  ];
  const dAngle = drive.currentRotary;

  entityPosition.coord.set([0], entityPosition.coord.get([0]) + dPos[0]);
  entityPosition.coord.set([1], entityPosition.coord.get([1]) + dPos[1]);
  entityPosition.angle += dAngle;
  entityPosition.moved = true;

  entity.cp.docks?.docked.forEach((docked) => {
    const dockedPosition = entity.sim.entities
      .get(docked)!
      .requireComponents(["position"]).cp.position;

    dockedPosition.coord = entityPosition.coord.clone();
    dockedPosition.angle += dAngle;
  });
}

export class MovingSystem extends System {
  entities: Driveable[];
  query: Query<"drive" | "position">;

  apply = (sim: Sim): void => {
    super.apply(sim);

    this.query = new Query(sim, ["drive", "position"]);

    sim.hooks.phase.update.tap(this.constructor.name, this.exec);
  };

  exec = (delta: number): void => {
    if (delta > 0) {
      for (const entity of this.query.getIt()) {
        move(entity, delta);
      }
    }
  };
}
