import User from "../../models/User";
import AppError from "../../errors/AppError";
import Queue from "../../models/Queue";
import Whatsapp from "../../models/Whatsapp";
import Group from "../../models/Group";
import Permission from "../../models/Permission";

const ShowUserService = async (id: string | number): Promise<User> => {
  const user = await User.findByPk(id, {
    attributes: [
      "name",
      "id",
      "email",
      "profile",
      "tokenVersion",
      "whatsappId",
      "profileImage"
    ],


    include: [
      { model: Queue, as: "queues", attributes: ["id", "name", "color"] },
      { model: Whatsapp, as: "whatsapp", attributes: ["id", "name"] },
      {
        model: Group,
        as: "groups",
        include: [{ model: Permission, as: "permissions", attributes: ["id", "name"] }]
      },
      { model: Permission, as: "permissions", attributes: ["id", "name"] }
    ],
    order: [[{ model: Queue, as: "queues" }, "name", "asc"]]
  });
  if (!user) {
    throw new AppError("ERR_NO_USER_FOUND", 404);
  }

  return user;
};

export default ShowUserService;
