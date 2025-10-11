import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useMarketData } from "@/hooks/use-market-data";
import { useMarketStatus } from "@/hooks/use-market-status";
import { Button } from "@/components/ui/button";
import { Wifi, WifiOff } from "lucide-react";
import Dashboard from "@/pages/dashboard";
import Analytics from "@/pages/analytics";
import Predictions from "@/pages/predictions";
import Backtesting from "@/pages/backtesting";
import Alerts from "@/pages/alerts";
import WeeklyTracker from "@/pages/weekly-tracker";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/predictions" component={Predictions} />
      <Route path="/backtesting" component={Backtesting} />
      <Route path="/alerts" component={Alerts} />
      <Route path="/weekly-tracker" component={WeeklyTracker} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  // Connect to live market data WebSocket with toggle control
  const { isConnected, isEnabled, toggleConnection } = useMarketData();
  
  // Get market status
  const { data: marketStatus } = useMarketStatus();
  
  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  } as React.CSSProperties;

  return (
    <ThemeProvider defaultTheme="dark">
      <TooltipProvider>
        <SidebarProvider style={sidebarStyle}>
          <div className="flex h-screen w-full">
            <AppSidebar />
            <div className="flex flex-col flex-1 overflow-hidden">
              <header className="flex items-center justify-between h-14 px-4 border-b border-border bg-background">
                <div className="flex items-center gap-3">
                  <SidebarTrigger data-testid="button-sidebar-toggle" />
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Market Status:</span>
                    <span className="flex items-center gap-1.5">
                      <span 
                        className={`h-2 w-2 rounded-full ${
                          marketStatus?.isOpen 
                            ? 'bg-primary animate-pulse' 
                            : 'bg-destructive'
                        }`}
                        data-testid="indicator-market-status"
                      />
                      <span className="text-sm text-muted-foreground" data-testid="text-market-status">
                        {marketStatus?.isOpen ? 'Open' : 'Closed'}
                      </span>
                    </span>
                    {marketStatus?.message && (
                      <span className="text-xs text-muted-foreground ml-1">
                        ({marketStatus.message})
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={toggleConnection}
                        className={isConnected ? "border-primary" : ""}
                        data-testid="button-websocket-toggle"
                      >
                        {isEnabled ? (
                          <Wifi className={`h-4 w-4 ${isConnected ? 'text-primary' : ''}`} />
                        ) : (
                          <WifiOff className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{isConnected ? 'Live Data Connected' : isEnabled ? 'Connecting...' : 'Live Data Disconnected'}</p>
                      <p className="text-xs text-muted-foreground">Click to {isEnabled ? 'disconnect' : 'connect'}</p>
                    </TooltipContent>
                  </Tooltip>
                  <span className="text-sm text-muted-foreground" data-testid="text-current-time">
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <ThemeToggle />
                </div>
              </header>
              <main className="flex-1 overflow-y-auto bg-background">
                <Router />
              </main>
            </div>
          </div>
        </SidebarProvider>
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}
