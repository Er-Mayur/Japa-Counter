import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { useJapaSessions, JapaSessionData } from "@/hooks/useJapaSessions";

export const Calendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const { sessions, loading, getSessionData } = useJapaSessions();

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(direction === 'prev' ? subMonths(currentDate, 1) : addMonths(currentDate, 1));
  };

  const getDayData = (date: Date): JapaSessionData | null => {
    return getSessionData(date);
  };

  const getDayColor = (date: Date) => {
    const data = getDayData(date);
    if (!data || data.japs === 0) return "";
    
    if (data.japs >= 5) return "text-green-600";
    if (data.japs >= 3) return "text-yellow-600"; 
    if (data.japs >= 1) return "text-orange-600";
    return "";
  };

  // Generate calendar days
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const startDate = new Date(monthStart);
  startDate.setDate(startDate.getDate() - monthStart.getDay());

  const calendarDays = [];
  for (let i = 0; i < 42; i++) {
    const day = new Date(startDate);
    day.setDate(startDate.getDate() + i);
    calendarDays.push(day);
  }

  const selectedDayData = getDayData(selectedDate);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center">
        <h1 className="om-symbol text-4xl mb-2">ॐ</h1>
        <h2 className="text-2xl font-bold text-foreground mb-1">कैलेंडर</h2>
        <p className="text-muted-foreground">आपकी दैनिक जप यात्रा</p>
      </div>

      {/* Calendar Card */}
      <Card className="spiritual-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateMonth('prev')}
              className="rounded-full"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <CardTitle className="text-lg">
              {format(currentDate, 'MMMM yyyy')}
            </CardTitle>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateMonth('next')}
              className="rounded-full"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['रवि', 'सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि'].map((day) => (
              <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
                {day}
              </div>
            ))}
          </div>
          
          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, index) => (
              <div 
                key={format(day, 'yyyy-MM-dd')}
                className={`
                  relative h-16 flex flex-col items-center justify-center cursor-pointer rounded-lg transition-all duration-200
                  ${!isSameMonth(day, currentDate) ? 'text-muted-foreground/50' : 'text-foreground'}
                  ${isSameDay(day, selectedDate) ? 'bg-primary text-primary-foreground shadow-md' : 'hover:bg-primary/10'}
                  ${getDayColor(day)}
                `}
                onClick={() => setSelectedDate(day)}
              >
                <span className="text-sm font-medium">
                  {format(day, 'd')}
                </span>
                
                {/* Japa count below date */}
                {isSameMonth(day, currentDate) && getDayData(day) && (
                  <span className="text-xs text-muted-foreground mt-1">
                    {getDayData(day)!.japs} जप
                  </span>
                )}
                
                {/* Progress dots */}
                {isSameMonth(day, currentDate) && (
                  <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2">
                    <div className={`w-1 h-1 rounded-full ${
                      getDayData(day) ? 
                        getDayData(day)!.japs >= 5 ? 'bg-green-500' :
                        getDayData(day)!.japs >= 3 ? 'bg-yellow-500' :
                        getDayData(day)!.japs >= 1 ? 'bg-orange-500' : 'bg-gray-300'
                      : 'bg-gray-300'
                    }`} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Selected Day Details */}
      {selectedDayData && (
        <Card className="spiritual-card">
          <CardHeader>
            <CardTitle className="text-lg">
              {format(selectedDate, 'dd MMMM yyyy')} का विवरण
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary mb-1">
                  {selectedDayData.taps}
                </div>
                <div className="text-sm text-muted-foreground">तप</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-secondary mb-1">
                  {selectedDayData.japs}
                </div>
                <div className="text-sm text-muted-foreground">जप</div>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-border">
              <div className="text-center">
                <div className="text-sm text-muted-foreground mb-2">दैनिक प्रगति</div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min((selectedDayData.japs / 5) * 100, 100)}%` }}
                  />
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {Math.round((selectedDayData.japs / 5) * 100)}% लक्ष्य पूरा
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Legend */}
      <Card className="spiritual-card">
        <CardContent className="p-4">
          <h3 className="font-semibold mb-3 text-center">रंग गाइड</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span>5+ जप (उत्कृष्ट)</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <span>3+ जप (अच्छा)</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-orange-500"></div>
              <span>1+ जप (शुरुआत)</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-gray-300"></div>
              <span>कोई जप नहीं</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};