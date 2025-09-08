import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Settings as SettingsIcon, 
  Target, 
  Volume2, 
  Trash2, 
  Download, 
  Upload,
  Palette,
  Bell,
  Clock,
  Smartphone
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAppSettings, AppSettings } from "@/hooks/useAppSettings";

export const EnhancedSettings = () => {
  const { settings: globalSettings, getText } = useAppSettings();
  const [settings, setSettings] = useState<AppSettings>(globalSettings);

  const [dataStats, setDataStats] = useState({
    totalTaps: 0,
    totalJaps: 0,
    daysActive: 0,
    dataSize: "0 KB"
  });

  // Sync with global settings
  useEffect(() => {
    setSettings(globalSettings);
  }, [globalSettings]);

  // Calculate data stats
  useEffect(() => {
    const tapCount = parseInt(localStorage.getItem("tapCount") || "0");
    const japCount = parseInt(localStorage.getItem("japCount") || "0");
    setDataStats({
      totalTaps: tapCount,
      totalJaps: japCount,
      daysActive: japCount > 0 ? Math.min(japCount, 30) : 0, // Simplified
      dataSize: "2.3 KB" // Estimated
    });
  }, []);

  const updateSetting = (key: keyof AppSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    localStorage.setItem(key, JSON.stringify(value));
    
    // Sync with counter component keys
    if (key === 'dailyTarget') {
      localStorage.setItem('japaDailyGoal', JSON.stringify(value));
    }
    if (key === 'soundEnabled') {
      localStorage.setItem('japaSoundEnabled', JSON.stringify(value));
    }
    if (key === 'hapticsEnabled') {
      localStorage.setItem('japaVibrationEnabled', JSON.stringify(value));
    }
  };

  const saveAllSettings = () => {
    Object.entries(settings).forEach(([key, value]) => {
      localStorage.setItem(key, JSON.stringify(value));
    });

    // Sync with counter component keys
    localStorage.setItem('japaDailyGoal', JSON.stringify(settings.dailyTarget));
    localStorage.setItem('japaSoundEnabled', JSON.stringify(settings.soundEnabled));
    localStorage.setItem('japaVibrationEnabled', JSON.stringify(settings.hapticsEnabled));

    // Trigger storage event for same-tab synchronization
    window.dispatchEvent(new Event('storage'));
    
    // Force page refresh after a delay to ensure all components sync
    setTimeout(() => {
      window.location.reload();
    }, 1000);

    toast({
      title: getText("सेटिंग्स सेव हो गईं", "Settings Saved") + " ✓",
      description: getText(
        "सभी प्राथमिकताएं सफलतापूर्वक सहेजी गईं। पेज रिफ्रेश हो रहा है...",
        "All preferences saved successfully. Page is refreshing..."
      ),
    });
  };

  const exportData = () => {
    const allData = {
      settings,
      tapCount: localStorage.getItem("tapCount"),
      japCount: localStorage.getItem("japCount"),
      dailyJapaData: localStorage.getItem("dailyJapaData"),
      exportDate: new Date().toISOString(),
    };

    const dataStr = JSON.stringify(allData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `japa-counter-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: getText("डेटा एक्सपोर्ट हो गया", "Data Exported"),
      description: getText("आपका बैकअप फ़ाइल डाउनलोड हो गई है।", "Your backup file has been downloaded."),
    });
  };

  const importData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        
        // Restore settings
        if (data.settings) {
          setSettings(data.settings);
          Object.entries(data.settings).forEach(([key, value]) => {
            localStorage.setItem(key, JSON.stringify(value));
          });
        }

        // Restore counter data
        if (data.tapCount) localStorage.setItem("tapCount", data.tapCount);
        if (data.japCount) localStorage.setItem("japCount", data.japCount);
        if (data.dailyJapaData) localStorage.setItem("dailyJapaData", data.dailyJapaData);

        toast({
          title: getText("डेटा इंपोर्ट हो गया", "Data Imported") + " ✓",
          description: getText("आपका बैकअप सफलतापूर्वक पुनर्स्थापित हो गया।", "Your backup has been successfully restored."),
        });
      } catch (error) {
        toast({
          title: getText("इंपोर्ट त्रुटि", "Import Error"),
          description: getText("फ़ाइल पढ़ने में समस्या हुई। कृपया वैध बैकअप फ़ाइल चुनें।", "Error reading file. Please select a valid backup file."),
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);
  };

  const resetAllData = () => {
    const confirmMessage = getText(
      "⚠️ क्या आप वाकई सभी डेटा रीसेट करना चाहते हैं? यह कार्रवाई अपरिवर्तनीय है।",
      "⚠️ Are you sure you want to reset all data? This action is irreversible."
    );
    
    if (window.confirm(confirmMessage)) {
      // Clear all localStorage
      const keysToRemove = [
        "tapCount", "japCount", "dailyJapaData", "dailyTarget", "monthlyTarget", "yearlyTarget",
        "soundEnabled", "hapticsEnabled", "notificationsEnabled", "reminderTime", "soundVolume",
        "theme", "language", "mantraType", "customMantra", "vibrationPattern"
      ];
      
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      // Reset to defaults
      setSettings({
        dailyTarget: 5,
        monthlyTarget: 150,
        yearlyTarget: 1825,
        soundEnabled: true,
        hapticsEnabled: true,
        notificationsEnabled: false,
        reminderTime: "06:00",
        soundVolume: 50,
        theme: "light",
        language: "both",
        mantraType: "om",
        customMantra: "",
        vibrationPattern: "medium",
      });

      toast({
        title: getText("डेटा रीसेट हो गया", "Data Reset"),
        description: getText("सभी सेटिंग्स और काउंटर डेटा साफ़ हो गया है।", "All settings and counter data has been cleared."),
      });
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto pb-24">
      {/* Header */}
      <div className="text-center">
        <h1 className="om-symbol text-4xl mb-2">ॐ</h1>
        <h2 className="text-2xl font-bold text-foreground mb-1">{getText("उन्नत सेटिंग्स", "Advanced Settings")}</h2>
        <p className="text-muted-foreground">{getText("अपने आध्यात्मिक अभ्यास को अनुकूलित करें", "Customize your spiritual practice")}</p>
      </div>

      {/* Data Overview */}
      <Card className="spiritual-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <SettingsIcon className="mr-2 h-5 w-5 text-primary" />
            {getText("डेटा सिंहावलोकन", "Data Overview")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-primary">{dataStats.totalJaps}</div>
              <div className="text-sm text-muted-foreground">{getText("कुल जप", "Total Japa")}</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-secondary">{dataStats.daysActive}</div>
              <div className="text-sm text-muted-foreground">{getText("सक्रिय दिन", "Active Days")}</div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-border text-center">
            <Badge variant="outline" className="text-xs">
              {getText("डेटा आकार", "Data Size")}: {dataStats.dataSize}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Targets Settings */}
      <Card className="spiritual-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Target className="mr-2 h-5 w-5 text-primary" />
            {getText("लक्ष्य निर्धारण", "Goal Setting")}
          </CardTitle>
          <CardDescription>
            {getText("अपने दैनिक, मासिक और वार्षिक लक्ष्य सेट करें", "Set your daily, monthly and yearly goals")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="daily-target">{getText("दैनिक लक्ष्य (जप में)", "Daily Goal (in japa)")}</Label>
            <Input
              id="daily-target"
              type="number"
              min="1"
              max="10"
              value={settings.dailyTarget}
              onChange={(e) => updateSetting("dailyTarget", parseInt(e.target.value) || 1)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="monthly-target">{getText("मासिक लक्ष्य (जप में)", "Monthly Goal (in japa)")}</Label>
            <Input
              id="monthly-target"
              type="number"
              min="1"
              value={settings.monthlyTarget}
              onChange={(e) => updateSetting("monthlyTarget", parseInt(e.target.value) || 1)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="yearly-target">{getText("वार्षिक लक्ष्य (जप में)", "Yearly Goal (in japa)")}</Label>
            <Input
              id="yearly-target"
              type="number"
              min="1"
              value={settings.yearlyTarget}
              onChange={(e) => updateSetting("yearlyTarget", parseInt(e.target.value) || 1)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Audio & Feedback Settings */}
      <Card className="spiritual-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Volume2 className="mr-2 h-5 w-5 text-secondary" />
            {getText("ऑडियो और फीडबैक", "Audio & Feedback")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{getText("ध्वनि सक्षम करें", "Enable Sound")}</Label>
              <div className="text-sm text-muted-foreground">
                {getText("जप पूरा होने पर ध्वनि", "Sound when japa completes")}
              </div>
            </div>
            <Switch
              checked={settings.soundEnabled}
              onCheckedChange={(value) => updateSetting("soundEnabled", value)}
            />
          </div>

          {settings.soundEnabled && (
            <div className="space-y-2">
              <Label>{getText("ध्वनि वॉल्यूम", "Sound Volume")}: {settings.soundVolume}%</Label>
              <Slider
                value={[settings.soundVolume]}
                onValueChange={(value) => updateSetting("soundVolume", value[0])}
                max={100}
                step={10}
                className="w-full"
              />
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{getText("हैप्टिक फीडबैक", "Haptic Feedback")}</Label>
              <div className="text-sm text-muted-foreground">
                {getText("स्पर्श कंपन", "Touch vibration")}
              </div>
            </div>
            <Switch
              checked={settings.hapticsEnabled}
              onCheckedChange={(value) => updateSetting("hapticsEnabled", value)}
            />
          </div>

          {settings.hapticsEnabled && (
            <div className="space-y-2">
              <Label>{getText("कंपन की तीव्रता", "Vibration Intensity")}</Label>
              <Select
                value={settings.vibrationPattern}
                onValueChange={(value: "soft" | "medium" | "strong") => updateSetting("vibrationPattern", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="soft">{getText("मृदु", "Soft")}</SelectItem>
                  <SelectItem value="medium">{getText("मध्यम", "Medium")}</SelectItem>
                  <SelectItem value="strong">{getText("तीव्र", "Strong")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card className="spiritual-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Palette className="mr-2 h-5 w-5 text-orange-500" />
            {getText("दिखावट और भाषा", "Appearance & Language")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{getText("भाषा प्राथमिकता", "Language Preference")}</Label>
            <Select
              value={settings.language}
              onValueChange={(value: "hi" | "en" | "both") => updateSetting("language", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hi">हिंदी</SelectItem>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="both">दोनों / Both</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{getText("मंत्र प्रकार", "Mantra Type")}</Label>
            <Select
              value={settings.mantraType}
              onValueChange={(value: "om" | "gayatri" | "mahamrityunjaya" | "custom") => updateSetting("mantraType", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="om">ॐ (ओम)</SelectItem>
                <SelectItem value="gayatri">गायत्री मंत्र</SelectItem>
                <SelectItem value="mahamrityunjaya">महामृत्युंजय मंत्र</SelectItem>
                <SelectItem value="custom">{getText("कस्टम मंत्र", "Custom Mantra")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {settings.mantraType === "custom" && (
            <div className="space-y-2">
              <Label htmlFor="custom-mantra">{getText("आपका मंत्र", "Your Mantra")}</Label>
              <Input
                id="custom-mantra"
                placeholder={getText("अपना मंत्र यहाँ लिखें...", "Write your mantra here...")}
                value={settings.customMantra}
                onChange={(e) => updateSetting("customMantra", e.target.value)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card className="spiritual-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Smartphone className="mr-2 h-5 w-5 text-purple-500" />
            {getText("डेटा प्रबंधन", "Data Management")}
          </CardTitle>
          <CardDescription>
            {getText("अपने जप डेटा का बैकअप और पुनर्स्थापना", "Backup and restore your japa data")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Button
              onClick={exportData}
              variant="outline"
              className="flex-1"
            >
              <Download className="mr-2 h-4 w-4" />
              {getText("एक्सपोर्ट", "Export")}
            </Button>
            
            <label className="flex-1">
              <Button variant="outline" className="w-full" asChild>
                <span>
                  <Upload className="mr-2 h-4 w-4" />
                  {getText("इंपोर्ट", "Import")}
                </span>
              </Button>
              <input
                type="file"
                accept=".json"
                onChange={importData}
                className="hidden"
              />
            </label>
          </div>

          <Separator />

          <Button
            onClick={resetAllData}
            variant="destructive"
            className="w-full"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {getText("सभी डेटा रीसेट करें", "Reset All Data")}
          </Button>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="sticky bottom-6 bg-background/80 backdrop-blur-sm border border-border rounded-lg p-4">
        <Button
          onClick={saveAllSettings}
          className="w-full"
          size="lg"
        >
          {getText("सभी सेटिंग्स सेव करें", "Save All Settings")}
        </Button>
      </div>
    </div>
  );
};