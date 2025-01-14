import React from "react";
import type { Ship } from "@core/archetypes/ship";
import { Docks } from "./Docks";
import AutoOrder from "./AutoOrder";
import { Commander } from "./Commander";
import Orders from "./Orders";

const ShipPanel: React.FC<{ entity: Ship }> = ({ entity: ship }) => {
  const commander = ship.cp.commander?.id
    ? ship.sim.get(ship.cp.commander?.id)
    : null;

  return (
    <div>
      {!!commander && (
        <Commander
          commander={commander}
          ship={ship.requireComponents(["commander"])}
        />
      )}
      <hr />
      {ship.hasComponents(["autoOrder"]) && (
        <>
          <AutoOrder
            entity={ship.requireComponents(["autoOrder", "position"])}
          />
          <hr />
        </>
      )}
      <Orders ship={ship} />
      <hr />
      {!!ship.cp.docks && <Docks entity={ship.requireComponents(["docks"])} />}
    </div>
  );
};

export default ShipPanel;
