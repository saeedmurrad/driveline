# Platform seed data

`platform.snapshot.json` is the **committed DriveLine-ready database** shipped with the app:

- **DriveLine** dealer (`drivelinecarsales.co.uk`, Fengate address, branding)
- **63 vehicles** (from `src/app/data/vehicles.data.ts` / `npm run sync:stock`)
- **7 reviews**, demo/acme dealers for multi-tenant testing, Hub users

On first API/SSR start, if `data/platform/platform.json` does not exist, the store copies this snapshot into the runtime file.

## Refresh after stock sync

```bash
npm run sync:stock
npm run export:platform-snapshot
```

Commit the updated `platform.snapshot.json`.

## Hub logins (seed)

| Email | Password | Role |
|-------|----------|------|
| `driveline@divinebytes.local` | `driveline123` | DriveLine admin |
| `demo@divinebytes.local` | `demo123` | Demo Motors |
| `admin@divinebytes.local` | `admin123` | Platform admin |
