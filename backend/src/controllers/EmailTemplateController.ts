import * as Yup from "yup";
import { Request, Response } from "express";
import AppError from "../errors/AppError";

import CreateEmailTemplateService from "../services/EmailTemplateServices/CreateEmailTemplateService";
import ListEmailTemplatesService from "../services/EmailTemplateServices/ListEmailTemplatesService";
import ShowEmailTemplateService from "../services/EmailTemplateServices/ShowEmailTemplateService";
import UpdateEmailTemplateService from "../services/EmailTemplateServices/UpdateEmailTemplateService";
import DeleteEmailTemplateService from "../services/EmailTemplateServices/DeleteEmailTemplateService";

export const index = async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req.user;
    const templates = await ListEmailTemplatesService({ tenantId });
    return res.status(200).json(templates);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req.user;
    const data = { ...req.body, tenantId };

    const schema = Yup.object().shape({
        name: Yup.string().required(),
        subject: Yup.string().required(),
        html: Yup.string().required(),
        text: Yup.string()
    });

    try {
        await schema.validate(data);
    } catch (err) {
        throw new AppError(err.message);
    }

    const emailTemplate = await CreateEmailTemplateService(data);
    return res.status(200).json(emailTemplate);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
    const { templateId } = req.params;
    const { tenantId } = req.user;

    const emailTemplate = await ShowEmailTemplateService({ id: templateId, tenantId });
    return res.status(200).json(emailTemplate);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req.user;
    const { templateId } = req.params;
    const data = req.body;

    const schema = Yup.object().shape({
        name: Yup.string(),
        subject: Yup.string(),
        html: Yup.string(),
        text: Yup.string()
    });

    try {
        await schema.validate(data);
    } catch (err) {
        throw new AppError(err.message);
    }

    const emailTemplate = await UpdateEmailTemplateService({
        emailTemplateData: data,
        emailTemplateId: templateId,
        tenantId
    });

    return res.status(200).json(emailTemplate);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
    const { tenantId } = req.user;
    const { templateId } = req.params;

    await DeleteEmailTemplateService({ id: templateId, tenantId });
    return res.status(200).json({ message: "Email template deleted" });
};
