import { useState, useEffect } from 'react';

export interface AppSettings {
  dailyTarget: number;
  monthlyTarget: number;
  yearlyTarget: number;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  notificationsEnabled: boolean;
  reminderTime: string;
  soundVolume: number;
  theme: "light" | "dark" | "auto";
  language: "hi" | "en" | "both";
  mantraType: "om" | "gayatri" | "mahamrityunjaya" | "custom";
  customMantra: string;
  vibrationPattern: "soft" | "medium" | "strong";
}

const defaultSettings: AppSettings = {
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
};

export const useAppSettings = () => {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);

  useEffect(() => {
    const loadSetting = (key: string, defaultValue: any) => {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : defaultValue;
    };

    setSettings({
      dailyTarget: loadSetting("dailyTarget", 5),
      monthlyTarget: loadSetting("monthlyTarget", 150),
      yearlyTarget: loadSetting("yearlyTarget", 1825),
      soundEnabled: loadSetting("soundEnabled", true),
      hapticsEnabled: loadSetting("hapticsEnabled", true),
      notificationsEnabled: loadSetting("notificationsEnabled", false),
      reminderTime: loadSetting("reminderTime", "06:00"),
      soundVolume: loadSetting("soundVolume", 50),
      theme: loadSetting("theme", "light"),
      language: loadSetting("language", "both"),
      mantraType: loadSetting("mantraType", "om"),
      customMantra: loadSetting("customMantra", ""),
      vibrationPattern: loadSetting("vibrationPattern", "medium"),
    });

    // Listen for storage changes
    const handleStorageChange = () => {
      setSettings({
        dailyTarget: loadSetting("dailyTarget", 5),
        monthlyTarget: loadSetting("monthlyTarget", 150),
        yearlyTarget: loadSetting("yearlyTarget", 1825),
        soundEnabled: loadSetting("soundEnabled", true),
        hapticsEnabled: loadSetting("hapticsEnabled", true),
        notificationsEnabled: loadSetting("notificationsEnabled", false),
        reminderTime: loadSetting("reminderTime", "06:00"),
        soundVolume: loadSetting("soundVolume", 50),
        theme: loadSetting("theme", "light"),
        language: loadSetting("language", "both"),
        mantraType: loadSetting("mantraType", "om"),
        customMantra: loadSetting("customMantra", ""),
        vibrationPattern: loadSetting("vibrationPattern", "medium"),
      });
    };

    window.addEventListener('storage', handleStorageChange);
    const interval = setInterval(handleStorageChange, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  // Text utilities based on language setting
  const getText = (hindi: string, english: string) => {
    switch (settings.language) {
      case 'en':
        return english;
      case 'hi':
        return hindi;
      default:
        return english;
    }
  };

  // Get mantra symbol/text based on mantra type
  const getMantraSymbol = () => {
    switch (settings.mantraType) {
      case 'om':
        return 'ॐ';
      case 'gayatri':
        return '🕉️';
      case 'mahamrityunjaya':
        return '🔱';
      case 'custom':
        return settings.customMantra || 'ॐ';
      default:
        return 'ॐ';
    }
  };

  const getMantraName = () => {
    switch (settings.mantraType) {
      case 'om':
        return getText('ॐ (ओम)', 'Om');
      case 'gayatri':
        return getText('गायत्री मंत्र', 'Gayatri Mantra');
      case 'mahamrityunjaya':
        return getText('महामृत्युंजय मंत्र', 'Mahamrityunjaya Mantra');
      case 'custom':
        return getText('कस्टम मंत्र', 'Custom Mantra');
      default:
        return getText('ॐ (ओम)', 'Om');
    }
  };

  return {
    settings,
    getText,
    getMantraSymbol,
    getMantraName
  };
};