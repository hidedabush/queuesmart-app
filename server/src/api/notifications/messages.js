import { HEAD_IN_AHEAD } from '../services/lineRules.js';

// Message templates (docs/A3-api-spec.txt section 6). None of these take the
// visit reason, so it can never leak onto a lock screen (office rule #8).

const formatRange = (estimate) =>
  estimate ? `about ${estimate.low}-${estimate.high} min` : 'no wait expected';

export function joinedMessage(serviceName, position, estimatedWait) {
  return {
    title: `${serviceName}: you’re checked in`,
    message: `You’re #${position} in line, ${formatRange(estimatedWait)}.`,
  };
}

export function almostUpMessage(serviceName) {
  return {
    title: `${serviceName}: head to the office`,
    message: `${HEAD_IN_AHEAD} or fewer patients are ahead of you.`,
  };
}

export function calledMessage(serviceName) {
  return {
    title: `${serviceName}: it’s your turn`,
    message: 'Please come to the front desk now.',
  };
}