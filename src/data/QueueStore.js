// Mock queue state for Assignment 2.
// A2 has no backend, so this module keeps the user's active queue in memory for the current app session.
// In A3, this can be replaced by API calls without requiring the user screens to redesign their UI.

let activeQueue = null;

export function getActiveQueue() {
    return activeQueue;
}

export function joinQueue(service) {
    const position = service.waiting + 1;
    const low = position * service.expectedDuration;
    const high = Math.round(low * 1.3);

    activeQueue = {
        serviceId: service.id, 
        position,
        estimatedWait: {
            low,
            high,
        },
        status: 'waiting',
    };

    return activeQueue;
}

export function leaveQueue() {
    activeQueue = null;
}