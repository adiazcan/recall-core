type AuthEventType =
  | 'sign-in-requested'
  | 'sign-in-completed'
  | 'sign-out-requested'
  | 'sign-out-completed';

export function logAuthEvent(type: AuthEventType, detail?: Record<string, string>) {
  const payload = {
    type,
    timestamp: new Date().toISOString(),
    ...detail,
  };

  console.info('Auth event', payload);
}
