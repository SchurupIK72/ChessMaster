import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Clock3, ChevronLeft } from "lucide-react";

interface TimeControlModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBack: () => void;
  onConfirm: (timeControlSeconds: number) => void;
}

const timeControlPresets = [
  { seconds: 60, label: "1 min", description: "Bullet pace for fast tactical games" },
  { seconds: 180, label: "3 min", description: "Blitz format with constant pressure" },
  { seconds: 300, label: "5 min", description: "Balanced default for quick competitive matches" },
  { seconds: 600, label: "10 min", description: "Rapid-style game with more calculation time" },
  { seconds: 900, label: "15 min", description: "Longer rapid session with fewer clock scrambles" },
];

export default function TimeControlModal({ open, onOpenChange, onBack, onConfirm }: TimeControlModalProps) {
  const [selectedSeconds, setSelectedSeconds] = useState<string>("300");
  const selectedPreset = timeControlPresets.find((preset) => String(preset.seconds) === selectedSeconds) ?? timeControlPresets[2];

  const handleConfirm = () => {
    onConfirm(Number(selectedSeconds));
  };

  const handleBack = () => {
    onOpenChange(false);
    onBack();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl border border-white/10 bg-neutral-950 text-white shadow-[0_28px_90px_rgba(0,0,0,0.55)]">
        <DialogHeader>
          <DialogTitle className="flex items-center text-2xl font-semibold tracking-tight text-white">
            <Clock3 className="mr-3 h-6 w-6 text-white" />
            Choose Time Control
          </DialogTitle>
          <p className="mt-2 text-sm leading-6 text-neutral-300">
            Pick one timer preset before creating the match. The selected countdown will be shared by both players.
          </p>
        </DialogHeader>

        <RadioGroup value={selectedSeconds} onValueChange={setSelectedSeconds} className="space-y-3 py-4">
          {timeControlPresets.map((preset) => {
            const isSelected = selectedSeconds === String(preset.seconds);
            return (
              <Label
                key={preset.seconds}
                htmlFor={`time-${preset.seconds}`}
                className={`flex cursor-pointer items-start gap-4 rounded-2xl border p-4 transition-all ${
                  isSelected
                    ? "border-white/40 bg-white/[0.08] shadow-[0_0_0_1px_rgba(255,255,255,0.06)]"
                    : "border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.05]"
                }`}
              >
                <RadioGroupItem id={`time-${preset.seconds}`} value={String(preset.seconds)} className="mt-1 border-white/40 text-white" />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-lg font-semibold text-white">{preset.label}</span>
                    <Badge className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-neutral-200">
                      {Math.floor(preset.seconds / 60)} min
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-neutral-300">{preset.description}</p>
                </div>
              </Label>
            );
          })}
        </RadioGroup>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm uppercase tracking-[0.18em] text-neutral-400">Selected Timer</span>
            <Badge className="rounded-full border border-white/10 bg-white text-black">{selectedPreset.label}</Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-neutral-300">{selectedPreset.description}</p>
        </div>

        <div className="flex items-center justify-between border-t border-white/10 pt-4">
          <Button variant="ghost" onClick={handleBack} className="text-neutral-300 hover:bg-white/5 hover:text-white">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back To Rules
          </Button>
          <Button onClick={handleConfirm} className="border border-white bg-white text-black hover:bg-neutral-200">
            Create Match With {selectedPreset.label}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
