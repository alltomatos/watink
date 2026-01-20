import { Op } from "sequelize";
import FlowTrigger from "../../models/FlowTrigger";
import Flow from "../../models/Flow";

interface TriggerContext {
  [key: string]: any;
}

class FlowTriggerService {
  public async findTrigger(
    type: string,
    context: TriggerContext,
    tenantId: number | string
  ): Promise<FlowTrigger | null> {
    const triggers = await FlowTrigger.findAll({
      where: {
        type,
        isActive: true,
        tenantId
      },
      include: [{ model: Flow, as: "flow", where: { isActive: true } }]
    });

    // Filter by conditions
    // Simple exact match logic for now, can be expanded to Regex/JSON Logic
    const matchedTrigger = triggers.find((trigger) => {
      const condition = trigger.condition as any;
      
      // If no condition, it's a catch-all (be careful with these!)
      if (!condition || Object.keys(condition).length === 0) return true;

      // Check all keys in condition match context
      for (const key of Object.keys(condition)) {
        if (context[key] != condition[key]) {
           return false;
        }
      }
      return true;
    });

    return matchedTrigger || null;
  }
}

export default new FlowTriggerService();
