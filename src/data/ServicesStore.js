import React, { createContext, useContext, useMemo, useState } from 'react';

/**
 * Mock data store for Assignment 2.
 *
 * A2 requires no backend, but the admin screens still need to share state:
 * a service created on the Service Management screen must appear on the
 * Admin Dashboard. This context holds that state in memory for the session.
 *
 * In A3 the functions below are replaced by API calls. The shape of the data
 * here is deliberately close to what we expect the API to return, so swapping
 * the implementation should not require changing the screens.
 */

const SEED_SERVICES = [
  {
    id: 's1',
    name: 'Academic Advising',
    description: 'Degree planning, course selection, and registration holds.',
    expectedDuration: 15,
    priority: 'medium',
    isOpen: true,
    waiting: 7,
  },
  {
    id: 's2',
    name: 'Financial Aid',
    description: 'Award questions, appeals, and disbursement issues.',
    expectedDuration: 20,
    priority: 'high',
    isOpen: true,
    waiting: 12,
  },
  {
    id: 's3',
    name: 'ID Card Services',
    description: 'New cards, replacements, and photo updates.',
    expectedDuration: 5,
    priority: 'low',
    isOpen: true,
    waiting: 3,
  },
  {
    id: 's4',
    name: 'Registrar — Transcripts',
    description: 'Official transcript requests and enrollment verification.',
    expectedDuration: 10,
    priority: 'low',
    isOpen: false,
    waiting: 0,
  },
];

const ServicesContext = createContext(null);

export function ServicesProvider({ children }) {
  const [services, setServices] = useState(SEED_SERVICES);

  const value = useMemo(() => {
    function getService(id) {
      return services.find((s) => s.id === id) || null;
    }

    function createService(draft) {
      const service = {
        ...draft,
        id: `s${Date.now()}`,
        isOpen: true,
        waiting: 0,
      };
      setServices((current) => [...current, service]);
      return service;
    }

    function updateService(id, draft) {
      setServices((current) =>
        current.map((s) => (s.id === id ? { ...s, ...draft } : s))
      );
    }

    function deleteService(id) {
      setServices((current) => current.filter((s) => s.id !== id));
    }

    function setQueueOpen(id, isOpen) {
      setServices((current) =>
        current.map((s) => (s.id === id ? { ...s, isOpen } : s))
      );
    }

    return {
      services,
      getService,
      createService,
      updateService,
      deleteService,
      setQueueOpen,
    };
  }, [services]);

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

/**
 * Estimated wait for a queue, using the simple model described in A1:
 * people waiting x expected service duration, presented as a range rather
 * than a single number because the estimate is genuinely approximate.
 */
export function estimateWait(service) {
  if (!service.isOpen || service.waiting === 0) return null;
  const low = service.waiting * service.expectedDuration;
  const high = Math.round(low * 1.3);
  return { low, high };
}

export function formatWait(service) {
  const estimate = estimateWait(service);
  if (!estimate) return service.isOpen ? 'No wait' : 'Closed';
  return `${estimate.low}–${estimate.high} min`;
}
