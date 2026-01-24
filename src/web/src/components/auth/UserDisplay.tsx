import { useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';

type TokenClaims = {
  name?: string;
  email?: string;
  preferred_username?: string;
};

function getInitials(value: string | undefined) {
  if (!value) return 'U';
  const parts = value.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]?.[0]?.toUpperCase() ?? 'U';
  return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase();
}

export function UserDisplay() {
  const { account } = useAuth();

  const { displayName, email, initials } = useMemo(() => {
    const claims = account?.idTokenClaims as TokenClaims | undefined;
    const name = account?.name ?? claims?.name ?? 'Signed in';
    const emailAddress = claims?.email ?? claims?.preferred_username ?? account?.username ?? '';

    return {
      displayName: name,
      email: emailAddress,
      initials: getInitials(name),
    };
  }, [account]);

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm">
      <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-semibold text-indigo-700">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate font-medium text-neutral-800" title={displayName}>
          {displayName}
        </p>
        {email ? (
          <p className="truncate text-xs text-neutral-500" title={email}>
            {email}
          </p>
        ) : null}
      </div>
    </div>
  );
}
