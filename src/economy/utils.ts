import { Matrix, norm, subtract, sum } from "mathjs";
import sortBy from "lodash/sortBy";
import minBy from "lodash/minBy";
import { map } from "lodash";
import { sim } from "../sim";
import { Commodity } from "./commodity";
import { RequireComponent } from "../tsHelpers";
import { AsteroidField } from "../archetypes/asteroidField";
import { asteroid, Asteroid } from "../archetypes/asteroid";

export type WithTrade = RequireComponent<
  "trade" | "storage" | "budget" | "position" | "owner"
>;

export function getFacilityWithMostProfit(
  facility: WithTrade,
  commodity: Commodity
): WithTrade | null {
  const distance = (f: WithTrade) =>
    norm(
      subtract(facility.cp.position.coord, f.cp.position.coord) as Matrix
    ) as number;

  const profit = (f: WithTrade) =>
    facility.components.owner.value === f.components.owner.value
      ? 1e20
      : (facility.components.trade.offers[commodity].price -
          f.components.trade.offers[commodity].price) *
        (facility.components.trade.offers[commodity].type === "buy" ? 1 : -1);

  const sortedByProfit = sortBy(
    (
      sim.queries.trading
        .get()
        .filter(
          (f) =>
            f.components.trade.offers[commodity].type !==
              facility.components.trade.offers[commodity].type &&
            f.components.trade.offers[commodity].quantity > 0
        ) as WithTrade[]
    ).map((f) => ({
      facility: f,
      profit: profit(f),
    })),
    "profit"
  ).reverse();

  if (!sortedByProfit[0] || sortedByProfit[0].profit <= 0) {
    return null;
  }

  return sortBy(
    sortedByProfit
      .filter((f, _, arr) => f.profit / arr[0].profit >= 0.95)
      .map((f) => f.facility),
    distance
  ).reverse()[0];
}

export function getClosestMineableAsteroid(
  field: AsteroidField,
  position: Matrix
): Asteroid | undefined {
  return minBy(
    field.components.children.value
      .map(asteroid)
      .filter((a) => !a.components.minable.minedBy),
    (r) => norm(subtract(position, asteroid(r).cp.position.coord) as Matrix)
  );
}

/**
 *
 * @returns Minimum required money to fulfill all buy requests, not taking
 * into account sell offers
 */
export function getPlannedBudget(entity: WithTrade): number {
  return sum(
    map(entity.components.trade.offers).map(
      (offer) => (offer.type === "sell" ? 0 : offer.quantity) * offer.price
    )
  );
}
