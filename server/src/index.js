import { createApp } from './app.js';

const PORT = Number(process.env.PORT) || 4000;

// Local development only: a fixed fallback so the server starts without any
// setup. Set JWT_SECRET yourself for anything that is not a local demo.
if (process.env.NODE_ENV !== 'production') {
  process.env.JWT_SECRET ??= 'queuesmart-dev-secret-change-me';
}

// Listen on every network interface so a phone on the same Wi-Fi can reach it.
createApp().listen(PORT, '0.0.0.0', () => {
  console.log(`QueueSmart API listening on http://localhost:${PORT}`);
});
