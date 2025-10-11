import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bell, BellOff, Trash2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { PriceAlert } from "@shared/schema";

export default function Alerts() {
  const { toast } = useToast();
  const [contractSymbol, setContractSymbol] = useState("/NQ");
  const [alertType, setAlertType] = useState("price_above");
  const [targetPrice, setTargetPrice] = useState("");
  const [percentage, setPercentage] = useState("");

  const { data: alerts } = useQuery<PriceAlert[]>({
    queryKey: ['/api/alerts'],
  });

  const createAlertMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('POST', '/api/alerts', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/alerts'] });
      toast({
        title: "Alert Created",
        description: "Your price alert has been created successfully.",
      });
      setTargetPrice("");
      setPercentage("");
    },
  });

  const deleteAlertMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/alerts/${id}`, null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/alerts'] });
      toast({
        title: "Alert Deleted",
        description: "The alert has been deleted successfully.",
      });
    },
  });

  const toggleAlertMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: number }) => {
      return await apiRequest('PATCH', `/api/alerts/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/alerts'] });
    },
  });

  const handleCreateAlert = () => {
    const data: any = {
      contractSymbol,
      alertType,
      isActive: 1,
      triggered: 0,
    };

    if (alertType === "movement_exceeded" && percentage) {
      data.percentage = parseFloat(percentage);
    } else if (targetPrice) {
      data.targetPrice = parseFloat(targetPrice);
    }

    createAlertMutation.mutate(data);
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Price Alerts</h1>
        <p className="text-muted-foreground mt-1">
          Create and manage price movement alerts
        </p>
      </div>

      <Card data-testid="card-create-alert">
        <CardHeader>
          <CardTitle>Create New Alert</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contract">Contract</Label>
              <Select value={contractSymbol} onValueChange={setContractSymbol}>
                <SelectTrigger id="contract" data-testid="select-alert-contract">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="/NQ">/NQ - Nasdaq 100</SelectItem>
                  <SelectItem value="/ES">/ES - S&P 500</SelectItem>
                  <SelectItem value="/YM">/YM - Dow Jones</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Alert Type</Label>
              <Select value={alertType} onValueChange={setAlertType}>
                <SelectTrigger id="type" data-testid="select-alert-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="price_above">Price Above</SelectItem>
                  <SelectItem value="price_below">Price Below</SelectItem>
                  <SelectItem value="movement_exceeded">Movement Exceeded</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {alertType === "movement_exceeded" ? (
            <div className="space-y-2">
              <Label htmlFor="percentage">Percentage Movement (%)</Label>
              <Input
                id="percentage"
                type="number"
                step="0.1"
                placeholder="e.g., 2.5"
                value={percentage}
                onChange={(e) => setPercentage(e.target.value)}
                data-testid="input-percentage"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="price">Target Price</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                placeholder="e.g., 16500.00"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                data-testid="input-target-price"
              />
            </div>
          )}

          <Button 
            onClick={handleCreateAlert} 
            className="w-full"
            disabled={createAlertMutation.isPending || (!targetPrice && !percentage)}
            data-testid="button-create-alert"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Alert
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-xl font-semibold">Active Alerts</h2>
        {alerts && alerts.length > 0 ? (
          alerts.map((alert) => (
            <Card key={alert.id} data-testid={`card-alert-${alert.id}`}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  {alert.isActive === 1 ? (
                    <Bell className="h-5 w-5 text-primary" />
                  ) : (
                    <BellOff className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium">{alert.contractSymbol}</span>
                      <Badge variant={alert.triggered === 1 ? "destructive" : "default"}>
                        {alert.triggered === 1 ? "Triggered" : "Active"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {alert.alertType === "price_above" && `Price above $${alert.targetPrice?.toFixed(2)}`}
                      {alert.alertType === "price_below" && `Price below $${alert.targetPrice?.toFixed(2)}`}
                      {alert.alertType === "movement_exceeded" && `Movement exceeds ${alert.percentage}%`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleAlertMutation.mutate({ 
                      id: alert.id, 
                      isActive: alert.isActive === 1 ? 0 : 1 
                    })}
                    data-testid={`button-toggle-${alert.id}`}
                  >
                    {alert.isActive === 1 ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteAlertMutation.mutate(alert.id)}
                    data-testid={`button-delete-${alert.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Bell className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Alerts Yet</h3>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                Create your first price alert to get notified when price targets are reached.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
