import { Op, fn, where, col, Filterable, Includeable } from "sequelize";
import { startOfDay, endOfDay, parseISO } from "date-fns";

import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Queue from "../../models/Queue";
import ShowUserService from "../UserServices/ShowUserService";
import Whatsapp from "../../models/Whatsapp";
import Tag from "../../models/Tag";

interface Request {
  searchParam?: string;
  pageNumber?: string;
  status?: string;
  date?: string;
  showAll?: string;
  userId: string;
  withUnreadMessages?: string;
  queueIds: number[];
  isGroup?: string;
  tenantId: string | number;
  tags?: number[];
  profile?: string;
}

interface Response {
  tickets: Ticket[];
  count: number;
  hasMore: boolean;
}

const ListTicketsService = async ({
  searchParam = "",
  pageNumber = "1",
  queueIds,
  status,
  date,
  showAll,
  userId,
  withUnreadMessages,
  isGroup,

  tags,
  tenantId,
  profile
}: Request): Promise<Response> => {
  let whereCondition: Filterable["where"] = {
    [Op.or]: [{ userId }, { status: "pending" }],
    tenantId
  };

  // --- Strict Queue Filtering Fix ---
  // Fetch user to check roles and assigned queues securely
  const user = await ShowUserService(userId);
  const userQueueIds = user.queues.map(queue => queue.id);
  const isAdmin = user.roles?.some(r => r.name === "admin") || profile === "admin"; // Check both role and profile (legacy)

  if (isAdmin) {
    // Admins can see everything based on request params
    if (queueIds && queueIds.length > 0) {
      whereCondition.queueId = { [Op.or]: [queueIds, null] };
    }
    // If no queueIds, admin sees all (standard behavior)
  } else {
    // Non-admin users are strictly limited to their assigned queues
    let effectiveQueueIds: number[] = [];

    if (queueIds && queueIds.length > 0) {
      // Intersection: Only allow requested queues that the user actually belongs to
      effectiveQueueIds = queueIds.filter(qId => userQueueIds.includes(+qId));
    } else {
      // Default: All user's queues
      effectiveQueueIds = userQueueIds;
    }

    // If effective queues is empty (user has no queues or requested invalid ones), 
    // they should see nothing (or only their own tickets explicitly). 
    // Existing logic implies queueId match OR null. 
    // We'll enforce the effective list. 
    // Note: [Op.or]: [effectiveQueueIds, null] allows unassigned tickets if standard behavior desires it.
    // Usually "null" means 'no queue', often handled by admins or initial flow.
    // If regular users shouldn't see 'null' queue tickets unless assigned, we might remove null.
    // However, preserving existing logic pattern:
    whereCondition.queueId = { [Op.or]: [effectiveQueueIds.length > 0 ? effectiveQueueIds : [-1], null] };
  }
  // ----------------------------------

  let includeCondition: Includeable[];

  includeCondition = [
    {
      model: Contact,
      as: "contact",
      attributes: ["id", "name", "number", "profilePicUrl", "isGroup"]
    },
    {
      model: Queue,
      as: "queue",
      attributes: ["id", "name", "color"]
    },
    {
      model: Whatsapp,
      as: "whatsapp",
      attributes: ["name"]
    },
    {
      model: Tag,
      as: "tags",
      attributes: ["id", "name", "color", "icon"],
      required: false
    }
  ];

  if (tags && tags.length > 0) {
    includeCondition.push({
      model: Tag,
      as: "tags",
      attributes: ["id", "name", "color", "icon"],
      required: true,
      where: {
        id: {
          [Op.in]: tags
        }
      }
    });
    // Remove o include duplicado de tags (o default required: false) se houver filtro
    includeCondition = includeCondition.filter(
      i => !(i as any).model || (i as any).model.name !== "Tag" || (i as any).required === true
    );
  }

  if (showAll === "true") {
    // Maintain strict filter even when showAll is true
    if (!isAdmin) {
      whereCondition.queueId = { [Op.or]: [userQueueIds.length > 0 ? userQueueIds : [-1], null] };
    } else {
      whereCondition = { queueId: { [Op.or]: [queueIds, null] } };
    }
  }

  if (status) {
    whereCondition = {
      ...whereCondition,
      status
    };
  }

  if (searchParam) {
    const sanitizedSearchParam = searchParam.toLocaleLowerCase().trim();

    includeCondition = [
      ...includeCondition,
      {
        model: Message,
        as: "messages",
        attributes: ["id", "body"],
        where: {
          body: where(
            fn("LOWER", col("body")),
            "LIKE",
            `%${sanitizedSearchParam}%`
          )
        },
        required: false,
        duplicating: false
      }
    ];

    whereCondition = {
      ...whereCondition,
      [Op.or]: [
        {
          "$contact.name$": where(
            fn("LOWER", col("contact.name")),
            "LIKE",
            `%${sanitizedSearchParam}%`
          )
        },
        { "$contact.number$": { [Op.iLike]: `%${sanitizedSearchParam}%` } },
        {
          "$messages.body$": where(
            fn("LOWER", col("messages.body")),
            "LIKE",
            `%${sanitizedSearchParam}%`
          )
        }
      ]
    };
  }

  if (date) {
    whereCondition = {
      ...whereCondition,
      createdAt: {
        [Op.between]: [+startOfDay(parseISO(date)), +endOfDay(parseISO(date))]
      }
    };
  }

  if (withUnreadMessages === "true") {
    // User already fetched above
    whereCondition = {
      [Op.or]: [{ userId }, { status: "pending" }],
      queueId: { [Op.or]: [userQueueIds, null] },
      unreadMessages: { [Op.gt]: 0 }
    };
  }

  if (isGroup) {
    if (isGroup === "false") {
      whereCondition = {
        ...whereCondition,
        isGroup: false,
        "$contact.isGroup$": false
      };
    } else {
      // Para grupos, ignorar filtros de status/userId e buscar todos os tickets de grupo
      // AND maintain strict queue filter
      whereCondition = {
        queueId: isAdmin
          ? { [Op.or]: [queueIds, null] }
          : { [Op.or]: [userQueueIds, null] },
        [Op.or]: [
          { isGroup: true },
          { "$contact.isGroup$": true }
        ]
      };
    }
  }

  const limit = 40;
  const offset = limit * (+pageNumber - 1);

  const { count, rows: tickets } = await Ticket.findAndCountAll({
    where: whereCondition,
    include: includeCondition,
    distinct: true,
    limit,
    offset,
    order: [["updatedAt", "DESC"]],
    subQuery: false
  });

  const hasMore = count > offset + tickets.length;

  return {
    tickets,
    count,
    hasMore
  };
};

export default ListTicketsService;
