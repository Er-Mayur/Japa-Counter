import { Home, BarChart3, Settings, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppSettings } from "@/hooks/useAppSettings";

interface BottomNavProps {
  activeTab: "counter" | "dashboard" | "calendar" | "settings";
  onTabChange: (tab: "counter" | "dashboard" | "calendar" | "settings") => void;
}

export const BottomNav = ({ activeTab, onTabChange }: BottomNavProps) => {
  const { getText } = useAppSettings();
  
  const navItems = [
    {
      id: "counter" as const,
      label: getText("काउंटर", "Counter"),
      icon: Home,
    },
    {
      id: "dashboard" as const,
      label: getText("डैशबोर्ड", "Dashboard"),
      icon: BarChart3,
    },
    {
      id: "calendar" as const,
      label: getText("कैलेंडर", "Calendar"),
      icon: Calendar,
    },
    {
      id: "settings" as const,
      label: getText("सेटिंग्स", "Settings"),
      icon: Settings,
    },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-2 z-50">
      <div className="flex justify-around items-center max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          
          return (
            <Button
              key={item.id}
              variant="ghost"
              size="sm"
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center space-y-1 h-auto py-2 px-4 rounded-xl transition-all duration-200 ${
                isActive 
                  ? "bg-primary/10 text-primary border border-primary/20" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <Icon className={`h-5 w-5 ${isActive ? "text-primary" : ""}`} />
              <span className={`text-xs font-medium ${isActive ? "text-primary" : ""}`}>
                {item.label}
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
};