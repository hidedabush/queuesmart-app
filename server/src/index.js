import { createApp } from './app.js';
import { DEMO_ADMIN, DEMO_PATIENT } from './database/seed.js';

const PORT = Number(process.env.PORT) || 4000;

// Listen on every network interface so a phone on the same Wi-Fi can reach it.
createApp().listen(PORT, '0.0.0.0', () => {
  console.log(`QueueSmart API listening on http://localhost:${PORT}`);
  console.log(`Demo staff:   ${DEMO_ADMIN.email} / ${DEMO_ADMIN.password}`);
  console.log(`Demo patient: ${DEMO_PATIENT.email} / ${DEMO_PATIENT.password}`);
});
