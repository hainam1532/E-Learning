# Frontend Build Environments

Frontend uses Vite mode-based env files:

- `.env.production`: deploy domain chinh thuc, app chay duoi `/e+/`
- `.env.test`: deploy test noi bo qua IP

## Env Variables

- `VITE_BASE_PATH`: Vite asset base path
- `VITE_ROUTER_BASENAME`: React Router basename
- `VITE_API_URL`: backend API URL

## Build Commands

- `npm run build:prod`
  - mode: `production`
  - env file: `.env.production`
  - expected base path: `/e+/`

- `npm run build:test`
  - mode: `test`
  - env file: `.env.test`
  - expected base path: `/`

- `npm run build`
  - alias of `npm run build:prod`

## Notes

- Update `VITE_API_URL` in both env files to the real domain/IP before deploying.
- If backend is reverse-proxied under the same domain, keep API URL consistent with server routing.
