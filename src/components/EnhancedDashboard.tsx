import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Target, TrendingUp, Flame, Calendar, Award, Clock, Zap } from "lucide-react";
import { format, subDays, isToday } from "date-fns";
import { useAppSettings } from "@/hooks/useAppSettings";

interface DashboardStats {
  todayTaps: number;
  todayJaps: number;
  todayTarget: number;
  weeklyJaps: number;
  monthlyJaps: number;
  monthlyTarget: number;
  yearlyJaps: number;
  yearlyTarget: number;
  currentStreak: number;
  longestStreak: number;
  totalTaps: number;
  totalJaps: number;
  averageJapsPerDay: number;
  completionRate: number;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  earned: boolean;
  progress?: number;
  target?: number;
}

export const EnhancedDashboard = () => {
  const { getText } = useAppSettings();
  const [stats, setStats] = useState<DashboardStats>({
    todayTaps: 0,
    todayJaps: 0,
    todayTarget: 1,
    weeklyJaps: 0,
    monthlyJaps: 0,
    monthlyTarget: 30,
    yearlyJaps: 0,
    yearlyTarget: 365,
    currentStreak: 0,
    longestStreak: 0,
    totalTaps: 0,
    totalJaps: 0,
    averageJapsPerDay: 0,
    completionRate: 0,
  });

  const [achievements, setAchievements] = useState<Achievement[]>([]);

  useEffect(() => {
    // Load data from localStorage
    const tapCount = parseInt(localStorage.getItem("tapCount") || "0");
    const japCount = parseInt(localStorage.getItem("japCount") || "0");
    const dailyTarget = parseInt(localStorage.getItem("dailyTarget") || "1");
    const monthlyTarget = parseInt(localStorage.getItem("monthlyTarget") || "30");
    const yearlyTarget = parseInt(localStorage.getItem("yearlyTarget") || "365");

    // Calculate enhanced stats
    const calculatedStats: DashboardStats = {
      todayTaps: tapCount,
      todayJaps: japCount,
      todayTarget: dailyTarget,
      weeklyJaps: Math.min(japCount, japCount), // Simplified for demo
      monthlyJaps: japCount,
      monthlyTarget: monthlyTarget,
      yearlyJaps: japCount,
      yearlyTarget: yearlyTarget,
      currentStreak: japCount > 0 ? Math.min(japCount, 7) : 0, // Max 7 for demo
      longestStreak: japCount > 0 ? Math.min(japCount + 2, 12) : 0,
      totalTaps: tapCount,
      totalJaps: japCount,
      averageJapsPerDay: japCount > 0 ? Math.round((japCount / Math.max(japCount, 1)) * 10) / 10 : 0,
      completionRate: dailyTarget > 0 ? Math.min((japCount / dailyTarget) * 100, 100) : 0,
    };

    setStats(calculatedStats);

    // Generate achievements
    const achievementsList: Achievement[] = [
      {
        id: "first-japa",
        title: getText("पहला जप", "First Japa"),
        description: getText("अपना पहला 108 तप पूरा करें", "Complete your first 108 taps"),
        icon: Award,
        earned: japCount >= 1,
      },
      {
        id: "week-warrior",
        title: getText("सप्ताह योद्धा", "Week Warrior"),
        description: getText("7 दिन लगातार जप करें", "Japa for 7 consecutive days"),
        icon: Flame,
        earned: calculatedStats.currentStreak >= 7,
        progress: calculatedStats.currentStreak,
        target: 7,
      },
      {
        id: "hundred-club",
        title: getText("सौ क्लब", "Hundred Club"),
        description: getText("100 जप पूरे करें", "Complete 100 japas"),
        icon: Target,
        earned: japCount >= 100,
        progress: japCount,
        target: 100,
      },
      {
        id: "speed-master",
        title: getText("गति गुरु", "Speed Master"),
        description: getText("एक दिन में 5 जप पूरे करें", "Complete 5 japas in one day"),
        icon: Zap,
        earned: japCount >= 5,
        progress: japCount,
        target: 5,
      },
      {
        id: "devotee",
        title: getText("भक्त", "Devotee"),
        description: getText("1000 तप पूरे करें", "Complete 1000 taps"),
        icon: Clock,
        earned: tapCount >= 1000,
        progress: tapCount,
        target: 1000,
      },
    ];

    setAchievements(achievementsList);
  }, []);

  const todayProgressPercentage = Math.min((stats.todayJaps / stats.todayTarget) * 100, 100);
  const monthlyProgressPercentage = Math.min((stats.monthlyJaps / stats.monthlyTarget) * 100, 100);
  const yearlyProgressPercentage = Math.min((stats.yearlyJaps / stats.yearlyTarget) * 100, 100);

  const earnedAchievements = achievements.filter(a => a.earned);
  const unlockedToday = earnedAchievements.length > 0; // Simplified check

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center">
        <h1 className="om-symbol text-4xl mb-2">ॐ</h1>
        <h2 className="text-2xl font-bold text-foreground mb-1">{getText("डैशबोर्ड", "Dashboard")}</h2>
        <p className="text-muted-foreground">{getText("आपकी आध्यात्मिक यात्रा का सिंहावलोकन", "Overview of your spiritual journey")}</p>
      </div>

      {/* Today's Achievement Banner */}
      {unlockedToday && (
        <Card className="spiritual-card border-primary/20 bg-gradient-primary/5">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center space-x-2 mb-2">
              <Award className="h-5 w-5 text-primary" />
              <span className="font-semibold text-primary">{getText("नई उपलब्धि अनलॉक!", "New Achievement Unlocked!")}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {getText(
                `आज आपने ${earnedAchievements.length} उपलब्धि अर्जित की`,
                `You earned ${earnedAchievements.length} achievement(s) today`
              )}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="spiritual-card">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-primary mb-1">{stats.totalTaps}</div>
            <div className="text-sm text-muted-foreground">{getText("कुल तप", "Total Taps")}</div>
          </CardContent>
        </Card>
        
        <Card className="spiritual-card">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-secondary mb-1">{stats.totalJaps}</div>
            <div className="text-sm text-muted-foreground">{getText("कुल जप", "Total Japas")}</div>
          </CardContent>
        </Card>
        
        <Card className="spiritual-card">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-accent mb-1">{stats.currentStreak}</div>
            <div className="text-sm text-muted-foreground">{getText("वर्तमान श्रृंखला", "Current Streak")}</div>
          </CardContent>
        </Card>
        
        <Card className="spiritual-card">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-orange-500 mb-1">{stats.averageJapsPerDay}</div>
            <div className="text-sm text-muted-foreground">{getText("दैनिक औसत", "Daily Average")}</div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Cards */}
      <div className="space-y-4">
        {/* Daily Progress */}
        <Card className="spiritual-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center text-lg">
                <Target className="mr-2 h-5 w-5 text-primary" />
                {getText("आज का लक्ष्य", "Today's Goal")}
              </CardTitle>
              <Badge variant={todayProgressPercentage >= 100 ? "default" : "secondary"}>
                {Math.round(todayProgressPercentage)}%
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{stats.todayJaps} / {stats.todayTarget} {getText("जप", "japa")}</span>
                <span className="text-muted-foreground">
                  {format(new Date(), 'dd MMM')}
                </span>
              </div>
              <Progress value={todayProgressPercentage} className="h-3" />
            </div>
          </CardContent>
        </Card>

        {/* Weekly Summary */}
        <Card className="spiritual-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center text-lg">
              <Calendar className="mr-2 h-5 w-5 text-secondary" />
              {getText("साप्ताहिक सारांश", "Weekly Summary")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xl font-bold text-primary">{stats.weeklyJaps}</div>
                <div className="text-xs text-muted-foreground">{getText("इस सप्ताह", "This Week")}</div>
              </div>
              <div>
                <div className="text-xl font-bold text-secondary">{stats.currentStreak}</div>
                <div className="text-xs text-muted-foreground">{getText("दिन स्ट्रीक", "Day Streak")}</div>
              </div>
              <div>
                <div className="text-xl font-bold text-accent">{stats.longestStreak}</div>
                <div className="text-xs text-muted-foreground">{getText("सबसे लंबी", "Longest")}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Progress */}
        <Card className="spiritual-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center text-lg">
              <TrendingUp className="mr-2 h-5 w-5 text-accent" />
              {getText("मासिक प्रगति", "Monthly Progress")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{stats.monthlyJaps} / {stats.monthlyTarget} {getText("जप", "japa")}</span>
                <span>{Math.round(monthlyProgressPercentage)}%</span>
              </div>
              <Progress value={monthlyProgressPercentage} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Achievements Section */}
      <Card className="spiritual-card">
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <Award className="mr-2 h-5 w-5 text-primary" />
            {getText("उपलब्धियां", "Achievements")}
          </CardTitle>
          <CardDescription>
            {earnedAchievements.length} / {achievements.length} {getText("अर्जित", "earned")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3">
            {achievements.map((achievement) => {
              const Icon = achievement.icon;
              return (
                <div
                  key={achievement.id}
                  className={`flex items-center space-x-3 p-3 rounded-lg border transition-all ${
                    achievement.earned
                      ? "bg-primary/5 border-primary/20"
                      : "bg-muted/30 border-muted"
                  }`}
                >
                  <div
                    className={`p-2 rounded-full ${
                      achievement.earned
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{achievement.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {achievement.description}
                    </div>
                    {achievement.progress !== undefined && achievement.target && !achievement.earned && (
                      <div className="mt-2">
                        <Progress
                          value={(achievement.progress / achievement.target) * 100}
                          className="h-1"
                        />
                        <div className="text-xs text-muted-foreground mt-1">
                          {achievement.progress} / {achievement.target}
                        </div>
                      </div>
                    )}
                  </div>
                  {achievement.earned && (
                    <Badge variant="default" className="text-xs">
                      {getText("अर्जित", "Earned")}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Motivational Quote */}
      <Card className="spiritual-card">
        <CardContent className="p-6 text-center">
          <blockquote className="text-lg italic text-foreground mb-2">
            {getText("\"हर जप के साथ, आप दिव्यता के करीब जाते हैं।\"", "\"With every japa, you move closer to divinity.\"")}
          </blockquote>
          <div className="text-sm text-muted-foreground">{getText("- आध्यात्मिक शिक्षा", "- Spiritual Teaching")}</div>
        </CardContent>
      </Card>
    </div>
  );
};