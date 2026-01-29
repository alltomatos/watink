declare namespace Express {
  export interface Request {
    user: { id: string; tenantId: string; profile?: string };
  }
}
