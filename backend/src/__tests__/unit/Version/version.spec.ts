import request from "supertest";
import app from "../../../app";

describe("GET /version", () => {
  it("should return service name, version and lastUpdated", async () => {
    const res = await request(app).get("/version");
    expect(res.status).toBe(200);
    expect(res.body.service).toBe("backend");
    expect(typeof res.body.version).toBe("string");
    expect(typeof res.body.lastUpdated).toBe("string");
  });
});

