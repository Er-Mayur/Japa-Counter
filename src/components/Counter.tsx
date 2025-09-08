import { useState, useCallback, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { RotateCcw, Volume2, VolumeX, Zap, Target, Minus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useJapaSessions } from "@/hooks/useJapaSessions";
import { useAppSettings } from "@/hooks/useAppSettings";

interface CounterProps {
  onTapCountChange: (count: number) => void;
}

export const Counter = ({ onTapCountChange }: CounterProps) => {
  const { settings, getText, getMantraSymbol, getMantraName } = useAppSettings();
  const [tapCount, setTapCount] = useState(0);
  const [goalJaps, setGoalJaps] = useState(() => {
    const saved = localStorage.getItem('dailyTarget') || localStorage.getItem('japaDailyGoal');
    return saved ? parseInt(saved) : settings.dailyTarget;
  });
  const [showTargetSetting, setShowTargetSetting] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return settings.soundEnabled;
  });
  const [vibrationEnabled, setVibrationEnabled] = useState(() => {
    return settings.hapticsEnabled;
  });
  const [isPressed, setIsPressed] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();
  const { saveSession, getSessionData } = useJapaSessions();

  useEffect(() => {
    // Load today's count from database or localStorage
    const loadTodaysCount = async () => {
      const today = new Date();
      const sessionData = getSessionData(today);
      
      if (sessionData) {
        setTapCount(sessionData.taps);
        onTapCountChange(sessionData.taps);
      } else {
        // Fallback to localStorage for offline usage
        const todayStr = today.toDateString();
        const savedCount = localStorage.getItem(`japaCount_${todayStr}`);
        if (savedCount) {
          const count = parseInt(savedCount);
          setTapCount(count);
          onTapCountChange(count);
        }
      }
    };
    
    loadTodaysCount();
  }, [onTapCountChange, getSessionData]);

  const handleTap = useCallback(async () => {
    const newCount = tapCount + 1;
    const newJaps = Math.floor(newCount / 108);
    const previousJaps = Math.floor(tapCount / 108);
    
    setTapCount(newCount);
    onTapCountChange(newCount);
    
    // Save to database and localStorage
    const today = new Date();
    try {
      await saveSession(today, newCount, newJaps);
    } catch (error) {
      console.error('Failed to save to database, using localStorage fallback');
    }
    
    // Always save to localStorage as backup
    const todayStr = today.toDateString();
    localStorage.setItem(`japaCount_${todayStr}`, newCount.toString());
    
    // Play sound if enabled
    if (soundEnabled && audioRef.current && audioRef.current.play) {
      try {
        audioRef.current.play();
      } catch (error) {
        console.error('Failed to play sound:', error);
      }
    }
    
    // Vibrate if enabled and available
    if (vibrationEnabled && 'vibrate' in navigator) {
      navigator.vibrate(50);
    }
    
    // Show japa completion toast
    if (newJaps > previousJaps) {
      toast({
        title: `${getMantraSymbol()} ${newJaps} ${getText('जप पूर्ण', 'Japa Complete')}!`,
        description: getText(
          `बधाई हो! आपने ${newJaps} जप पूरे किए हैं।`,
          `Congratulations! You completed ${newJaps} japa(s).`
        ),
        duration: 2000,
      });
    }
    
    // Check if daily goal is reached
    if (newJaps >= goalJaps && previousJaps < goalJaps) {
      toast({
        title: `🎉 ${getText('दैनिक लक्ष्य पूर्ण', 'Daily Goal Complete')}!`,
        description: getText(
          `आज का लक्ष्य ${goalJaps} जप पूरा हो गया!`,
          `Today's goal of ${goalJaps} japa(s) is complete!`
        ),
        duration: 4000,
      });
    }
  }, [tapCount, onTapCountChange, soundEnabled, vibrationEnabled, toast, goalJaps, saveSession]);

  const decrementCount = useCallback(async () => {
    if (tapCount === 0) return;
    
    const newCount = Math.max(0, tapCount - 1);
    const newJaps = Math.floor(newCount / 108);
    
    setTapCount(newCount);
    onTapCountChange(newCount);
    
    // Save to database and localStorage
    const today = new Date();
    try {
      await saveSession(today, newCount, newJaps);
    } catch (error) {
      console.error('Failed to save to database, using localStorage fallback');
    }
    
    // Always save to localStorage as backup
    const todayStr = today.toDateString();
    localStorage.setItem(`japaCount_${todayStr}`, newCount.toString());
    
    toast({
      title: getText('काउंट घटाया गया', 'Count Decreased'),
      description: getText(
        `काउंट ${newCount} हो गया।`,
        `Count is now ${newCount}.`
      ),
      duration: 1000,
    });
  }, [tapCount, onTapCountChange, toast, saveSession]);

  const updateGoal = (newGoal: number) => {
    const goal = Math.max(1, newGoal);
    setGoalJaps(goal);
    localStorage.setItem('dailyTarget', goal.toString());
    localStorage.setItem('japaDailyGoal', goal.toString());
    toast({
      title: getText('लक्ष्य अपडेट हुआ', 'Goal Updated'),
      description: getText(
        `दैनिक लक्ष्य ${goal} जप सेट किया गया।`,
        `Daily goal set to ${goal} japa(s).`
      ),
      duration: 2000,
    });
  };

  const resetCount = useCallback(async () => {
    setTapCount(0);
    onTapCountChange(0);
    
    // Reset in database and localStorage
    const today = new Date();
    try {
      await saveSession(today, 0, 0);
    } catch (error) {
      console.error('Failed to reset in database');
    }
    
    // Remove from localStorage
    const todayStr = today.toDateString();
    localStorage.removeItem(`japaCount_${todayStr}`);
    
    toast({
      title: getText('काउंट रीसेट', 'Count Reset'),
      description: getText(
        'आज का काउंट शून्य कर दिया गया।',
        "Today's count has been reset to zero."
      ),
      duration: 2000,
    });
  }, [onTapCountChange, toast, saveSession]);

  // Create audio context for sound effects
  useEffect(() => {
    // Create a simple beep sound using Web Audio API
    const createBeepSound = () => {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800; // 800 Hz beep
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
        
        return audioContext;
      } catch (error) {
        console.error('Web Audio API not supported:', error);
        return null;
      }
    };

    // Store the createBeepSound function in audioRef for later use
    audioRef.current = { play: createBeepSound } as any;
  }, []);

  // Listen for localStorage changes to sync settings
  useEffect(() => {
    const handleStorageChange = () => {
      const soundSetting = localStorage.getItem('soundEnabled');
      const vibrationSetting = localStorage.getItem('hapticsEnabled');
      const dailyTargetSetting = localStorage.getItem('dailyTarget');
      
      if (soundSetting !== null) {
        setSoundEnabled(JSON.parse(soundSetting));
      }
      if (vibrationSetting !== null) {
        setVibrationEnabled(JSON.parse(vibrationSetting));
      }
      if (dailyTargetSetting !== null) {
        setGoalJaps(parseInt(dailyTargetSetting));
      }
    };

    // Listen for storage events (from other tabs/components)
    window.addEventListener('storage', handleStorageChange);
    
    // Also check for changes every second (for same-tab updates)
    const interval = setInterval(handleStorageChange, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  const currentJaps = Math.floor(tapCount / 108);
  const currentSessionProgress = tapCount % 108;
  const progressPercentage = (currentSessionProgress / 108) * 100;
  const goalProgressPercentage = (currentJaps / goalJaps) * 100;

  return (
    <div className="flex flex-col items-center justify-center p-6 space-y-4 min-h-[calc(100vh-8rem)]">
      {/* Om Symbol Header */}
      <div className="text-center">
        <h1 className="om-symbol text-4xl animate-om-glow mb-1">{getMantraSymbol()}</h1>
        <p className="text-sm text-muted-foreground">{getText('धार्मिक जप काउंटर', 'Spiritual Japa Counter')}</p>
        <p className="text-xs text-muted-foreground/70">{getMantraName()}</p>
      </div>

      {/* Main Counter Display */}
      <Card className="spiritual-card w-full max-w-xs">
        <CardContent className="p-4">
          <div className="text-center space-y-3">
            {/* Current Japs */}
            <div>
              <div className="text-3xl font-bold text-primary mb-1">
                {currentJaps}
              </div>
              <div className="text-xs text-muted-foreground">{getText('पूर्ण जप', 'Complete Japa')}</div>
            </div>

            {/* Current Session Progress */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{getText('वर्तमान सत्र', 'Current Session')}</span>
                <span>{currentSessionProgress}/108</span>
              </div>
              <Progress 
                value={progressPercentage} 
                className="h-1"
              />
            </div>

            {/* Daily Goal Progress */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{getText('दैनिक लक्ष्य', 'Daily Goal')}</span>
                <span>{currentJaps}/{goalJaps}</span>
              </div>
              <Progress 
                value={Math.min(goalProgressPercentage, 100)} 
                className="h-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Target Setting */}
      {showTargetSetting && (
        <Card className="spiritual-card w-full max-w-xs">
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{getText('आज का लक्ष्य', "Today's Goal")}</span>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowTargetSetting(false)}
                  className="h-6 w-6 p-0"
                >
                  ×
                </Button>
              </div>
              <div className="flex items-center space-x-2">
                <Input
                  type="number"
                  min="1"
                  max="20"
                  value={goalJaps}
                  onChange={(e) => updateGoal(parseInt(e.target.value) || 1)}
                  className="text-center"
                />
                <span className="text-sm text-muted-foreground">{getText('जप', 'japa')}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Tap Button */}
      <Button
        onClick={handleTap}
        onMouseDown={() => setIsPressed(true)}
        onMouseUp={() => setIsPressed(false)}
        onMouseLeave={() => setIsPressed(false)}
        size="lg"
        className={`
          counter-button w-24 h-24 rounded-full text-lg font-bold 
          transition-all duration-150 active:scale-95 
          ${isPressed ? 'scale-95 shadow-inner' : 'shadow-lg'}
          bg-gradient-to-b from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70
        `}
      >
        <div className="flex flex-col items-center">
          <Zap className="h-6 w-6 mb-1" />
          TAP
        </div>
      </Button>

      {/* Action Buttons */}
      <div className="flex space-x-3">
        <Button
          variant="outline"
          size="icon"
          onClick={decrementCount}
          disabled={tapCount === 0}
          className="rounded-full h-8 w-8"
          title={getText('काउंट घटाएं (-1)', 'Decrease Count (-1)')}
        >
          <Minus className="h-3 w-3" />
        </Button>
        
        <Button
          variant="outline"
          size="icon"
          onClick={resetCount}
          disabled={tapCount === 0}
          className="rounded-full h-8 w-8"
          title={getText('रीसेट करें', 'Reset')}
        >
          <RotateCcw className="h-3 w-3" />
        </Button>
        
        <Button
          variant="outline"
          size="icon"
          onClick={() => {
            setSoundEnabled(!soundEnabled);
            localStorage.setItem('japaSoundEnabled', JSON.stringify(!soundEnabled));
            localStorage.setItem('soundEnabled', JSON.stringify(!soundEnabled));
          }}
          className={`rounded-full h-8 w-8 ${soundEnabled ? 'bg-primary/10 text-primary' : ''}`}
          title={getText('ध्वनि टॉगल करें', 'Toggle Sound')}
        >
          {soundEnabled ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={() => setShowTargetSetting(!showTargetSetting)}
          className={`rounded-full h-8 w-8 ${showTargetSetting ? 'bg-secondary/10 text-secondary' : ''}`}
          title={getText('लक्ष्य सेट करें', 'Set Goal')}
        >
          <Target className="h-3 w-3" />
        </Button>
      </div>

      {/* Stats */}
      <Card className="spiritual-card w-full max-w-xs">
        <CardContent className="p-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-lg font-bold text-primary">{tapCount}</div>
              <div className="text-xs text-muted-foreground">{getText('कुल तप', 'Total Taps')}</div>
            </div>
            <div>
              <div className="text-lg font-bold text-secondary">{currentJaps}</div>
              <div className="text-xs text-muted-foreground">{getText('पूर्ण जप', 'Complete Japa')}</div>
            </div>
            <div>
              <div className="text-lg font-bold text-accent">{currentSessionProgress}</div>
              <div className="text-xs text-muted-foreground">{getText('वर्तमान', 'Current')}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};