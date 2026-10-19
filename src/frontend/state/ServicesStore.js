import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ApiError } from '../../api/client';
import * as servicesApi from '../../api/services';

/**
 * Shared front-end state, so every screen renders from the same copy.
 *
 * Service Management and the Admin Dashboard come from the QueueSmart
 * server: visit types (with live waiting counts) and today's statistics are
 * read on start, after every change, and every few seconds.
 *
 * The patient, queue, history and notification parts are still to be
 * connected by the teammates who own them. Until then they are placeholders
 * with the same names and return shapes as A2, so their screens keep
 * working, empty. Replace them with calls to src/api/queue.js (and the
 * auth / notifications APIs) as each module lands; see docs/A3-api-spec.txt.
 */
const ServicesContext = createContext(null);

const POLL_MS = 5000;

const emptyPatient = { name: '', dob: '', email: '' };

const notConnected = (what) => ({
  error: 'not-implemented',
  message: `${what} is not connected to the server yet.`,
});

function asFailure(error) {
  return { error: error.code, message: error.message, fields: error.fields };
}

export function ServicesProvider({ children }) {
  const [services, setServices] = useState([]);
  const [stats, setStats] = useState(null);
  const [connectionError, setConnectionError] = useState(null);
  const [patient, setPatientState] = useState(emptyPatient);

  const refresh = useCallback(async () => {
    try {
      const [nextServices, nextStats] = await Promise.all([
        servicesApi.listServices(),
        servicesApi.getStats(),
      ]);
      setServices(nextServices);
      setStats(nextStats);
      setConnectionError(null);
    } catch (error) {
      setConnectionError(error.message);
    }
  }, []);

  // Load once, then keep the board current.
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const value = useMemo(() => {
    // Wraps a server call: on success re-read everything and return the
    // result; when the server says no, return { error, message, fields }.
    function change(call) {
      return async (...args) => {
        try {
          const result = await call(...args);
          await refresh();
          return result ?? {};
        } catch (error) {
          if (!(error instanceof ApiError)) throw error;
          await refresh();
          return asFailure(error);
        }
      };
    }

    return {
      connectionError,
      refresh,

      // Service management (server)
      services,
      getService: (id) => services.find((s) => s.id === id) || null,
      createService: change(servicesApi.createService),
      updateService: change(servicesApi.updateService),
      deleteService: change(servicesApi.deleteService),
      setQueueOpen: change(servicesApi.setQueueOpen),

      // Admin dashboard (server)
      stats,

      // Front desk line - queue teammate (placeholders)
      getServiceQueue: () => [],
      getCalled: () => null,
      callNext: () => notConnected('Calling patients'),
      resolveCalled: () => null,
      moveEntry: () => undefined,
      removeEntry: () => undefined,

      // Patient check-in and history - queue / history teammates (placeholders)
      activeQueue: null,
      history: [],
      checkIn: () => notConnected('Check-in'),
      cancelCheckIn: () => undefined,

      // Signed-in patient - auth teammate (kept in memory, as in A2)
      patient,
      setPatient: (next) => setPatientState({ ...emptyPatient, ...next }),
      userEmail: patient.email,
      setUserEmail: (email) => setPatientState((current) => ({ ...current, email })),
    };
  }, [connectionError, patient, refresh, services, stats]);

  return <ServicesContext.Provider value={value}>{children}</ServicesContext.Provider>;
}

export function useServices() {
  const context = useContext(ServicesContext);
  if (!context) {
    throw new Error('useServices must be used inside a ServicesProvider');
  }
  return context;
}

// The signed-in patient's check-in, and the actions that change it.
export function useQueue() {
  const { activeQueue, checkIn, cancelCheckIn } = useServices();
  return { activeQueue, checkIn, cancelCheckIn };
}
