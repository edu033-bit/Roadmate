import type { Express } from "express";

type OriginalPlanModule = {
  getPlanSummary: (query: URLSearchParams) => Promise<{ statusCode: number; body: unknown }>;
  getPlanOptions: (query: URLSearchParams) => Promise<{ statusCode: number; body: unknown }>;
};

const unavailable = (message: string) => ({
  status: "insufficient",
  reason: "insufficient_evidence",
  message,
});

export async function registerOriginalPlannerRoutes(app: Express) {
  const original = await import("./original-backend/api/plan.mjs") as OriginalPlanModule;
  const register = (path: string, handler: OriginalPlanModule["getPlanSummary"]) => {
    app.get(path, async (req, res) => {
      try {
        const query = new URLSearchParams(req.originalUrl.split("?")[1] ?? "");
        const result = await handler(query);
        res.status(result.statusCode).set("Cache-Control", "no-store").json(result.body);
      } catch {
        res.status(503).set("Cache-Control", "no-store").json(unavailable("원본 운행 계획 데이터 조회에 실패했습니다. 화면 대체 후보를 확인하세요."));
      }
    });
  };

  register("/api/plan/summary", original.getPlanSummary);
  register("/api/plan/options", original.getPlanOptions);
}
