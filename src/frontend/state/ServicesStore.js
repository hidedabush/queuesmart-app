import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from '../../api/client';
import * as servicesApi from '../../api/services';
import * as queueApi from '../../api/queue';

/**
 * Shared front-end state, so every screen renders from the same copy.
 *
 * Service Management and the Admin Dashboard come from the QueueSmart
 * server: visit types (with live waiting counts) and today's statistics are
 * read on start, after every change, and every few seconds. The patient's
 * check-in and the front desk line come from the queue API the same way;
 * a front desk line is only read while its screen is open (watchLine).
 *
 * The patient, history and notification parts are still to be connected by
 * the teammates who own them. Until then they are placeholders with the
 * same names and return shapes as A2, so their screens keep working, empty.
 * Replace them as each module lands; see docs/A3-api-spec.txt.
 */
const ServicesContext = createContext(null);

const POLL_MS = 5000;

const emptyPatient = { name: '', dob: '', email: '' };

function asFailure(error) {
  return { error: error.code, message: error.message, fields: error.fields };
}

export function ServicesProvider({ children }) {
  const [services, setServices] = useState([]);
  const [stats, setStats] = useState(null);
  const [connectionError, setConnectionError] = useState(null);
  const [patient, setPatientState] = useState(emptyPatient);
  const [activeQueue, setActiveQueue] = useState(null);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueError, setQueueError] = useState(null);
  // Front desk lines by service id: { called, waiting }.
  const [lines, setLines] = useState({});
  const watchedLines = useRef(new Set());

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

  const refreshMyQueue = useCallback(async () => {
    setQueueLoading(true);

    try {
      const entry = await queueApi.getMyQueue();
      setActiveQueue(entry);
      setQueueError(null);
      return entry;
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;

      setQueueError(error.message);
      return asFailure(error);
    } finally {
      setQueueLoading(false);
    }
  }, []);

  // A failed read keeps the last line on screen; refresh() already reports
  // a server that can't be reached.
  const refreshLine = useCallback(async (serviceId) => {
    try {
      const line = await queueApi.getLine(serviceId);
      setLines((current) => ({ ...current, [serviceId]: line }));
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
    }
  }, []);

  const refreshLines = useCallback(
    () => Promise.all([...watchedLines.current].map(refreshLine)),
    [refreshLine]
  );

  // The front desk screen calls this on mount; the returned function stops
  // polling that line when the screen closes.
  const watchLine = useCallback(
    (serviceId) => {
      watchedLines.current.add(serviceId);
      refreshLine(serviceId);
      return () => watchedLines.current.delete(serviceId);
    },
    [refreshLine]
  );

  // Load once, then keep the board current.
  useEffect(() => {
    refresh();
    refreshMyQueue();

    const timer = setInterval(() => {
      refresh();
      refreshMyQueue();
      refreshLines();
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [refresh, refreshLines, refreshMyQueue]);

  const value = useMemo(() => {
    // Wraps a server call: on success re-read everything and return the
    // result; when the server says no, return { error, message, fields }.
    function change(call) {
      return async (...args) => {
        try {
          const result = await call(...args);
          await Promise.all([refresh(), refreshLines()]);
          return result ?? {};
        } catch (error) {
          if (!(error instanceof ApiError)) throw error;
          await Promise.all([refresh(), refreshLines()]);
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

      // Front desk line (server)
      watchLine,
      getServiceQueue: (serviceId) => lines[serviceId]?.waiting ?? [],
      getCalled: (serviceId) => lines[serviceId]?.called ?? null,
      callNext: change(async (serviceId) => ({ entry: await queueApi.callNext(serviceId) })),
      resolveCalled: change(queueApi.resolveCalled),
      moveEntry: change((serviceId, entryId, direction) => queueApi.moveEntry(entryId, direction)),
      removeEntry: change(queueApi.removeEntry),

      // Patient check-in: connected to the A3 patient queue API.
      activeQueue,
      queueLoading,
      queueError,
      refreshMyQueue,

      checkIn: async (serviceId, reason) => {
        try {
          const entry = await queueApi.checkIn(serviceId, reason);

          setActiveQueue(entry);
          setQueueError(null);
          await refresh();

          return entry;
        } catch (error) {
          if (!(error instanceof ApiError)) throw error;
          return asFailure(error);
        }
      },

      cancelCheckIn: async () => {
        try {
          await queueApi.cancelCheckIn();

          setActiveQueue(null);
          setQueueError(null);
          await refresh();

          return {};
        } catch (error) {
          if (!(error instanceof ApiError)) throw error;
          return asFailure(error);
        }
      },

      // History remains owned by the history teammate.
      history: [],

      // Signed-in patient - auth teammate (kept in memory, as in A2)
      patient,
      setPatient: (next) => setPatientState({ ...emptyPatient, ...next }),
      userEmail: patient.email,
      setUserEmail: (email) => setPatientState((current) => ({ ...current, email })),
    };
  }, [
    activeQueue,
    connectionError,
    lines,
    patient,
    queueError,
    queueLoading,
    refresh,
    refreshLines,
    refreshMyQueue,
    services,
    stats,
    watchLine,
  ]);

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
  const { activeQueue, queueLoading, queueError, refreshMyQueue, checkIn, cancelCheckIn } = useServices();
  return { activeQueue, queueLoading, queueError, refreshMyQueue, checkIn, cancelCheckIn };
}
