import React from "react";
import { Route, Routes, Link } from "react-router-dom";
import { Card, CardHeader } from "@kit/Card";
import { Ships } from "./ships";
import "@alenaksu/json-viewer";
import { UniverseMap } from "./map";
import styles from "./index.scss";
import { FacilityModules } from "./facilityModules";
import { Factions } from "./factions";
import { Sectors } from "./Sectors";
import { Charts } from "./charts";

const DevToolsCard: React.FC<{
  link: string;
  name: string;
  description: string;
}> = ({ link, name, description }) => (
  <Link to={link} className={styles.cardLink}>
    <Card>
      <CardHeader>{name}</CardHeader>
      {description}
    </Card>
  </Link>
);

const DevToolsIndex: React.FC = () => (
  <div className={styles.index}>
    <div className={styles.grid}>
      <DevToolsCard
        name="Ship Editor"
        description="Manage ships blueprints, their costs and other properties"
        link="/dev/ships"
      />
      <DevToolsCard
        name="Map"
        description="See nearest stars map and distances between them"
        link="/dev/map"
      />
      <DevToolsCard
        name="Facility Modules"
        description="Manage facility modules such as water production or fuelium refining"
        link="/dev/facility-modules"
      />
      <DevToolsCard
        name="Factions"
        description="Manage factions and relations between them"
        link="/dev/factions"
      />
      <DevToolsCard
        name="Sectors"
        description="Assign resources and owners to sectors"
        link="/dev/sectors"
      />
      <DevToolsCard
        name="Charts"
        description="Preview various charts generated by game logic"
        link="/dev/charts"
      />
    </div>
  </div>
);

export const DevTools: React.FC = () => (
  <div className={styles.root}>
    <Routes>
      <Route path="ships" element={<Ships />} />
      <Route path="map" element={<UniverseMap />} />
      <Route path="facility-modules" element={<FacilityModules />} />
      <Route path="factions" element={<Factions />} />
      <Route path="sectors" element={<Sectors />} />
      <Route path="charts/*" element={<Charts />} />
      <Route path="/" element={<DevToolsIndex />} />
    </Routes>
  </div>
);

export default DevTools;
