import { useNavigate } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';
import { Button } from '../components/ui/button';

export default function UnauthorizedPage() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <ShieldOff className="w-16 h-16 text-muted-foreground" />
      <h1 className="text-2xl font-bold">Access Denied</h1>
      <p className="text-muted-foreground">You don't have permission to view this page.</p>
      <Button onClick={() => navigate(-1)}>Go Back</Button>
    </div>
  );
}
