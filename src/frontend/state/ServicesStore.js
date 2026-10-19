import { createContext, useContext, useMemo, useState } from 'react';
import * as queueApi from '../../api/queue';
import * as servicesApi from '../../api/services';

/**
 * Shared front-end state for Assignment 2.
 *
 * The screens need to share state: a visit type created by staff must
 * appear on the dashboard, and a patient who checks in must appear in the
 * front desk's line (and move up when staff call the next patient). This
 * context holds what the API last returned and re-reads it after every
 * change.
 *
 * Screens never import src/api/ for data themselves; they use the hooks
 * below, so every screen re-renders from the same copy.
 */
const ServicesContext = createContext(null);

function readAll() {
  const services = servicesApi.listServices();
  const lines = {};
  const called = {};
  services.forEach((service) => {
    lines[service.id] = queueApi.listQueue(service.id);
    called[service.id] = queueApi.getCalled(service.id);
  });
  return {
    services,
    lines,
    called,
    activeQueue: queueApi.getActiveQueue(),
    history: queueApi.listVisitHistory(),
  };
}

const emptyPatient = { name: '', dob: '', email: '' };

// Accounts that only signed in (no registration this session) have no name
// on file yet, so fall back to the part of the email before the @.
function patientForCheckIn(patient) {
  if (patient.name) return patient;
  const handle = patient.email.split('@')[0] || 'Patient';
  return { ...patient, name: handle.charAt(0).toUpperCase() + handle.slice(1) };
}

export function ServicesProvider({ children }) {
  const [data, setData] = useState(readAll);
  const [patient, setPatientState] = useState(emptyPatient);

  const value = useMemo(() => {
    function refresh() {
      setData(readAll());
    }

    // Wraps an API call so every change re-reads the shared state.
    function change(call) {
      return (...args) => {
        const result = call(...args);
        refresh();
        return result;
      };
    }

    return {
      services: data.services,
      getService: (id) => data.services.find((s) => s.id === id) || null,
      getServiceQueue: (id) => data.lines[id] ?? [],
      getCalled: (id) => data.called[id] ?? null,

      createService: change(servicesApi.createService),
      updateService: change(servicesApi.updateService),
      deleteService: change(servicesApi.deleteService),
      setQueueOpen: change(servicesApi.setQueueOpen),

      // Front desk
      callNext: change(queueApi.callNext),
      resolveCalled: change(queueApi.resolveCalled),
      moveEntry: change(queueApi.moveEntry),
      removeEntry: change(queueApi.removeEntry),

      // Patient
      activeQueue: data.activeQueue,
      history: data.history,
      checkIn: change((serviceId, reason) =>
        queueApi.checkIn(serviceId, patientForCheckIn(patient), reason)
      ),
      cancelCheckIn: change(queueApi.cancelCheckIn),

      patient,
      setPatient: (next) => setPatientState({ ...emptyPatient, ...next }),
      userEmail: patient.email,
      setUserEmail: (email) => setPatientState((current) => ({ ...current, email })),
    };
  }, [data, patient]);

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

// The signed-in patient's check-in, and the actions that change it.
export function useQueue() {
  const { activeQueue, checkIn, cancelCheckIn } = useServices();
  return { activeQueue, checkIn, cancelCheckIn };
}
