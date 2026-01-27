import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import User from "../../models/User";
import { hash } from "bcryptjs";

interface Request {
    token: string;
    password: string;
}

const ResetPasswordService = async ({ token, password }: Request): Promise<void> => {
    const user = await User.findOne({
        where: {
            passwordResetToken: token,
            passwordResetExpires: {
                [Op.gt]: new Date() // Check if expiration is greater than now
            }
        }
    });

    if (!user) {
        throw new AppError("ERR_INVALID_OR_EXPIRED_TOKEN", 400);
    }

    const passwordHash = await hash(password, 8);

    await user.update({
        passwordHash, // Save hashed password directly or use instance.password = password if hook handles it
        emailVerified: true, // Auto-verify email on successful reset
        passwordResetToken: null,
        passwordResetExpires: null
    });
};

export default ResetPasswordService;
