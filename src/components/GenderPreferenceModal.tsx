import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Heart, Sparkles } from "lucide-react";
import maleModel from "@/assets/male-model.jpg";
import femaleModel from "@/assets/female-model.jpg";

interface GenderPreferenceModalProps {
  isOpen: boolean;
  onComplete: () => void;
  profileId: string;
}

type GenderType = "male" | "female" | "other";

export function GenderPreferenceModal({ isOpen, onComplete, profileId }: GenderPreferenceModalProps) {
  const [myGender, setMyGender] = useState<GenderType | null>(null);
  const [lookingFor, setLookingFor] = useState<GenderType | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!myGender || !lookingFor) {
      toast.error("Please select both options");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          gender: myGender,
          looking_for: [lookingFor],
        })
        .eq("id", profileId);

      if (error) throw error;

      toast.success("Preferences saved!");
      onComplete();
    } catch (error: any) {
      console.error("Error saving preferences:", error);
      toast.error("Failed to save preferences");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent 
        className="bg-black border-zinc-800 max-w-md p-0 overflow-hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Header with sparkle effect */}
        <div className="relative p-6 pb-2">
          <div className="absolute top-4 right-4">
            <Sparkles className="w-6 h-6 text-pink-400 animate-pulse" />
          </div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-pink-500 to-red-600 rounded-full">
              <Heart className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Find Your Match</h2>
              <p className="text-zinc-400 text-sm">Let's personalize your experience</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* I am Section */}
          <div className="space-y-3">
            <label className="text-white font-semibold text-lg">I am a...</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setMyGender("male")}
                className={`relative overflow-hidden rounded-xl transition-all duration-300 ${
                  myGender === "male"
                    ? "ring-2 ring-blue-500 scale-105 shadow-lg shadow-blue-500/30"
                    : "opacity-70 hover:opacity-100 border border-zinc-700"
                }`}
              >
                <img 
                  src={maleModel} 
                  alt="Man" 
                  className="w-full h-32 object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                <div className="absolute bottom-2 left-0 right-0 text-center font-semibold text-white">
                  Man
                </div>
              </button>
              <button
                onClick={() => setMyGender("female")}
                className={`relative overflow-hidden rounded-xl transition-all duration-300 ${
                  myGender === "female"
                    ? "ring-2 ring-pink-500 scale-105 shadow-lg shadow-pink-500/30"
                    : "opacity-70 hover:opacity-100 border border-zinc-700"
                }`}
              >
                <img 
                  src={femaleModel} 
                  alt="Woman" 
                  className="w-full h-32 object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                <div className="absolute bottom-2 left-0 right-0 text-center font-semibold text-white">
                  Woman
                </div>
              </button>
            </div>
          </div>

          {/* Looking for Section */}
          <div className="space-y-3">
            <label className="text-white font-semibold text-lg">Looking for...</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setLookingFor("male")}
                className={`relative overflow-hidden rounded-xl transition-all duration-300 ${
                  lookingFor === "male"
                    ? "ring-2 ring-blue-500 scale-105 shadow-lg shadow-blue-500/30"
                    : "opacity-70 hover:opacity-100 border border-zinc-700"
                }`}
              >
                <img 
                  src={maleModel} 
                  alt="Men" 
                  className="w-full h-32 object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                <div className="absolute bottom-2 left-0 right-0 text-center font-semibold text-white flex items-center justify-center gap-1">
                  <span className="text-blue-400">💙</span> Men
                </div>
              </button>
              <button
                onClick={() => setLookingFor("female")}
                className={`relative overflow-hidden rounded-xl transition-all duration-300 ${
                  lookingFor === "female"
                    ? "ring-2 ring-pink-500 scale-105 shadow-lg shadow-pink-500/30"
                    : "opacity-70 hover:opacity-100 border border-zinc-700"
                }`}
              >
                <img 
                  src={femaleModel} 
                  alt="Women" 
                  className="w-full h-32 object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                <div className="absolute bottom-2 left-0 right-0 text-center font-semibold text-white flex items-center justify-center gap-1">
                  <span className="text-pink-400">💗</span> Women
                </div>
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={!myGender || !lookingFor || isSubmitting}
            className="w-full py-6 text-lg font-bold bg-gradient-to-r from-pink-500 via-red-500 to-pink-500 hover:from-pink-600 hover:via-red-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-pink-500/30"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin">💫</span>
                Saving...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Heart className="w-5 h-5" />
                Start Matching
              </span>
            )}
          </Button>

          <p className="text-center text-zinc-500 text-xs">
            You can change these preferences anytime in your profile settings
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
