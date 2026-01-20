import User from "../../models/User";
import AppError from "../../errors/AppError";
import Ticket from "../../models/Ticket";
import UpdateDeletedUserOpenTicketsStatus from "../../helpers/UpdateDeletedUserOpenTicketsStatus";

interface RequestUser {
  id: string | number;
  profile: string;
  tenantId: string | number;
}

const DeleteUserService = async (id: string | number, requestUser: RequestUser): Promise<void> => {
  const user = await User.findOne({
    where: { id }
  });

  if (!user) {
    throw new AppError("ERR_NO_USER_FOUND", 404);
  }

  if (user.profile === "superadmin" && user.id.toString() !== requestUser.id.toString()) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const userOpenTickets: Ticket[] = await user.$get("tickets", {
    where: { status: "open" }
  });

  if (userOpenTickets.length > 0) {
    UpdateDeletedUserOpenTicketsStatus(userOpenTickets);
  }

  await user.destroy();
};

export default DeleteUserService;
