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

export function ServicesProvider({ children }) {
  const [services, setServices] = useState(() => servicesApi.listServices());
  const [activeQueue, setActiveQueue] = useState(() => queueApi.getActiveQueue());
  const [userEmail, setUserEmail] = useState('');

  const value = useMemo(() => {
    function refresh() {
      setServices(servicesApi.listServices());
      setActiveQueue(queueApi.getActiveQueue());
    }

    function getService(id) {
      return services.find((s) => s.id === id) || null;
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
