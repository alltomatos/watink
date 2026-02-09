import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import AppError from "../../errors/AppError";
import { logger } from "../../utils/logger";

interface CreateTenantPayload {
  name: string;
  plan: string;
  status: string;
  externalId: string;
  maxUsers: number;
  maxConnections: number;
}

class WatinkGuardProxy {
  private api: AxiosInstance;

  constructor() {
    const baseURL = process.env.WATINK_GUARD_URL || "http://watink-guard:8081";
    const masterKey = process.env.WATINK_MASTER_KEY;

    if (!masterKey) {
      logger.error("WATINK_MASTER_KEY is not defined in environment variables.");
    }

    this.api = axios.create({
      baseURL,
      headers: {
        "Content-Type": "application/json",
        "X-Watink-Master-Key": masterKey || ""
      },
      timeout: 10000 // 10 seconds timeout
    });
  }

  public async createTenant(payload: CreateTenantPayload): Promise<any> {
    try {
      const response = await this.api.post("/manage/v1/tenants", payload);
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  public async getUsage(): Promise<any> {
    try {
      const response = await this.api.get("/manage/v1/usage");
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  private handleError(error: any): void {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status || 500;
      const message = error.response?.data?.error || error.message || "Unknown error from Watink Guard";
      
      logger.error(`WatinkGuardProxy Error: [${status}] ${message}`);
      
      throw new AppError(message, status);
    } else {
      logger.error(`WatinkGuardProxy Unexpected Error: ${error}`);
      throw new AppError("Internal Server Error while communicating with Guard Service", 500);
    }
  }
}

export default new WatinkGuardProxy();
