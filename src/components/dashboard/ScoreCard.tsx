import { Card } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScoreCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  trend?: string;
  variant?: "default" | "primary" | "success" | "warning" | "destructive";
}

export const ScoreCard = ({ title, value, icon: Icon, trend, variant = "default" }: ScoreCardProps) => {
  const variantStyles = {
    default: "from-card to-card border-border",
    primary: "from-primary/5 to-primary/10 border-primary/30",
    success: "from-success/5 to-success/10 border-success/30",
    warning: "from-warning/5 to-warning/10 border-warning/30",
    destructive: "from-destructive/5 to-destructive/10 border-destructive/30",
  };

  const iconStyles = {
    default: "bg-muted text-foreground",
    primary: "bg-primary text-primary-foreground",
    success: "bg-success text-success-foreground",
    warning: "bg-warning text-warning-foreground",
    destructive: "bg-destructive text-destructive-foreground",
  };

  return (
    <Card className={cn("p-6 bg-gradient-to-br border-2", variantStyles[variant])}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
          <p className="text-3xl font-bold text-foreground">{value}</p>
        </div>
        <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center", iconStyles[variant])}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </Card>
  );
};
