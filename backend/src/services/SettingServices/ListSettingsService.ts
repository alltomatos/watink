import Setting from "../../models/Setting";

interface Request {
  tenantId?: number | string;
}

const ListSettingsService = async (params?: Request): Promise<Setting[] | undefined> => {
  const whereCondition: any = params?.tenantId ? { tenantId: params.tenantId } : {};

  const settings = await Setting.findAll({
    where: whereCondition
  });

  return settings;
};

export default ListSettingsService;
