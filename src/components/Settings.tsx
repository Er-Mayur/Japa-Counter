import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Settings as SettingsIcon, Target, Volume2, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export const Settings = () => {
  const [dailyTarget, setDailyTarget] = useState(1);
  const [monthlyTarget, setMonthlyTarget] = useState(30);
  const [yearlyTarget, setYearlyTarget] = useState(365);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);

  // Load settings from localStorage
  useEffect(() => {
    const savedDailyTarget = localStorage.getItem("dailyTarget");
    const savedMonthlyTarget = localStorage.getItem("monthlyTarget");
    const savedYearlyTarget = localStorage.getItem("yearlyTarget");
    const savedSoundEnabled = localStorage.getItem("soundEnabled");
    const savedHapticsEnabled = localStorage.getItem("hapticsEnabled");

    if (savedDailyTarget) setDailyTarget(parseInt(savedDailyTarget));
    if (savedMonthlyTarget) setMonthlyTarget(parseInt(savedMonthlyTarget));
    if (savedYearlyTarget) setYearlyTarget(parseInt(savedYearlyTarget));
    if (savedSoundEnabled) setSoundEnabled(savedSoundEnabled === "true");
    if (savedHapticsEnabled) setHapticsEnabled(savedHapticsEnabled === "true");
  }, []);

  const saveSettings = () => {
    localStorage.setItem("dailyTarget", dailyTarget.toString());
    localStorage.setItem("monthlyTarget", monthlyTarget.toString());
    localStorage.setItem("yearlyTarget", yearlyTarget.toString());
    localStorage.setItem("soundEnabled", soundEnabled.toString());
    localStorage.setItem("hapticsEnabled", hapticsEnabled.toString());

    toast({
      title: "सेटिंग्स सेव हो गईं",
      description: "आपकी प्राथमिकताएं सफलतापूर्वक सहेजी गई हैं।",
    });
  };

  const resetAllData = () => {
    if (window.confirm("क्या आप वाकई सभी डेटा रीसेट करना चाहते हैं? यह कार्रवाई अपरिवर्तनीय है।")) {
      localStorage.removeItem("tapCount");
      localStorage.removeItem("japCount");
      localStorage.removeItem("dailyTarget");
      localStorage.removeItem("monthlyTarget");
      localStorage.removeItem("yearlyTarget");
      localStorage.removeItem("soundEnabled");
      localStorage.removeItem("hapticsEnabled");
      
      // Reset form state
      setDailyTarget(1);
      setMonthlyTarget(30);
      setYearlyTarget(365);
      setSoundEnabled(true);
      setHapticsEnabled(true);

      toast({
        title: "डेटा रीसेट हो गया",
        description: "सभी काउंटर और सेटिंग्स रीसेट हो गई हैं।",
      });
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center">
        <h1 className="om-symbol text-4xl mb-2">ॐ</h1>
        <h2 className="text-2xl font-bold text-foreground mb-1">सेटिंग्स</h2>
        <p className="text-muted-foreground">अपनी प्राथमिकताएं कॉन्फ़िगर करें</p>
      </div>

      {/* Targets Settings */}
      <Card className="spiritual-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Target className="mr-2 h-5 w-5 text-primary" />
            लक्ष्य निर्धारण
          </CardTitle>
          <CardDescription>
            अपने दैनिक, मासिक और वार्षिक जप लक्ष्य निर्धारित करें
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="daily-target">दैनिक लक्ष्य (जप में)</Label>
            <Input
              id="daily-target"
              type="number"
              min="1"
              value={dailyTarget}
              onChange={(e) => setDailyTarget(parseInt(e.target.value) || 1)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="monthly-target">मासिक लक्ष्य (जप में)</Label>
            <Input
              id="monthly-target"
              type="number"
              min="1"
              value={monthlyTarget}
              onChange={(e) => setMonthlyTarget(parseInt(e.target.value) || 1)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="yearly-target">वार्षिक लक्ष्य (जप में)</Label>
            <Input
              id="yearly-target"
              type="number"
              min="1"
              value={yearlyTarget}
              onChange={(e) => setYearlyTarget(parseInt(e.target.value) || 1)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Audio & Haptics Settings */}
      <Card className="spiritual-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Volume2 className="mr-2 h-5 w-5 text-secondary" />
            ऑडियो और हैप्टिक्स
          </CardTitle>
          <CardDescription>
            ध्वनि और स्पर्श फीडबैक सेटिंग्स
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>ध्वनि सक्षम करें</Label>
              <div className="text-sm text-muted-foreground">
                108 तप पूरे होने पर ध्वनि बजाएं
              </div>
            </div>
            <Switch
              checked={soundEnabled}
              onCheckedChange={setSoundEnabled}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>हैप्टिक फीडबैक</Label>
              <div className="text-sm text-muted-foreground">
                टैप करने पर कंपन (यदि समर्थित है)
              </div>
            </div>
            <Switch
              checked={hapticsEnabled}
              onCheckedChange={setHapticsEnabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card className="spiritual-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <SettingsIcon className="mr-2 h-5 w-5 text-accent" />
            डेटा प्रबंधन
          </CardTitle>
          <CardDescription>
            अपने काउंटर डेटा को प्रबंधित करें
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={saveSettings}
            className="w-full"
            variant="default"
          >
            सेटिंग्स सेव करें
          </Button>
          
          <Separator />
          
          <Button 
            onClick={resetAllData}
            variant="destructive"
            className="w-full"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            सभी डेटा रीसेट करें
          </Button>
        </CardContent>
      </Card>

      {/* App Info */}
      <Card className="spiritual-card">
        <CardContent className="p-6 text-center">
          <h3 className="font-semibold mb-2">धार्मिक जप काउंटर</h3>
          <p className="text-sm text-muted-foreground mb-4">
            आध्यात्मिक अभ्यास के लिए आपका डिजिटल साथी
          </p>
          <div className="om-symbol text-2xl">ॐ शांति शांति शांति:</div>
        </CardContent>
      </Card>
    </div>
  );
};