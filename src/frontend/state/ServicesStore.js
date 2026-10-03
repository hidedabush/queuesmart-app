import { createContext, useContext, useMemo, useState } from 'react';
import * as queueApi from '../../api/queue';
import * as servicesApi from '../../api/services';

/**
 * Shared front-end state for Assignment 2.
 *
 * The screens need to share state: a service created on the Service
 * Management screen must appear on the Admin Dashboard, and a user joining a
 * queue must show up in that queue's waiting count. This context holds what
 * the API last returned and re-reads it after every change.
 *
 * Screens never import src/api/ for data themselves; they use the hooks
 * below, so every screen re-renders from the same copy.
 */
const ServicesContext = createContext(null);

// temporary mock-data for front-end prototype, i used our names heh
// eventually, replace this with real database-backed queue entries once the backend is connected
const teamRoster = ['Kevin', 'Jennifer', 'Nguyen', 'Bella'];

function makeQueue(service) {
  const count = Math.max(0, Number(service?.waiting ?? 0));
  return Array.from({ length: count }, (_, index) => {
    const name = teamRoster[index % teamRoster.length];
    const repeat = Math.floor(index / teamRoster.length) + 1;

    return {
      id: `${service.id}-q-${index + 1}`,
      name: teamRoster.length > 1 && repeat > 1 ? `${name} ${repeat}` : name,
    };
  });
}

function hydrateQueueState(list, previousMap = new Map()) {
  return list.map((service) => {
    const previous = previousMap.get(service.id) ?? [];
    return {
      ...service,
      queue: previous.length > 0 ? previous : makeQueue(service),
      waiting: previous.length > 0 ? previous.length : service.waiting,
    };
  });
}

export function ServicesProvider({ children }) {
  const [services, setServices] = useState(() => hydrateQueueState(servicesApi.listServices()));
  const [activeQueue, setActiveQueue] = useState(() => queueApi.getActiveQueue());
  const [userEmail, setUserEmail] = useState('');

  const value = useMemo(() => {
    function refresh() {
      const previousMap = new Map((services || []).map((service) => [service.id, service.queue ?? []]));
      setServices(hydrateQueueState(servicesApi.listServices(), previousMap));
      setActiveQueue(queueApi.getActiveQueue());
    }

    function getService(id) {
      return services.find((s) => s.id === id) || null;
    }

    function getServiceQueue(id) {
      return getService(id)?.queue ?? [];
    }

    function updateServiceQueue(id, nextQueue) {
      setServices((current) =>
        current.map((service) => {
          if (service.id !== id) return service;
          const queue = Array.isArray(nextQueue) ? nextQueue : [];
          return {
            ...service,
            queue,
            waiting: queue.length,
          };
        })
      );
    }

    function createService(draft) {
      const service = servicesApi.createService(draft);
      refresh();
      return service;
    }

    function updateService(id, draft) {
      servicesApi.updateService(id, draft);
      refresh();
    }

    function deleteService(id) {
      servicesApi.deleteService(id);
      refresh();
    }

    function setQueueOpen(id, isOpen) {
      servicesApi.setQueueOpen(id, isOpen);
      refresh();
    }

    function updateUserEmail(email) {
      setUserEmail(email);
    }

    function joinQueue(serviceId) {
      const entry = queueApi.joinQueue(serviceId);
      refresh();
      return entry;
    }

    function leaveQueue() {
      queueApi.leaveQueue();
      refresh();
    }

    return {
      services,
      getService,
      getServiceQueue,
      updateServiceQueue,
      createService,
      updateService,
      deleteService,
      setQueueOpen,
      activeQueue,
      joinQueue,
      leaveQueue,
      userEmail,
      setUserEmail: updateUserEmail,
    };
  }, [services, activeQueue, userEmail]);

  return (
    <ServicesContext.Provider value={value}>{children}</ServicesContext.Provider>
  );
}

export function useServices() {
  const context = useContext(ServicesContext);
  if (!context) {
    throw new Error('useServices must be used inside a ServicesProvider');
  }
  return context;
}

// The signed-in user's place in a queue, and the actions that change it.
export function useQueue() {
  const { activeQueue, joinQueue, leaveQueue } = useServices();
  return { activeQueue, joinQueue, leaveQueue };
}
