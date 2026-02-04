import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, CheckCircle2, Clock, AlertCircle, Star, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useRole } from "@/contexts/RoleContext";

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  points: number;
  status: "pending" | "completed" | "overdue" | "in-progress";
  priority: "low" | "medium" | "high";
  assignedTo?: string;
  dueDate: string;
}

interface ChecklistManagerProps {
  role: "pmo" | "manager" | "collaborator";
}

export const ChecklistManager = ({ role: componentRole }: ChecklistManagerProps) => {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { role, userSectorId } = useRole();

  const fetchChecklists = async () => {
    try {
      setIsLoading(true);
      let query = supabase
        .from('checklist')
        .select('*')
        .order('created_at', { ascending: false });

      if (role !== 'pmo' && userSectorId) {
        query = query.eq('setor_id', userSectorId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const formatted = (data || []).map(item => ({
        id: item.id.toString(),
        title: item.title,
        description: item.description,
        points: item.points || 0,
        status: (item.status === 'completed' ? 'completed' : 
                 item.status === 'overdue' ? 'overdue' : 'pending'),
        priority: item.priority || 'medium',
        dueDate: item.dueDate ? new Date(item.dueDate).toLocaleDateString('pt-BR') : 'Sem data'
      }));

      setItems(formatted as ChecklistItem[]);
    } catch (error) {
      console.error("Erro ao carregar checklists:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchChecklists();
  }, [userSectorId, role]);

  const toggleItem = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "completed" ? "pending" : "completed";
    
    try {
      const { error } = await supabase
        .from('checklist')
        .update({ status: newStatus })
        .eq('id', id);
      
      if (error) throw error;
      
      setItems(items.map(item => 
        item.id === id 
          ? { ...item, status: newStatus as any }
          : item
      ));
    } catch (error) {
      console.error("Erro ao atualizar status do checklist:", error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="w-5 h-5 text-success" />;
      case "overdue": return <AlertCircle className="w-5 h-5 text-destructive" />;
      default: return <Clock className="w-5 h-5 text-warning" />;
    }
  };

  const getPriorityBadge = (priority: string) => {
    const colors = {
      high: "bg-destructive/10 text-destructive border-destructive/30",
      medium: "bg-warning/10 text-warning border-warning/30",
      low: "bg-success/10 text-success border-success/30",
    };
    return colors[priority as keyof typeof colors] || colors.medium;
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-foreground">
            {role === "collaborator" ? "Minhas Atividades" : "Checklist do Setor"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {isLoading ? "Carregando..." : `${items.filter(i => i.status === "pending").length} atividades pendentes`}
          </p>
        </div>
        {(role === "manager" || role === "pmo") && (
          <Button className="gap-2 bg-primary hover:bg-primary/90">
            <Plus className="w-4 h-4" />
            Nova Atividade
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground italic">
            Nenhuma atividade cadastrada para este setor.
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className={cn(
                "p-4 rounded-lg border-2 transition-all",
                item.status === "completed" 
                  ? "bg-success/5 border-success/30" 
                  : item.status === "overdue"
                  ? "bg-destructive/5 border-destructive/30"
                  : "bg-card border-border hover:border-primary/50"
              )}
            >
              <div className="flex items-start gap-4">
                <div className="pt-1">
                  <Checkbox
                    checked={item.status === "completed"}
                    onCheckedChange={() => toggleItem(item.id, item.status)}
                    className="border-2"
                  />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1">
                      <h4 className={cn(
                        "font-semibold text-foreground mb-1",
                        item.status === "completed" && "line-through text-muted-foreground"
                      )}>
                        {item.title}
                      </h4>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {item.points === 100 && (
                        <Star className="w-4 h-4 text-gold fill-gold" />
                      )}
                      <Badge className="bg-primary/10 text-primary border-primary/30 font-bold">
                        +{item.points}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(item.status)}
                      <span className="text-xs text-muted-foreground">{item.dueDate}</span>
                    </div>
                    
                    <Badge variant="outline" className={getPriorityBadge(item.priority)}>
                      {item.priority === "high" ? "Alta" : item.priority === "medium" ? "Média" : "Baixa"}
                    </Badge>

                    {item.assignedTo && (
                      <span className="text-xs text-muted-foreground">
                        Responsável: {item.assignedTo}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-border">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total de pontos possíveis:</span>
          <span className="text-xl font-bold text-foreground">
            {items.reduce((acc, item) => acc + item.points, 0)} pontos
          </span>
        </div>
      </div>
    </Card>
  );
};
