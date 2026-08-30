import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GUEST_PROMPT, setGuestMode } from "@/lib/guest-mode";

export function GuestGateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();

  const go = (mode: "signup" | "login") => {
    setGuestMode(false);
    onOpenChange(false);
    navigate({ to: "/auth", search: { mode } });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create an account to play</DialogTitle>
          <DialogDescription>{GUEST_PROMPT}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            className="rounded-xl w-full sm:w-auto"
            onClick={() => go("login")}
          >
            Log In
          </Button>
          <Button
            className="rounded-xl w-full sm:w-auto bg-brand text-white hover:bg-brand-dark font-bold"
            onClick={() => go("signup")}
          >
            Sign Up
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
