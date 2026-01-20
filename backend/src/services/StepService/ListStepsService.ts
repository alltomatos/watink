import Step from "../../models/Step";

interface ListStepsQuery {
    queueId?: number;
    tenantId?: string | number;
}

const ListStepsService = async (query: ListStepsQuery): Promise<Step[]> => {
    const { queueId, tenantId } = query;

    const whereClause: any = {};

    if (queueId) {
        whereClause.queueId = queueId;
    }

    if (tenantId) {
        whereClause.tenantId = tenantId;
    }

    const steps = await Step.findAll({
        where: whereClause,
        order: [["order", "ASC"]],
        include: [
            {
                association: "queue",
                attributes: ["id", "name", "color"]
            }
        ]
    });

    return steps;
};

export default ListStepsService;
