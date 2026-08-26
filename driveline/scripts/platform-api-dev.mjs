import express from 'express';
import { registerPlatformRoutes } from '../platform/routes.mjs';

const app = express();
app.use(express.json({ limit: '512kb' }));
registerPlatformRoutes(app);

const port = Number(process.env.PLATFORM_API_PORT || 4001);
app.listen(port, () => {
  console.log(`DivineBytes platform API on http://localhost:${port}`);
});
