import { useAuth } from '../../hooks/useAuth';
import { Button } from '../ui/button';

type SignInButtonProps = {
  className?: string;
};

export function SignInButton({ className }: SignInButtonProps) {
  const { signIn } = useAuth();

  return (
    <Button type="button" className={className} onClick={() => void signIn()}>
      Sign in
    </Button>
  );
}
