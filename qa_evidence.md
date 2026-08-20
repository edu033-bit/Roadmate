# QA Evidence

## Browser smoke check — 2026-08-20

The public dashboard was loaded in a browser using the managed development URL. The browser rendered the plan form, the insufficient-evidence safety state, the recommended departure window, and all three fallback route candidates without a blank state. The observed fallback content matches the expected safety behavior when live weather or road evidence is unavailable.

## API smoke check

Direct tRPC probes returned a structured `plan.summary` response with fallback mode and normalized source failures, and `plan.options` returned the required balanced, fastest, and lowest-cost candidates. Unit, type, and production build verification results are recorded in the task log.

The browser performance resource list also contained one batched request to `/api/trpc/plan.summary,plan.options`, with both serialized plan inputs. This confirms that the client-side tRPC hooks issue the expected summary and options request in the running app.

## Visual coverage

Mobile screenshots verified dashboard, route comparison, in-trip, navigation modal, evidence drawer, insufficient-evidence, and high-risk presentations. Desktop screenshots verified the dashboard, route comparison, high-risk call to action, centered navigation modal, and full-width evidence drawer for responsive layout and readable content hierarchy.
