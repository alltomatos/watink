import { Sequelize, Op } from "sequelize";
import Queue from "../../models/Queue";
import User from "../../models/User";
import Whatsapp from "../../models/Whatsapp";

interface Request {
  searchParam?: string;
  pageNumber?: string | number;
  tenantId?: number | string;
}

interface Response {
  users: User[];
  count: number;
  hasMore: boolean;
}

const ListUsersService = async ({
  searchParam = "",
  pageNumber = "1",
  tenantId
}: Request): Promise<Response> => {
  let whereCondition: any = {};
  if (tenantId !== undefined) {
    whereCondition.tenantId = tenantId;
  }
  console.log("DEBUG: ListUsersService tenantId:", tenantId, "whereCondition:", whereCondition);

  if (searchParam) {
    whereCondition = {
      ...whereCondition,
      [Op.or]: [
        {
          "$User.name$": Sequelize.where(
            Sequelize.fn("LOWER", Sequelize.col("User.name")),
            "LIKE",
            `%${searchParam.toLowerCase()}%`
          )
        },
        { email: { [Op.iLike]: `%${searchParam.toLowerCase()}%` } }
      ]
    };
  }
  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  const { count, rows: users } = await User.findAndCountAll({
    where: whereCondition,
    attributes: ["name", "id", "email", "profile", "createdAt", "emailVerified"],
    limit,
    offset,
    order: [["createdAt", "DESC"]],
    include: [
      { model: Queue, as: "queues", attributes: ["id", "name", "color"] },
      { model: Whatsapp, as: "whatsapp", attributes: ["id", "name"] }
    ]
  });

  const hasMore = count > offset + users.length;

  return {
    users,
    count,
    hasMore
  };
};

export default ListUsersService;
