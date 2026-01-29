import { Request, Response } from "express";
import { getIO } from "../libs/socket";

import CheckSettingsHelper from "../helpers/CheckSettings";
import AppError from "../errors/AppError";
import User from "../models/User";

import CreateUserService from "../services/UserServices/CreateUserService";
import ListUsersService from "../services/UserServices/ListUsersService";
import UpdateUserService from "../services/UserServices/UpdateUserService";
import ShowUserService from "../services/UserServices/ShowUserService";
import DeleteUserService from "../services/UserServices/DeleteUserService";
import ToggleUserStatusService from "../services/UserServices/ToggleUserStatusService";
import ResendWelcomeEmailService from "../services/UserServices/ResendWelcomeEmailService";
import SendPasswordResetEmailService from "../services/UserServices/SendPasswordResetEmailService";
import ResetPasswordService from "../services/UserServices/ResetPasswordService";
import VerifyEmailService from "../services/UserServices/VerifyEmailService";
import CompleteRegistrationService from "../services/UserServices/CompleteRegistrationService";

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { searchParam, pageNumber } = req.query as IndexQuery;
  const { tenantId } = req.user;

  const { users, count, hasMore } = await ListUsersService({
    searchParam,
    pageNumber,
    tenantId
  });

  return res.json({ users, count, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { email, password, name, queueIds, whatsappId, groupIds, groupId } = req.body;

  if (
    req.url === "/signup" &&
    (await CheckSettingsHelper("userCreation")) === "disabled"
  ) {
    throw new AppError("ERR_USER_CREATION_DISABLED", 403);
  }

  const user = await CreateUserService({
    email,
    password,
    name,

    queueIds,
    whatsappId,
    groupIds,
    groupId,

    tenantId: req.user?.tenantId || undefined
  });

  const io = getIO();
  io.emit("user", {
    action: "create",
    user
  });

  return res.status(200).json(user);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { userId } = req.params;

  const user = await ShowUserService(userId);

  return res.status(200).json(user);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {


  const { userId } = req.params;
  const userData = req.body;

  const profileImage = req.file?.filename;

  const { permissions: _, ...cleanUserData } = userData;
  const user = await UpdateUserService({ userData: { ...cleanUserData, profileImage }, userId, requestUser: req.user });

  const io = getIO();
  io.emit("user", {
    action: "update",
    user
  });

  return res.status(200).json(user);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { userId } = req.params;



  await DeleteUserService(userId, req.user);

  const io = getIO();
  io.emit("user", {
    action: "delete",
    userId
  });

  return res.status(200).json({ message: "User deleted" });
};

export const toggleStatus = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { userId } = req.params;



  const user = await ToggleUserStatusService(userId);

  const io = getIO();
  io.emit("user", {
    action: "update",
    user
  });

  return res.status(200).json(user);
};

export const resendWelcomeEmail = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { userId } = req.params;



  // Use the new service to send a password reset link instead of credentials
  const user = await ShowUserService(userId);
  const appUrl = process.env.FRONTEND_URL || "http://localhost:3000";

  await SendPasswordResetEmailService(user.email, appUrl);

  return res.status(200).json({ message: "Email sent successfully" });
};

export const forgotPassword = async (req: Request, res: Response): Promise<Response> => {
  const { email } = req.body;
  const appUrl = process.env.FRONTEND_URL || "http://localhost:3000";

  await SendPasswordResetEmailService(email, appUrl);

  return res.status(200).json({ message: "Email sent successfully" });
};

export const resetPassword = async (req: Request, res: Response): Promise<Response> => {
  const { token, password } = req.body;

  await ResetPasswordService({ token, password });

  return res.status(200).json({ message: "Password updated successfully" });
};

export const verifyEmail = async (req: Request, res: Response): Promise<Response> => {
  const { token } = req.params;
  const user = await VerifyEmailService(token);
  return res.status(200).json(user);
};

export const completeRegistration = async (req: Request, res: Response): Promise<Response> => {
  const { token, password } = req.body;
  const user = await CompleteRegistrationService({ token, password });
  return res.status(200).json(user);
};

export const manualVerify = async (req: Request, res: Response): Promise<Response> => {
  const { userId } = req.params;



  const user = await User.findByPk(userId);
  if (!user) {
    throw new AppError("ERR_NO_USER_FOUND", 404);
  }

  await user.update({ emailVerified: true });

  const io = getIO();
  io.emit("user", {
    action: "update",
    user
  });

  return res.status(200).json(user);
};
