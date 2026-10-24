import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ApiError, setAuthToken } from '../../api/client';
import * as authApi from '../../api/auth';
import * as servicesApi from '../../api/services';
import * as queueApi from '../../api/queue';
import * as historyApi from '../../api/history'

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
  const [role, setRole] = useState(null);
  const [history, setHistory] = useState([]);
  const [activeQueue, setActiveQueue] = useState(null);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueError, setQueueError] = useState(null);

  // Forget the signed-in account and everything loaded for it.
  const signOut = useCallback(() => {
    setAuthToken(null);
    setRole(null);
    setPatientState(emptyPatient);
    setActiveQueue(null);
    setQueueLoading(true);
    setQueueError(null);
    setStats(null);
    setHistory([]);
  }, []);

  // An expired or rejected token ends the session.
  const lostSession = useCallback(
    (error) => {
      if (error instanceof ApiError && error.code === 'unauthenticated') signOut();
    },
    [signOut]
  );

  const refresh = useCallback(async () => {
    try {
      const [nextServices, nextStats] = await Promise.all([
        servicesApi.listServices(),
        // Statistics are admin-only; a patient would get a 403.
        role === 'admin' ? servicesApi.getStats() : Promise.resolve(null),
      ]);
      setServices(nextServices);
      setStats(nextStats);
      setConnectionError(null);
    } catch (error) {
      lostSession(error);
      setConnectionError(error.message);
    }
  }, [lostSession, role]);

  const refreshMyQueue = useCallback(async () => {
    setQueueLoading(true);

    try {
      const entry = await queueApi.getMyQueue();
      setActiveQueue(entry);
      setQueueError(null);
      return entry;
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      lostSession(error);

      setQueueError(error.message);
      return asFailure(error);
    } finally {
      setQueueLoading(false);
    }
  }, [lostSession]);

  const refreshHistory = useCallback(async () => {
    try {
      setHistory(await historyApi.listMine());
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      lostSession(error);
    }
  }, [lostSession]);

  // Load once, then keep the board current. Only after sign-in.
  useEffect(() => {
    if (!role) return undefined;

    const poll = () => {
      refresh();
      if (role === 'user') {
        refreshMyQueue();
        refreshHistory();
      }
    };

    poll();
    const timer = setInterval(poll, POLL_MS);

    return () => clearInterval(timer);
  }, [refresh, refreshHistory, refreshMyQueue, role]);

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

    // Signs in and keeps the session. `expectedRole` stops a patient from
    // using the staff screen (and the reverse) without storing a token.
    async function signIn(email, password, expectedRole) {
      try {
        const { token, user } = await authApi.login({ email, password });

        if (expectedRole && user.role !== expectedRole) {
          return {
            error: 'wrong-role',
            message:
              expectedRole === 'admin'
                ? 'This account does not have staff access.'
                : 'Staff accounts sign in from the office staff screen.',
          };
        }

        setAuthToken(token);
        setPatientState({ name: user.name, dob: user.dob ?? '', email: user.email });
        setRole(user.role);
        return { user };
      } catch (error) {
        if (!(error instanceof ApiError)) throw error;
        return asFailure(error);
      }
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
          await refreshHistory();

          return {};
        } catch (error) {
          if (!(error instanceof ApiError)) throw error;
          return asFailure(error);
        }
      },

      // Connected to GET /history/me.
      history,

      // Signed-in patient - auth teammate (kept in memory, as in A2)
      patient,
      setPatient: (next) => setPatientState({ ...emptyPatient, ...next }),
      userEmail: patient.email,
      setUserEmail: (email) => setPatientState((current) => ({ ...current, email })),

      // Auth (server)
      role,
      login: signIn,
      register: async (draft) => {
        try {
          await authApi.register(draft);
        } catch (error) {
          if (!(error instanceof ApiError)) throw error;
          return asFailure(error);
        }
        return signIn(draft.email, draft.password, 'user');
      },
      logout: signOut,
      changePassword: async (password) => {
        try {
          return await authApi.changePassword(password);
        } catch (error) {
          if (!(error instanceof ApiError)) throw error;
          return asFailure(error);
        }
      },
    };
  }, [activeQueue, connectionError, patient, queueError, queueLoading, refresh, refreshMyQueue, services, stats, role, signOut, history, refreshHistory]);

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
