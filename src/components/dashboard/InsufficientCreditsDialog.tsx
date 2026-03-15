import { useNavigate } from "react-router-dom";
import { Coins } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { INFERENCE_CREDIT_COST } from "@/types/credits";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  balance: number;
}

export function InsufficientCreditsDialog({ open, onOpenChange, balance }: Props) {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-yellow-500" />
            Insufficient Credits
          </DialogTitle>
          <DialogDescription>
            You need {INFERENCE_CREDIT_COST} credit to run inference but you only have{" "}
            <span className="font-semibold text-foreground">{balance}</span>.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              navigate("/dashboard/credits");
            }}
          >
            Buy Credits
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
