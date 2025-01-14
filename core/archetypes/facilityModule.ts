import type { Commodity } from "@core/economy/commodity";
import { fromEntries, pipe, map } from "@fxts/core";
import type { Damage } from "@core/components/damage";
import { Entity } from "../entity";
import type { PAC } from "../components/production";
import { createProduction } from "../components/production";
import type { Sim } from "../sim";
import type { RequireComponent } from "../tsHelpers";
import modules from "../world/data/facilityModules.json";

export interface FacilityModuleCommonInput {
  name: string;
  slug: string;
  build: {
    cost: Partial<Record<Commodity, number>>;
    time: number;
  };
}
export interface ProductionFacilityModuleInput
  extends FacilityModuleCommonInput {
  pac: Partial<PAC>;
  time: number;
  type: "production";
}
export interface StorageFacilityModuleInput extends FacilityModuleCommonInput {
  storage: number;
  type: "storage";
}
export interface ShipyardFacilityModuleInput extends FacilityModuleCommonInput {
  type: "shipyard";
}
export interface TeleportFacilityModuleInput extends FacilityModuleCommonInput {
  type: "teleport";
}
export interface HabitatFacilityModuleInput extends FacilityModuleCommonInput {
  pac: Partial<PAC>;
  time: number;
  crew: number;
  type: "habitat";
}
export interface MilitaryFacilityModuleInput extends FacilityModuleCommonInput {
  damage: Omit<Damage, "name">;
  type: "military";
}
export type FacilityModuleInput =
  | ProductionFacilityModuleInput
  | StorageFacilityModuleInput
  | ShipyardFacilityModuleInput
  | TeleportFacilityModuleInput
  | HabitatFacilityModuleInput
  | MilitaryFacilityModuleInput;

export type FacilityModule = RequireComponent<"parent" | "name">;

export function createFacilityModule(
  sim: Sim,
  input: FacilityModuleInput & {
    parent: Entity;
  }
) {
  const entity = new Entity(sim);
  entity
    .addComponent({
      name: "parent",
      id: input.parent.id,
    })
    .addComponent({
      name: "name",
      value: input.name,
    })
    .addTag("facilityModule");
  if (input.type === "production" || input.type === "habitat") {
    entity.addComponent(createProduction(input.time, input.pac));
  } else if (input.type === "storage") {
    entity.addComponent({
      name: "storageBonus",
      value: input.storage,
    });
  } else if (input.type === "teleport") {
    entity.addComponent({
      name: "teleport",
      destinationId: null,
    });
  } else if (input.type === "military") {
    entity.addComponent({
      ...input.damage,
      name: "damage",
      targetId: null,
    });
  }

  return entity as FacilityModule;
}

export function createFacilityModuleTemplate(input: FacilityModuleInput) {
  return {
    create: (sim: Sim, parent: Entity) =>
      createFacilityModule(sim, { ...input, parent }),
    ...input,
  };
}

export const facilityModules: Record<
  string,
  ReturnType<typeof createFacilityModuleTemplate>
> = pipe(
  modules,
  map(
    ({ slug, ...rest }) =>
      // @ts-ignore
      [slug, createFacilityModuleTemplate({ slug, ...rest })] as const
  ),
  fromEntries
);
