declare module "*.mjs" {
  export const getPlanSummary: (query: URLSearchParams) => Promise<{ statusCode: number; body: unknown }>;
  export const getPlanOptions: (query: URLSearchParams) => Promise<{ statusCode: number; body: unknown }>;
}
