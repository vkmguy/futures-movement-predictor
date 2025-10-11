import { BarChart3, Home, LineChart, TrendingUp } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import type { FuturesContract } from "@shared/schema";

const menuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: Home,
  },
  {
    title: "Analytics",
    url: "/analytics",
    icon: LineChart,
  },
  {
    title: "Predictions",
    url: "/predictions",
    icon: TrendingUp,
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { data: contracts } = useQuery<FuturesContract[]>({
    queryKey: ['/api/contracts'],
  });

  return (
    <Sidebar data-testid="sidebar-main">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <BarChart3 className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-sidebar-foreground">Futures Predictor</span>
            <span className="text-xs text-muted-foreground">Movement Analysis</span>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`link-${item.title.toLowerCase()}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Market Overview</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="px-2 space-y-2">
              {contracts?.map((contract) => {
                const isPositive = contract.dailyChange >= 0;
                return (
                  <div key={contract.symbol} className="flex items-center justify-between py-1.5" data-testid={`info-contract-${contract.symbol.replace('/', '')}`}>
                    <div className="flex flex-col">
                      <span className="text-xs font-mono font-medium">{contract.symbol}</span>
                      <span className="text-xs text-muted-foreground">{contract.name}</span>
                    </div>
                    <Badge variant={isPositive ? "default" : "destructive"} className="text-xs">
                      {isPositive ? "+" : ""}{contract.dailyChangePercent.toFixed(2)}%
                    </Badge>
                  </div>
                );
              })}
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
