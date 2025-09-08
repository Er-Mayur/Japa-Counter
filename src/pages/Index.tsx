import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Counter } from "@/components/Counter";
import { EnhancedDashboard } from "@/components/EnhancedDashboard";
import { Calendar } from "@/components/Calendar";
import { EnhancedSettings } from "@/components/EnhancedSettings";
import { BottomNav } from "@/components/BottomNav";
import { SplashScreen } from "@/components/SplashScreen";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

const Index = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [activeTab, setActiveTab] = useState<"counter" | "dashboard" | "calendar" | "settings">("counter");
  const [tapCount, setTapCount] = useState(0);
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSplashComplete = () => {
    setShowSplash(false);
  };

  const handleSignOut = async () => {
    if (window.confirm("क्या आप वाकई बाहर निकलना चाहते हैं?")) {
      await signOut();
      navigate('/auth');
    }
  };

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-spiritual flex items-center justify-center">
        <div className="mandala-bg fixed inset-0 opacity-5 pointer-events-none" />
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">लोड हो रहा है...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to auth page
  }

  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  const renderActiveScreen = () => {
    switch (activeTab) {
      case "counter":
        return <Counter onTapCountChange={setTapCount} />;
      case "dashboard":
        return <EnhancedDashboard />;
      case "calendar":
        return <Calendar />;
      case "settings":
        return <EnhancedSettings />;
      default:
        return <Counter onTapCountChange={setTapCount} />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-spiritual relative">
      {/* Subtle Om background pattern */}
      <div className="mandala-bg fixed inset-0 opacity-5 pointer-events-none" />
      
      {/* Header with logout button */}
      <div className="relative z-10 p-4 flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          स्वागत है, {user.user_metadata?.display_name || user.email}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className="text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-4 w-4 mr-2" />
          प्रस्थान
        </Button>
      </div>
      
      {/* Main Content */}
      <div className="relative z-10 pb-10 animate-fade-in">
        {renderActiveScreen()}
      </div>

      {/* Bottom Navigation */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default Index;
