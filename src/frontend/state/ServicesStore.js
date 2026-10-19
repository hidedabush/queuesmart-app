import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as authApi from '../../api/auth';
import { ApiError, setToken } from '../../api/client';
import * as notificationsApi from '../../api/notifications';
import * as queueApi from '../../api/queue';
import * as servicesApi from '../../api/services';

/**
 * Shared front-end state (A3: backed by the QueueSmart server).
 *
 * Holds the signed-in user and what the server last returned, so every
 * screen renders from the same copy. After every change it reads again,
 * and while someone is signed in it reads every few seconds, so a patient
 * sees their place move when the front desk serves the next person on
 * another device.
 *
 * Screens never import src/api/ for data themselves; they use the hooks
 * below. Actions resolve to the server's data, or to
 * { error, message, fields } when the server said no, so screens can show
 * the reason without try/catch.
 */
const ServicesContext = createContext(null);

const POLL_MS = 5000;

const emptyData = {
  services: [],
  lines: {},
  stats: null,
  activeQueue: null,
  history: [],
  notifications: [],
  unread: 0,
};

const emptyPatient = { name: '', dob: '', email: '', phone: null };

// Everything the signed-in user's screens show. Staff and patients need
// different things, so each only asks for its own.
async function readAll(user) {
  const services = await servicesApi.listServices();

  if (user.role === 'admin') {
    const [lineList, stats] = await Promise.all([
      Promise.all(services.map((service) => queueApi.getLine(service.id))),
      servicesApi.getStats(),
    ]);
    const lines = {};
    services.forEach((service, index) => {
      lines[service.id] = lineList[index];
    });
    return { ...emptyData, services, lines, stats };
  }

  const [activeQueue, history, inbox] = await Promise.all([
    queueApi.getActiveQueue(),
    queueApi.listVisitHistory(),
    notificationsApi.listNotifications(),
  ]);
  return {
    ...emptyData,
    services,
    activeQueue,
    history,
    notifications: inbox.notifications,
    unread: inbox.unread,
  };
}

function asFailure(error) {
  return { error: error.code, message: error.message, fields: error.fields };
}

export function ServicesProvider({ children }) {
  const [user, setUser] = useState(null);
  const [data, setData] = useState(emptyData);
  const [connectionError, setConnectionError] = useState(null);
  // The user a read was started for, so a late answer after logout is ignored.
  const userRef = useRef(null);

  const signOut = useCallback(() => {
    setToken(null);
    userRef.current = null;
    setUser(null);
    setData(emptyData);
  }, []);

  const refresh = useCallback(async () => {
    const current = userRef.current;
    if (!current) return;
    try {
      const next = await readAll(current);
      if (userRef.current === current) {
        setData(next);
        setConnectionError(null);
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) signOut();
      else setConnectionError(error.message);
    }
  }, [signOut]);

  // Keep the screens current while someone is signed in.
  useEffect(() => {
    if (!user) return undefined;
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [user, refresh]);

  const value = useMemo(() => {
    // Wraps an API call: on success re-read everything and return the
    // result; on a server "no", return { error, message, fields }.
    function change(call) {
      return async (...args) => {
        try {
          const result = await call(...args);
          await refresh();
          return result ?? {};
        } catch (error) {
          if (!(error instanceof ApiError)) throw error;
          if (error.status === 401) signOut();
          else await refresh();
          return asFailure(error);
        }
      };
    }

    async function login(email, password) {
      try {
        const session = await authApi.login(email, password);
        setToken(session.token);
        userRef.current = session.user;
        setUser(session.user);
        await refresh();
        return { user: session.user };
      } catch (error) {
        if (error instanceof ApiError) return asFailure(error);
        throw error;
      }
    }

    async function register(input) {
      try {
        await authApi.register(input);
      } catch (error) {
        if (error instanceof ApiError) return asFailure(error);
        throw error;
      }
      return login(input.email, input.password);
    }

    return {
      // Session
      user,
      login,
      register,
      logout: signOut,
      changePassword: change(authApi.changePassword),
      connectionError,
      refresh,

      // Visit types
      services: data.services,
      getService: (id) => data.services.find((s) => s.id === id) || null,
      createService: change(servicesApi.createService),
      updateService: change(servicesApi.updateService),
      deleteService: change(servicesApi.deleteService),
      setQueueOpen: change(servicesApi.setQueueOpen),

      // Front desk
      stats: data.stats,
      getServiceQueue: (id) => data.lines[id]?.waiting ?? [],
      getCalled: (id) => data.lines[id]?.called ?? null,
      callNext: change(queueApi.callNext),
      resolveCalled: change(queueApi.resolveCalled),
      moveEntry: change(queueApi.moveEntry),
      setEntryPriority: change(queueApi.setEntryPriority),
      removeEntry: change(queueApi.removeEntry),

      // Patient
      activeQueue: data.activeQueue,
      history: data.history,
      checkIn: change(queueApi.checkIn),
      cancelCheckIn: change(queueApi.cancelCheckIn),
      notifications: data.notifications,
      unread: data.unread,
      markNotificationRead: change(notificationsApi.markRead),
      markAllNotificationsRead: change(notificationsApi.markAllRead),

      patient: user ?? emptyPatient,
      userEmail: user?.email ?? '',
    };
  }, [connectionError, data, refresh, signOut, user]);

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

// Sign in, register and sign out.
export function useAuth() {
  const { user, login, register, logout, changePassword } = useServices();
  return { user, login, register, logout, changePassword };
}
