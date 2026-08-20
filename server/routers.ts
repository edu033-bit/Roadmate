import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { defaultVehicleSpecs, type PlanInput, type VehiclePreset } from "@shared/planner";
import { createPlan } from "./plannerService";

const planInputSchema = z.object({
  origin: z.string().trim().min(1).max(80),
  destination: z.string().trim().min(1).max(80),
  arrivalTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  workload: z.enum(["busy", "relaxed"]),
  vehiclePreset: z.enum(["two-axle", "three-axle", "special"]),
  vehicle: z.object({
    lengthM: z.number().positive().max(30),
    widthM: z.number().positive().max(5),
    heightM: z.number().positive().max(6),
    weightTons: z.number().positive().max(100),
    axleLoadTons: z.number().positive().max(30),
    fuelEfficiencyKmPerL: z.number().positive().max(20),
    hazmat: z.boolean(),
  }).optional(),
});

const normalizePlanInput = (raw: z.infer<typeof planInputSchema>): PlanInput => {
  const vehiclePreset = raw.vehiclePreset as VehiclePreset;
  return { ...raw, vehiclePreset, vehicle: raw.vehicle ?? defaultVehicleSpecs(vehiclePreset) };
};

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  plan: router({
    summary: publicProcedure.input(planInputSchema).query(async ({ input }) => (await createPlan(normalizePlanInput(input))).summary),
    options: publicProcedure.input(planInputSchema).query(async ({ input }) => (await createPlan(normalizePlanInput(input))).options),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
