import type { Sim } from "@core/sim";
import { first } from "@fxts/core";
import { clearFocus } from "../components/selection";
import { isHeadless } from "../settings";
import { SystemWithHooks } from "./utils/hooks";

export class SelectingSystem extends SystemWithHooks {
  refresh = () => {
    if (isHeadless) {
      return;
    }
    const manager = first(this.sim.queries.settings.getIt())!;

    if (manager.cp.selectionManager.id) {
      window.selected = this.sim.getOrThrow(manager.cp.selectionManager.id!);
    } else {
      clearFocus(manager.cp.selectionManager);
    }
  };

  apply = (sim: Sim): void => {
    super.apply(sim);

    sim.hooks.phase.update.tap("SelectingSystem", this.exec);
  };

  exec = (delta: number): void => {
    super.exec(delta);
    this.onChange(
      first(this.sim.queries.settings.getIt())!.cp.selectionManager.id,
      this.refresh
    );
  };
}
