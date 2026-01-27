import AppError from "../../errors/AppError";
import User from "../../models/User";
import SendPasswordResetEmailService from "./SendPasswordResetEmailService";

const VerifyEmailService = async (token: string): Promise<User> => {
    const user = await User.findOne({ where: { verificationToken: token } });

    if (!user) {
        throw new AppError("ERR_INVALID_TOKEN", 400);
    }

    await user.update({
        emailVerified: true,
        verificationToken: null // Consume token
    });

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    try {
        await SendPasswordResetEmailService(user.email, frontendUrl);
    } catch (err) {
        console.error("Failed to send password set email after verification", err);
    }

    return user;
};

export default VerifyEmailService;
