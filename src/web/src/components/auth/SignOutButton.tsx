import { useAuth } from '../../hooks/useAuth';
import { Button } from '../ui/button';

type SignOutButtonProps = {
  className?: string;
};

export function SignOutButton({ className }: SignOutButtonProps) {
  const { signOut } = useAuth();

  return (
    <Button type="button" className={className} variant="outline" onClick={() => void signOut()}>
      Sign out
    </Button>
  );
}
