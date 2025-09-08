import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Target, TrendingUp, Flame, Calendar } from "lucide-react";

interface DashboardStats {
  todayTaps: number;
  todayJaps: number;
  todayTarget: number;
  monthlyJaps: number;
  monthlyTarget: number;
  yearlyJaps: number;
  yearlyTarget: number;
  currentStreak: number;
}

export const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    todayTaps: 0,
    todayJaps: 0,
    todayTarget: 1,
    monthlyJaps: 0,
    monthlyTarget: 30,
    yearlyJaps: 0,
    yearlyTarget: 365,
    currentStreak: 0,
  });

  useEffect(() => {
    // Load current tap count and targets from localStorage
    const tapCount = parseInt(localStorage.getItem("tapCount") || "0");
    const japCount = parseInt(localStorage.getItem("japCount") || "0");
    const dailyTarget = parseInt(localStorage.getItem("dailyTarget") || "1");
    const monthlyTarget = parseInt(localStorage.getItem("monthlyTarget") || "30");
    const yearlyTarget = parseInt(localStorage.getItem("yearlyTarget") || "365");

    // For demo purposes, we'll use simple calculations
    // In a real app, you'd track daily/monthly/yearly separately
    setStats({
      todayTaps: tapCount,
      todayJaps: japCount,
      todayTarget: dailyTarget,
      monthlyJaps: japCount, // Simplified
      monthlyTarget: monthlyTarget,
      yearlyJaps: japCount, // Simplified
      yearlyTarget: yearlyTarget,
      currentStreak: japCount > 0 ? 1 : 0, // Simplified
    });
  }, []);

  const todayProgressPercentage = Math.min((stats.todayJaps / stats.todayTarget) * 100, 100);
  const monthlyProgressPercentage = Math.min((stats.monthlyJaps / stats.monthlyTarget) * 100, 100);
  const yearlyProgressPercentage = Math.min((stats.yearlyJaps / stats.yearlyTarget) * 100, 100);

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center">
        <h1 className="om-symbol text-4xl mb-2">ॐ</h1>
        <h2 className="text-2xl font-bold text-foreground mb-1">डैशबोर्ड</h2>
        <p className="text-muted-foreground">आपकी आध्यात्मिक यात्रा</p>
      </div>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="spiritual-card">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary mb-1">{stats.todayTaps}</div>
            <div className="text-sm text-muted-foreground">आज के तप</div>
          </CardContent>
        </Card>
        
        <Card className="spiritual-card">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-secondary mb-1">{stats.todayJaps}</div>
            <div className="text-sm text-muted-foreground">आज के जप</div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Cards */}
      <div className="space-y-4">
        {/* Daily Progress */}
        <Card className="spiritual-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center text-lg">
              <Target className="mr-2 h-5 w-5 text-primary" />
              दैनिक लक्ष्य
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{stats.todayJaps} / {stats.todayTarget} जप</span>
                <span>{Math.round(todayProgressPercentage)}%</span>
              </div>
              <Progress value={todayProgressPercentage} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Monthly Progress */}
        <Card className="spiritual-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center text-lg">
              <Calendar className="mr-2 h-5 w-5 text-secondary" />
              मासिक लक्ष्य
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{stats.monthlyJaps} / {stats.monthlyTarget} जप</span>
                <span>{Math.round(monthlyProgressPercentage)}%</span>
              </div>
              <Progress value={monthlyProgressPercentage} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Yearly Progress */}
        <Card className="spiritual-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center text-lg">
              <TrendingUp className="mr-2 h-5 w-5 text-accent" />
              वार्षिक लक्ष्य
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{stats.yearlyJaps} / {stats.yearlyTarget} जप</span>
                <span>{Math.round(yearlyProgressPercentage)}%</span>
              </div>
              <Progress value={yearlyProgressPercentage} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Streak Card */}
        <Card className="spiritual-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center text-lg">
              <Flame className="mr-2 h-5 w-5 text-orange-500" />
              निरंतरता
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary mb-1">{stats.currentStreak}</div>
              <div className="text-sm text-muted-foreground">दिन लगातार</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Motivational Quote */}
      <Card className="spiritual-card">
        <CardContent className="p-6 text-center">
          <blockquote className="text-lg italic text-foreground mb-2">
            "मन को शांत करें, एक माला एक बार में।"
          </blockquote>
          <div className="text-sm text-muted-foreground">- धार्मिक जप काउंटर</div>
        </CardContent>
      </Card>
    </div>
  );
};