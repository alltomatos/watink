import { QueryTypes, Op, Sequelize } from "sequelize";
import sequelize from "../../database";
import Protocol from "../../models/Protocol";

interface DashboardData {
    statusCounts: any[];
    priorityCounts: any[];
    categoryCounts: any[];
    slaStatus: { onTime: number; overdue: number };
}

const GetProtocolDashboardService = async (
    tenantId: string | number
): Promise<DashboardData> => {
    // 1. Status Counts
    const statusCounts = await Protocol.findAll({
        attributes: ["status", [Sequelize.fn("COUNT", Sequelize.col("id")), "count"]],
        where: { tenantId },
        group: ["status"],
        raw: true
    });

    // 2. Priority Counts
    const priorityCounts = await Protocol.findAll({
        attributes: ["priority", [Sequelize.fn("COUNT", Sequelize.col("id")), "count"]],
        where: { tenantId },
        group: ["priority"],
        raw: true
    });

    // 3. Category Counts (Top 10)
    const categoryCounts = await Protocol.findAll({
        attributes: ["category", [Sequelize.fn("COUNT", Sequelize.col("id")), "count"]],
        where: {
            tenantId,
            category: { [Op.ne]: null as any }
        },
        group: ["category"],
        order: [[Sequelize.col("count"), "DESC"]],
        limit: 10,
        raw: true
    });

    // 4. SLA Status (Overdue vs OnTime)
    // Only for OPEN or IN_PROGRESS protocols that have a dueDate
    const openProtocols = await Protocol.findAll({
        where: {
            tenantId,
            status: { [Op.in]: ["open", "in_progress"] },
            dueDate: { [Op.ne]: null as any }
        },
        attributes: ["id", "dueDate"]
    });

    let onTime = 0;
    let overdue = 0;
    const now = new Date();

    openProtocols.forEach(p => {
        if (p.dueDate && new Date(p.dueDate) < now) {
            overdue++;
        } else {
            onTime++;
        }
    });

    return {
        statusCounts,
        priorityCounts,
        categoryCounts,
        slaStatus: { onTime, overdue }
    };
};

export default GetProtocolDashboardService;
