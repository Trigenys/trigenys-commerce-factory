# Cinematic Product Story — original concept / experimental route

- URL: `/labs/cinematic-product-story`, available from the public theme library. No real merchant, checkout or published theme is affected.
- Built with original React/CSS. Inspired by visual storytelling principles, **not copied** from FizziFresh, David Heckhoff or other external sources.
- Uses three self-hosted fictional product images already documented in `public/themes/README.md`. All CTAs open existing showroom themes. No sales claims or placeholder WhatsApp links.
- Three manually selectable art directions; native button controls; EN/FR; reduced-motion CSS fallback; pointer effect only for mouse devices; no new runtime or third-party package.
- AppFactory WOW research is tracked separately. This experiment is NOT yet a production merchant theme and deliberately does not change shared theme IDs or the DB constraint.

## Approval checklist

Run `npm run typecheck && npm run build && npm run test:cinematic-lab && npm run test:themes && npm run test:journeys && npm run test:motion-brand`. Inspect real screenshots at desktop 1440 and mobile 390/320; inspect performance, keyboard and reduced motion. No production activation without editorial visual review and a backwards-compatible tenant migration plan.
