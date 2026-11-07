import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as authApi from '../../api/auth';
import {
  ApiError,
  clearAuthToken,
  persistAuthToken,
  restoreAuthToken,
  setAuthToken,
} from '../../api/client';
import * as historyApi from '../../api/history';
import * as notificationsApi from '../../api/notifications';
import * as queueApi from '../../api/queue';
import * as servicesApi from '../../api/services';

/**
 * Shared front-end state, so every screen renders from the same copy.
 *
 * Service Management and the Admin Dashboard come from the QueueSmart
 * server: visit types (with live waiting counts) and today's statistics are
 * read on start, after every change, and every few seconds. The patient's
 * check-in and the front desk line come from the queue API the same way;
 * a front desk line is only read while its screen is open (watchLine).
 *
 * The patient's visit history and notifications are read the same way
 * (docs/A4-database-design.txt).
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
  const [servicesLoaded, setServicesLoaded] = useState(false);
  const [patient, setPatientState] = useState(emptyPatient);
  const [role, setRole] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authRestoreError, setAuthRestoreError] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoaded, setNotificationsLoaded] = useState(false);
  const [notificationsError, setNotificationsError] = useState(null);
  const [activeQueue, setActiveQueue] = useState(null);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueError, setQueueError] = useState(null);
  // Front desk lines by service id: { called, waiting }.
  const [lines, setLines] = useState({});
  const watchedLines = useRef(new Set());

  // Forget the signed-in account and everything loaded for it.
  const signOut = useCallback(() => {
    setAuthToken(null);
    void clearAuthToken().catch(() => {});
    setRole(null);
    setAuthReady(true);
    setAuthRestoreError(null);
    setPatientState(emptyPatient);
    setActiveQueue(null);
    setQueueLoading(true);
    setQueueError(null);
    setStats(null);
    setServicesLoaded(false);
    setHistory([]);
    setHistoryLoaded(false);
    setHistoryError(null);
    setNotifications([]);
    setNotificationsLoaded(false);
    setNotificationsError(null);
    setLines({});
  }, []);

  // An expired or rejected token ends the session.
  const lostSession = useCallback(
    (error) => {
      if (error instanceof ApiError && error.code === 'unauthenticated') signOut();
    },
    [signOut]
  );

  const restoreSession = useCallback(async () => {
    setAuthReady(false);
    setAuthRestoreError(null);
    try {
      const token = await restoreAuthToken();
      if (!token) return;

      const user = await authApi.getMe();
      setPatientState({ name: user.name, dob: user.dob ?? '', email: user.email });
      setRole(user.role);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'unauthenticated') {
        await clearAuthToken().catch(() => {});
        setPatientState(emptyPatient);
        setRole(null);
      } else {
        setAuthRestoreError(error.message ?? 'Could not restore your session.');
      }
    } finally {
      setAuthReady(true);
    }
  }, []);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

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
      setServicesLoaded(true);
    } catch (error) {
      lostSession(error);
      setConnectionError(error.message);
      setServicesLoaded(true);
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

  // A failed read keeps the last line on screen; refresh() already reports
  // a server that can't be reached.
  const refreshLine = useCallback(async (serviceId) => {
    try {
      const line = await queueApi.getLine(serviceId);
      setLines((current) => ({ ...current, [serviceId]: line }));
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      lostSession(error);
    }
  }, [lostSession]);

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

  const refreshHistory = useCallback(async () => {
    try {
      setHistory(await historyApi.listMine());
      setHistoryError(null);
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      lostSession(error);
      setHistoryError(error.message);
    } finally {
      setHistoryLoaded(true);
    }
  }, [lostSession]);

  const refreshNotifications = useCallback(async () => {
    try {
      setNotifications(await notificationsApi.listMine());
      setNotificationsLoaded(true);
      setNotificationsError(null);
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      lostSession(error);
      setNotificationsError(error.message);
      setNotificationsLoaded(true);
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
        refreshNotifications();
      }
      if (role === 'admin') refreshLines();
    };

    poll();
    const timer = setInterval(poll, POLL_MS);

    return () => clearInterval(timer);
  }, [refresh, refreshHistory, refreshLines, refreshMyQueue, refreshNotifications, role]);

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

        await persistAuthToken(token);
        setPatientState({ name: user.name, dob: user.dob ?? '', email: user.email });
        setRole(user.role);
        return { user };
      } catch (error) {
        if (error instanceof ApiError) return asFailure(error);
        return { error: 'session-storage', message: 'Could not securely save your session. Please try signing in again.' };
      }
    }

    return {
      connectionError,
      servicesLoaded,
      refresh,
      authReady,
      authRestoreError,
      restoreSession,

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
          await Promise.all([refresh(), refreshNotifications()]);

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
      historyLoaded,
      historyError,
      refreshHistory,

      // Connected to /notifications. Marking is shown at once and then saved;
      // the next read puts back anything the server did not accept.
      notifications,
      notificationsLoaded,
      notificationsError,
      refreshNotifications,
      markNotificationRead: async (id) => {
        setNotifications((current) =>
          current.map((item) => (item.id === id ? { ...item, read: true } : item))
        );
        try {
          await notificationsApi.markRead(id);
        } catch (error) {
          if (!(error instanceof ApiError)) throw error;
          lostSession(error);
        }
        await refreshNotifications();
      },
      markAllNotificationsRead: async () => {
        setNotifications((current) => current.map((item) => ({ ...item, read: true })));
        try {
          await notificationsApi.markAllRead();
        } catch (error) {
          if (!(error instanceof ApiError)) throw error;
          lostSession(error);
        }
        await refreshNotifications();
      },

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
  }, [
    activeQueue,
    connectionError,
    servicesLoaded,
    authReady,
    authRestoreError,
    history,
    historyLoaded,
    historyError,
    lines,
    lostSession,
    notifications,
    notificationsLoaded,
    notificationsError,
    patient,
    queueError,
    queueLoading,
    refresh,
    refreshHistory,
    refreshLines,
    refreshMyQueue,
    refreshNotifications,
    role,
    services,
    signOut,
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
