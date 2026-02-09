import User from "../../models/User";
import AppError from "../../errors/AppError";
import Queue from "../../models/Queue";
import Whatsapp from "../../models/Whatsapp";
import Group from "../../models/Group";
import Role from "../../models/Role";
import Permission from "../../models/Permission";

const ShowUserService = async (id: string | number): Promise<User> => {
  const user = await User.findByPk(id, {
    attributes: [
      "name",
      "id",
      "email",
      "tokenVersion",
      "whatsappId",
      "emailVerified",
      "profileImage"
    ],


    include: [
      { model: Queue, as: "queues", attributes: ["id", "name", "color"] },
      { model: Whatsapp, as: "whatsapp", attributes: ["id", "name"] },
      {
        model: Group,
        as: "groups",
        include: [
          {
            model: Role,
            as: "roles",
            include: [{ model: Permission, as: "permissions", attributes: ["id", "resource", "action"] }]
          },
          { model: Permission, as: "permissions", attributes: ["id", "resource", "action"] }
        ]
      },
      {
        model: Role,
        as: "roles",
        include: [{ model: Permission, as: "permissions", attributes: ["id", "resource", "action"] }]
      },

    ],
    order: [[{ model: Queue, as: "queues" }, "name", "asc"]]
  });
  if (!user) {
    throw new AppError("ERR_NO_USER_FOUND", 404);
  }

  const userJson = user.toJSON();
  if (user.groups && user.groups.length > 0) {
    (userJson as any).groupId = user.groups[0].id;
  }

  // Flatten permissions for the frontend/mobile app
  const permissions = new Set<string>();



  // 2. Role Permissions
  user.roles?.forEach(role => {
    role.permissions?.forEach(p => {
      if (p.resource && p.action) {
        permissions.add(`${p.resource}:${p.action}`);
      }
    });
  });

  // 3. Group Permissions (Direct & via Roles)
  user.groups?.forEach(group => {
    // Group -> Roles -> Permissions
    group.roles?.forEach(role => {
      role.permissions?.forEach(p => {
        if (p.resource && p.action) {
          permissions.add(`${p.resource}:${p.action}`);
        }
      });
    });

    // Group -> Permissions (Direct)
    group.permissions?.forEach(p => {
      if (p.resource && p.action) {
        permissions.add(`${p.resource}:${p.action}`);
      }
    });
  });

  (userJson as any).permissions = Array.from(permissions);

  return userJson as User;
};

export default ShowUserService;
