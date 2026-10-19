import { HEAD_IN_AHEAD } from '../api/services/officeRules.js';

/**
 * Notification text. None of it includes the reason for the visit: these
 * lines can show up on a lock screen or in an SMS (office rule #8).
 */
function waitText(estimatedWait) {
  if (!estimatedWait || estimatedWait.high === 0) return 'any minute now';
  return `about ${estimatedWait.low}-${estimatedWait.high} min`;
}

export function joined({ serviceName, position, estimatedWait }) {
  return {
    title: `${serviceName}: you're checked in`,
    message: `You're #${position} in line, ${waitText(estimatedWait)}.`,
  };
}

export function almostUp({ serviceName }) {
  return {
    title: `${serviceName}: head to the office`,
    message: `${HEAD_IN_AHEAD} or fewer patients are ahead of you. Start heading in now.`,
  };
}

export function called({ serviceName }) {
  return {
    title: `${serviceName}: it's your turn`,
    message: 'Please come to the front desk now.',
  };
}
