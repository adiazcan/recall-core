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

  const { displayName, initials } = useMemo(() => {
    const claims = account?.idTokenClaims as TokenClaims | undefined;
    const name = account?.name ?? claims?.name ?? 'Signed in';

    return {
      displayName: name,
      initials: getInitials(name),
    };
  }, [account]);

  return (
    <>
      <div className="size-6 rounded-full bg-neutral-200 flex items-center justify-center flex-shrink-0">
        <span className="text-xs font-medium text-neutral-600 leading-4">{initials}</span>
      </div>
      <span className="flex-1 min-w-0 truncate text-sm font-medium text-neutral-600 tracking-[-0.15px] leading-5" title={displayName}>
        {displayName}
      </span>
    </>
  );
}
