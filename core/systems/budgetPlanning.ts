import { faction } from "../archetypes/faction";
import { transferMoney } from "../components/budget";
import type { WithTrade } from "../economy/utils";
import { getPlannedBudget } from "../economy/utils";
import type { Sim } from "../sim";
import { limitMax } from "../utils/limit";
import { Query } from "./utils/query";
import { System } from "./system";

function settleBudget(entity: WithTrade) {
  const budgetChange =
    getPlannedBudget(entity) - entity.components.budget.available;
  const owner = faction(entity.sim.getOrThrow(entity.components.owner.id));

  if (budgetChange < 0) {
    transferMoney(
      entity.components.budget,
      limitMax(-budgetChange, entity.components.budget.available),
      owner.cp.budget
    );
  } else {
    transferMoney(
      owner.cp.budget,
      limitMax(budgetChange, owner.cp.budget.available),
      entity.components.budget
    );
  }
}

export class BudgetPlanningSystem extends System<"exec"> {
  query: Query<"budget" | "owner" | "trade">;

  apply = (sim: Sim): void => {
    super.apply(sim);

    this.query = new Query(sim, ["budget", "owner", "trade"]);
    sim.hooks.phase.update.tap(this.constructor.name, this.exec);
  };

  exec = (): void => {
    if (this.cooldowns.canUse("exec")) {
      this.cooldowns.use("exec", 5 * 60);
      this.query
        .get()
        .filter((entity) => entity.sim.getOrThrow(entity.cp.owner.id).cp.ai)
        .forEach(settleBudget);
    }
  };
}
