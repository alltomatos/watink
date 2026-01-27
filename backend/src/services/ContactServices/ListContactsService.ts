import { Sequelize, Op } from "sequelize";
import Contact from "../../models/Contact";

import Tag from "../../models/Tag";

interface Request {
  searchParam?: string;
  pageNumber?: string;
  tags?: number[];
  tenantId: string | number;
}

interface Response {
  contacts: Contact[];
  count: number;
  hasMore: boolean;
}

const ListContactsService = async ({
  searchParam = "",
  pageNumber = "1",
  tags,
  tenantId
}: Request): Promise<Response> => {
  const whereCondition: any = {
    tenantId,
    [Op.or]: [
      {
        name: Sequelize.where(
          Sequelize.fn("LOWER", Sequelize.col("Contact.name")),
          "LIKE",
          `%${searchParam.toLowerCase().trim()}%`
        )
      },
      { number: { [Op.iLike]: `%${searchParam.toLowerCase().trim()}%` } }
    ]
  };

  let includeCondition = [];

  if (tags && tags.length > 0) {
    includeCondition.push({
      model: Tag,
      as: "tags",
      where: {
        id: {
          [Op.in]: tags
        },
        tenantId
      },
      required: true
    });
  } else {
    includeCondition.push({
      model: Tag,
      as: "tags",
      where: { tenantId },
      required: false
    });
  }

  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  const { count, rows: contacts } = await Contact.findAndCountAll({
    where: whereCondition,
    include: includeCondition,
    distinct: true,
    limit,
    offset,
    order: [["name", "ASC"]],
    subQuery: false
  });

  const hasMore = count > offset + contacts.length;

  return {
    contacts,
    count,
    hasMore
  };
};

export default ListContactsService;
