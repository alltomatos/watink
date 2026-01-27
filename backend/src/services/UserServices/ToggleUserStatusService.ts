import User from "../../models/User";
import AppError from "../../errors/AppError";
import { SerializeUser } from "../../helpers/SerializeUser";

const ToggleUserStatusService = async (userId: string): Promise<any> => {
    const user = await User.findByPk(userId);

    if (!user) {
        throw new AppError("ERR_USER_NOT_FOUND", 404);
    }

    // Toggle the enabled status
    user.enabled = !user.enabled;
    await user.save();

    return SerializeUser(user);
};

export default ToggleUserStatusService;
