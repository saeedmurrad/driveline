/**
 * Dev-only proxy: keeps your DVLA `x-api-key` off the browser bundle.
 *
 * Usage:
 *   export DVLA_API_KEY="your-key-from-dvla-developer-portal"
 *   npm start
 *
 * @see https://developer-portal.driver-vehicle-licensing.api.gov.uk/
 */
const DVLA_API_KEY = process.env.DVLA_API_KEY || '';

module.exports = {
  '/api/dvla-vehicle': {
    target: 'https://driver-vehicle-licensing.api.gov.uk',
    secure: true,
    changeOrigin: true,
    pathRewrite: {
      '^/api/dvla-vehicle': '/vehicle-enquiry/v1/vehicles',
    },
    onProxyReq: (proxyReq) => {
      if (DVLA_API_KEY) {
        proxyReq.setHeader('x-api-key', DVLA_API_KEY);
      }
      proxyReq.setHeader('Content-Type', 'application/json');
      proxyReq.setHeader('Accept', 'application/json');
    },
    logLevel: 'warn',
  },
};
