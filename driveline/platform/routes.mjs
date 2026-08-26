import {
  addEnquiry,
  authenticateUser,
  createDealer,
  createSessionToken,
  deleteVehicle,
  getDealerById,
  getDealerBySlug,
  getUserByToken,
  getVehicle,
  listDealers,
  listEnquiries,
  listReviews,
  listVehicles,
  resolveDealerSlugFromRequest,
  upsertDealer,
  upsertVehicle,
} from './store.mjs';

/**
 * @param {import('express').Request} req
 */
function getBearer(req) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7).trim();
  return null;
}

/**
 * @param {import('express').Request} req
 * @param {string|null} [dealerId]
 */
function requireAuth(req, res, dealerId = null) {
  const token = getBearer(req);
  const user = getUserByToken(token);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  if (dealerId && user.role !== 'platform_admin' && user.dealerId !== dealerId) {
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }
  return user;
}

/**
 * Register DivineBytes platform API on an Express app.
 * @param {import('express').Express} app
 */
export function registerPlatformRoutes(app) {
  /** Public: resolve tenant + profile */
  app.get('/api/public/dealer', (req, res) => {
    const slug = resolveDealerSlugFromRequest(req);
    const dealer = getDealerBySlug(slug);
    if (!dealer) {
      res.status(404).json({ error: 'Dealer not found', slug });
      return;
    }
    const reviews = listReviews(dealer.id).map(({ dealerId: _, ...r }) => r);
    res.json({ dealer, reviews });
  });

  /** Public: live stock for tenant */
  app.get('/api/public/vehicles', (req, res) => {
    const slug = resolveDealerSlugFromRequest(req);
    const dealer = getDealerBySlug(slug);
    if (!dealer) {
      res.status(404).json({ error: 'Dealer not found' });
      return;
    }
    const vehicles = listVehicles(dealer.id, false).map(
      ({ dealerId: _, status: __, ...v }) => v,
    );
    res.json({ vehicles });
  });

  app.get('/api/public/vehicles/:id', (req, res) => {
    const slug = resolveDealerSlugFromRequest(req);
    const dealer = getDealerBySlug(slug);
    if (!dealer) {
      res.status(404).json({ error: 'Dealer not found' });
      return;
    }
    const v = getVehicle(dealer.id, req.params.id);
    if (!v || (v.status !== 'live' && v.status !== 'reserved')) {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }
    const { dealerId: _, ...pub } = v;
    res.json(pub);
  });

  /** Public: submit enquiry */
  app.post('/api/public/enquiries', (req, res) => {
    const slug = resolveDealerSlugFromRequest(req);
    const dealer = getDealerBySlug(slug);
    if (!dealer) {
      res.status(404).json({ error: 'Dealer not found' });
      return;
    }
    const { type, subject, payload, vehicleId } = req.body || {};
    if (!type || !subject) {
      res.status(400).json({ error: 'type and subject required' });
      return;
    }
    const record = addEnquiry({
      dealerId: dealer.id,
      type,
      subject,
      payload: payload || {},
      vehicleId: vehicleId || undefined,
    });
    res.status(201).json({ id: record.id, ok: true });
  });

  /** Hub auth (dev: plain password in store; replace with Firebase Auth in production) */
  app.post('/api/hub/login', (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      res.status(400).json({ error: 'email and password required' });
      return;
    }
    const user = authenticateUser(email, password);
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    res.json({ token: createSessionToken(user), user });
  });

  app.get('/api/hub/me', (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    res.json({ user });
  });

  app.get('/api/hub/dealers', (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    if (user.role !== 'platform_admin') {
      const d = getDealerById(user.dealerId);
      res.json({ dealers: d ? [d] : [] });
      return;
    }
    res.json({ dealers: listDealers() });
  });

  app.post('/api/hub/dealers', (req, res) => {
    const user = requireAuth(req, res);
    if (!user || user.role !== 'platform_admin') {
      if (!user) return;
      res.status(403).json({ error: 'Platform admin only' });
      return;
    }
    const { slug, name, email, town } = req.body || {};
    if (!slug || !name || !email) {
      res.status(400).json({ error: 'slug, name, email required' });
      return;
    }
    if (getDealerBySlug(slug)) {
      res.status(409).json({ error: 'Slug already exists' });
      return;
    }
    const dealer = createDealer({
      slug: String(slug).toLowerCase(),
      name,
      business: {
        name,
        tagline: '',
        address: {
          line1: '',
          line2: '',
          town: town || '',
          county: '',
          postcode: '',
        },
        phone: '',
        mobile: '',
        email,
        openingHours: [],
        bankHolidayNote: '',
      },
    });
    res.status(201).json({ dealer });
  });

  app.patch('/api/hub/dealers/:dealerId', (req, res) => {
    const dealerId = req.params.dealerId;
    const user = requireAuth(req, res, dealerId);
    if (!user) return;
    const existing = getDealerById(dealerId);
    if (!existing) {
      res.status(404).json({ error: 'Dealer not found' });
      return;
    }
    const updated = upsertDealer({ ...existing, ...req.body, id: dealerId });
    res.json({ dealer: updated });
  });

  app.get('/api/hub/dealers/:dealerId/vehicles', (req, res) => {
    const dealerId = req.params.dealerId;
    const user = requireAuth(req, res, dealerId);
    if (!user) return;
    res.json({ vehicles: listVehicles(dealerId, true) });
  });

  app.post('/api/hub/dealers/:dealerId/vehicles', (req, res) => {
    const dealerId = req.params.dealerId;
    const user = requireAuth(req, res, dealerId);
    if (!user) return;
    const body = req.body || {};
    const id = body.id || `v_${Date.now()}`;
    const vehicle = upsertVehicle({
      ...body,
      id,
      dealerId,
      status: body.status || 'draft',
      dateAdded: body.dateAdded || new Date().toISOString().slice(0, 10),
    });
    res.status(201).json({ vehicle });
  });

  app.patch('/api/hub/dealers/:dealerId/vehicles/:vehicleId', (req, res) => {
    const { dealerId, vehicleId } = req.params;
    const user = requireAuth(req, res, dealerId);
    if (!user) return;
    const existing = getVehicle(dealerId, vehicleId);
    if (!existing) {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }
    const vehicle = upsertVehicle({ ...existing, ...req.body, dealerId, id: vehicleId });
    res.json({ vehicle });
  });

  app.delete('/api/hub/dealers/:dealerId/vehicles/:vehicleId', (req, res) => {
    const { dealerId, vehicleId } = req.params;
    const user = requireAuth(req, res, dealerId);
    if (!user) return;
    deleteVehicle(dealerId, vehicleId);
    res.json({ ok: true });
  });

  app.get('/api/hub/dealers/:dealerId/enquiries', (req, res) => {
    const dealerId = req.params.dealerId;
    const user = requireAuth(req, res, dealerId);
    if (!user) return;
    res.json({ enquiries: listEnquiries(dealerId) });
  });
}
