import { sum } from "mathjs";
import sortBy from "lodash/sortBy";
import type { ShipyardQueueItem } from "@core/components/shipyard";
import type { DockSize } from "@core/components/dockable";
import type { InitialShipInput } from "../archetypes/ship";
import { createShip } from "../archetypes/ship";
import { mineableCommodities } from "../economy/commodity";
import type { Sim } from "../sim";
import { Cooldowns } from "../utils/cooldowns";
import { pickRandom } from "../utils/generators";
import { perCommodity } from "../utils/perCommodity";
import type { ShipRole } from "../world/ships";
import { System } from "./system";
import type { Faction } from "../archetypes/faction";
import type { Sector } from "../archetypes/sector";
import { sector as asSector } from "../archetypes/sector";
import type { Entity } from "../entity";
import type { RequireComponent } from "../tsHelpers";
import { notNull } from "../utils/maps";

const patrolsPerSector = 4;
const fightersPerPatrol = 2;

interface ShipRequest {
  trading: number;
  mining: number;
  facility?: RequireComponent<"position" | "facilityModuleQueue" | "modules">;
  sector?: Sector;
  patrols: number;
  fighters: number;
}

export function requestShip(
  faction: Faction,
  shipyard: RequireComponent<"shipyard" | "position">,
  role: ShipRole,
  queue: boolean,
  size?: DockSize
): Omit<InitialShipInput, "position" | "owner" | "sector"> | null {
  const bp = pickRandom(
    faction.cp.blueprints.ships.filter(
      (ship) => ship.role === role && (size ? ship.size === size : true)
    )
  );

  if (!bp) return null;

  if (queue || Math.random() < 0.15) {
    shipyard.cp.shipyard.queue.push({
      blueprint: bp,
      owner: faction.id,
    });
  } else {
    createShip(faction.sim, {
      ...bp,
      position: shipyard.cp.position.coord.clone(),
      owner: faction,
      sector: asSector(shipyard.sim.getOrThrow(shipyard.cp.position.sector)),
      name: `${faction.cp.name.slug!} ${bp.name}`,
    });
  }

  return bp;
}

export class ShipPlanningSystem extends System {
  cooldowns: Cooldowns<"plan">;

  constructor(sim: Sim) {
    super(sim);
    this.cooldowns = new Cooldowns("plan");
  }

  getFacilityShipRequests = (faction: Faction): ShipRequest[] =>
    this.sim.queries.facilities
      .get()
      .filter((facility) => facility.cp.owner?.id === faction.id)
      .map((facility) => {
        const facilityModules = facility.cp.modules.ids.map(
          this.sim.getOrThrow
        );
        const facilityShips = this.sim.queries.commendables
          .get()
          .filter((ship) => ship.cp.commander.id === facility.id);
        const miners = facilityShips
          .filter((ship) => ship.cp.mining)
          .map((miner) => miner.requireComponents(["commander", "mining"]));
        const traders = facilityShips.filter((ship) => !ship.cp.mining);
        const production = perCommodity((commodity) =>
          facilityModules
            .filter(
              (fm) =>
                fm.cp.production &&
                (fm.cp.production.pac[commodity].consumes > 0 ||
                  fm.cp.production.pac[commodity].produces > 0)
            )
            .reduce(
              (b, fm) =>
                b +
                (fm.cp.production!.pac[commodity].produces -
                  fm.cp.production!.pac[commodity].consumes) /
                  3600,
              0
            )
        );
        const shipsForShipyards = facility.cp.shipyard ? 1 : 0;

        const currentMiningSpeed: number = sum(
          miners.map((miner) => miner.cp.mining.efficiency)
        );

        const mining =
          Object.entries(production)
            .filter(
              ([commodity, commodityProduction]) =>
                commodityProduction < 0 &&
                (Object.values(mineableCommodities) as string[]).includes(
                  commodity
                )
            )
            .reduce(
              (m, [, commodityProduction]) => m + commodityProduction,
              0
            ) + currentMiningSpeed;

        const shipsForProduction =
          Math.floor(
            Object.entries(production).filter(
              ([commodity, commodityUsage]) =>
                !(Object.values(mineableCommodities) as string[]).includes(
                  commodity
                ) && commodityUsage !== 0
            ).length / 1.5
          ) || 1;

        const trading =
          traders.length - (shipsForProduction + shipsForShipyards);

        return { facility, mining, trading, patrols: 0, fighters: 0 };
      });

  getPatrolRequests = (faction: Faction): ShipRequest[] =>
    this.sim.queries.sectors
      .get()
      .filter((sector) => sector.cp.owner?.id === faction.id)
      .map((sector) => {
        const sectorPatrols = this.sim.queries.orderable
          .get()
          .filter(
            (ship) =>
              ship.cp.owner?.id === faction.id &&
              ship.cp.dockable?.size === "medium" &&
              ship.cp.orders.value.some(
                (order) =>
                  order.type === "patrol" && order.sectorId === sector?.id
              )
          );
        const sectorPatrolsFollowers = sectorPatrols.flatMap((ship) =>
          this.sim.queries.commendables
            .get()
            .filter(
              (commendable) =>
                commendable.cp.commander.id === ship.id &&
                commendable.cp.dockable?.size === "small"
            )
        ).length;

        return {
          sector,
          patrols: sectorPatrols.length - patrolsPerSector,
          fighters:
            sectorPatrolsFollowers - patrolsPerSector * fightersPerPatrol,
          trading: 0,
          mining: 0,
        };
      });

  getShipRequests = (faction: Faction): ShipRequest[] => [
    ...this.getFacilityShipRequests(faction),
    ...this.getPatrolRequests(faction),
  ];

  assignTraders = (
    faction: Faction,
    shipRequests: ShipRequest[],
    requestsInShipyards: ShipyardQueueItem[],
    shipyard: RequireComponent<"shipyard" | "position">
  ) => {
    const spareTraders: Entity[] = shipRequests
      .filter((request) => request.trading > 0)
      .flatMap(({ facility, trading }) =>
        this.sim.queries.commendables
          .get()
          .filter(
            (ship) =>
              ship.cp.commander.id === facility?.id &&
              ship.tags.has("role:transport")
          )
          .slice(0, trading)
      );
    spareTraders.forEach((ship) => {
      ship.removeComponent("commander");
    });
    spareTraders.push(
      ...this.sim.queries.orderable
        .get()
        .filter(
          (ship) =>
            ship.cp.owner?.id === faction.id &&
            !ship.cp.commander &&
            ship.tags.has("role:transport")
        )
    );

    const shipRequestInShipyards = requestsInShipyards.filter(
      (queued) => queued && queued?.blueprint.role === "transport"
    );

    shipRequests
      .filter(({ trading }) => trading < 0)
      .forEach(({ facility, trading }) => {
        for (let i = 0; i < -trading; i++) {
          if (spareTraders.length > 0 && facility) {
            const ship = spareTraders.pop()!;
            ship.addComponent({
              name: "commander",
              id: facility.id,
            });
          } else if (shipRequestInShipyards.length > 0) {
            shipRequestInShipyards.pop();
          } else {
            requestShip(faction, shipyard, "transport", this.sim.getTime() > 0);
          }
        }
      });
  };

  assignMiners = (
    faction: Faction,
    shipRequests: ShipRequest[],
    requestsInShipyards: ShipyardQueueItem[],
    shipyard: RequireComponent<"shipyard" | "position">
  ) => {
    const spareMiners: Entity[] = shipRequests
      .filter((request) => request.mining >= 1)
      .flatMap(({ facility, mining }) => {
        const miners = sortBy(
          this.sim.queries.commendables
            .get()
            .filter(
              (ship) =>
                ship.cp.commander.id === facility?.id &&
                ship.tags.has("role:mining")
            ),
          (ship) => ship.cp.mining!.efficiency
        );
        const sliceIndex = miners.reduce(
          ({ current, index }, ship, shipIndex) => {
            if (
              current < mining &&
              ship.cp.mining!.efficiency <= mining - current
            ) {
              return {
                index: shipIndex,
                current: current + ship.cp.mining!.efficiency,
              };
            }

            return { index, current };
          },
          { index: -1, current: 0 }
        ).index;

        return miners.slice(0, sliceIndex);
      });
    spareMiners.forEach((ship) => {
      ship.removeComponent("commander");
    });
    spareMiners.push(
      ...this.sim.queries.mining
        .get()
        .filter(
          (ship) => ship.cp.owner?.id === faction.id && !ship.cp.commander
        )
    );

    const miningShipRequests = shipRequests.filter(({ mining }) => mining < 0);

    if (miningShipRequests.length === 0) return;

    const miningShipRequestInShipyards = requestsInShipyards.filter(
      (queued) => queued?.blueprint.mining
    );

    miningShipRequests.forEach(({ facility, mining }) => {
      while (mining < 0) {
        if (spareMiners.length > 0 && facility) {
          const ship = spareMiners.pop()!;
          ship.addComponent({
            name: "commander",
            id: facility.id,
          });
          mining += ship.cp.mining!.efficiency;
        } else if (miningShipRequestInShipyards.length > 0) {
          mining += miningShipRequestInShipyards.pop()!.blueprint.mining;
        } else {
          const bp = requestShip(
            faction,
            shipyard,
            "mining",
            this.sim.getTime() > 0
          );
          mining += bp?.mining ?? 0;
        }
      }
    });
  };

  assignPatrols = (
    faction: Faction,
    shipRequests: ShipRequest[],
    requestsInShipyards: ShipyardQueueItem[],
    shipyard: RequireComponent<"shipyard" | "position">
  ) => {
    const spareFrigates: Entity[] = shipRequests
      .filter(({ patrols }) => patrols > 0)
      .flatMap(({ sector, patrols }) =>
        this.sim.queries.orderable
          .get()
          .filter(
            (ship) =>
              ship.cp.owner?.id === faction.id &&
              ship.cp.dockable?.size === "medium" &&
              ship.cp.orders.value.some(
                (order) =>
                  order.type === "patrol" && order.sectorId === sector?.id
              )
          )
          .slice(0, patrols)
      );

    spareFrigates.push(
      ...this.sim.queries.orderable
        .get()
        .filter(
          (ship) =>
            ship.cp.owner?.id === faction.id &&
            !ship.cp.commander &&
            ship.cp.dockable?.size === "medium" &&
            ship.tags.has("role:military") &&
            ship.cp.orders.value.length === 0
        )
    );

    const frigatesInShipyards = requestsInShipyards.filter(
      (queued) =>
        queued?.blueprint.role === "military" &&
        queued?.blueprint.size === "medium"
    );

    shipRequests
      .filter(({ sector }) => sector)
      .forEach(({ sector, patrols }) => {
        for (let i = 0; i < -patrols; i++) {
          if (spareFrigates.length > 0 && sector) {
            const ship = spareFrigates.pop()!;
            ship.cp.orders!.value = [
              {
                type: "patrol",
                origin: "auto",
                sectorId: sector!.id,
                actions: [],
              },
            ];
          } else if (frigatesInShipyards.length > 0) {
            frigatesInShipyards.pop();
          } else {
            requestShip(
              faction,
              shipyard,
              "military",
              this.sim.getTime() > 0,
              "medium"
            );
          }
        }
      });

    const spareFighters = this.sim.queries.orderable
      .get()
      .filter(
        (ship) =>
          ship.cp.owner?.id === faction.id &&
          !ship.cp.commander &&
          ship.cp.dockable?.size === "small" &&
          ship.tags.has("role:military") &&
          ship.cp.orders.value.length === 0
      );

    const fightersInShipyards = requestsInShipyards.filter(
      (queued) =>
        queued?.blueprint.role === "military" &&
        queued?.blueprint.size === "small"
    );

    shipRequests
      .filter(({ fighters }) => fighters)
      .forEach(({ fighters }) => {
        for (let i = 0; i < -fighters; i++) {
          if (spareFighters.length > 0) {
            const ship = spareFighters.pop()!;
            const commander = this.sim.queries.orderable
              .get()
              .find(
                (patrolLeader) =>
                  patrolLeader.cp.owner?.id === faction.id &&
                  patrolLeader.cp.dockable?.size === "medium" &&
                  patrolLeader.cp.orders.value.some(
                    (order) => order.type === "patrol"
                  ) &&
                  this.sim.queries.commendables
                    .get()
                    .filter(
                      (commendable) =>
                        commendable.cp.commander.id === patrolLeader.id
                    ).length < fightersPerPatrol
              );

            if (commander) {
              ship.cp.orders!.value = [
                {
                  type: "escort",
                  origin: "auto",
                  targetId: commander.id,
                  actions: [],
                  ordersForSector: 0,
                },
              ];
              if (ship.cp.autoOrder) {
                ship.cp.autoOrder.default = "escort";
              }
              ship.addComponent({ name: "commander", id: commander.id });
            }
          } else if (fightersInShipyards.length > 0) {
            fightersInShipyards.pop();
          } else {
            requestShip(
              faction,
              shipyard,
              "military",
              this.sim.getTime() > 0,
              "small"
            );
          }
        }
      });
  };

  exec = (delta: number): void => {
    this.cooldowns.update(delta);
    if (this.cooldowns.canUse("plan")) {
      this.cooldowns.use("plan", 60);

      this.sim.queries.ai.get().forEach((faction) => {
        const shipRequests = this.getShipRequests(faction);
        const requestsInShipyards = this.sim.queries.shipyards
          .get()
          .flatMap((shipyard) =>
            [...shipyard.cp.shipyard.queue, shipyard.cp.shipyard.building]
              .filter(notNull)
              .filter((queueItem) => queueItem.owner === faction.id)
          );
        const shipyard =
          this.sim.queries.shipyards
            .get()
            .find((s) => s.cp.owner.id === faction.id) ??
          pickRandom(this.sim.queries.shipyards.get());

        this.assignTraders(
          faction,
          shipRequests,
          requestsInShipyards,
          shipyard
        );
        this.assignMiners(faction, shipRequests, requestsInShipyards, shipyard);
        this.assignPatrols(
          faction,
          shipRequests,
          requestsInShipyards,
          shipyard
        );
      });
    }
  };
}
