import { HEAD_IN_AHEAD, NO_SHOW_GRACE_MINUTES } from '../api/queue';

/**
 * What the patient is told at each stage of a check-in. Shared by the
 * dashboard, the check-in screen and the notifications so they never
 * disagree. Nothing here mentions the reason for the visit: these lines can
 * show on a lock screen.
 */
export function checkInStatus(activeQueue) {
  switch (activeQueue.status) {
    case 'called':
      return {
        label: 'It is your turn',
        message: `Please come to the front desk now. If you are not here within ${NO_SHOW_GRACE_MINUTES} minutes, your spot may be released.`,
        urgent: true,
      };
    case 'head-in':
      return {
        label: activeQueue.peopleAhead === 0 ? 'You are next' : 'Head to the office',
        message:
          activeQueue.peopleAhead === 0
            ? 'You are next in line. Head to the office now so you are here when we call you.'
            : `Only ${activeQueue.peopleAhead} ${
                activeQueue.peopleAhead === 1 ? 'patient is' : 'patients are'
              } ahead of you. Start heading to the office now.`,
        urgent: true,
      };
    default:
      return {
        label: 'Waiting',
        message: `You can wait wherever you like. We will tell you to head in when ${HEAD_IN_AHEAD} or fewer patients are ahead of you.`,
        urgent: false,
      };
  }
}

export function formatEstimate(estimatedWait) {
  if (!estimatedWait || estimatedWait.high === 0) return 'Any minute';
  return `${estimatedWait.low}–${estimatedWait.high} min`;
}
