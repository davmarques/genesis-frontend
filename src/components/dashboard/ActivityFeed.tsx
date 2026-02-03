import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, 
  Trophy, 
  AlertTriangle, 
  Plus, 
  Star, 
  Loader2, 
  Clock,
  ArrowRight
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRole } from "@/contexts/RoleContext";
import { apiFetch } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Activity {
  id: string;
  type: string;
  fromSector: string;
  fromUnidade: string;
  toSector: string;
  toUnidade: string;
  description: string;
  points: number;
  timestamp: string;
  status?: string;
}

export const ActivityFeed = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { role, userSector } = useRole();

  useEffect(() => {
    fetchActivities();
  }, [userSector, role]);

  const fetchActivities = async () => {
    try {
      setIsLoading(true);
      
      // Buscar setores para identificar a unidade do usuário se não for PMO
      let unitIdToFilter = null;
      if (role !== "pmo") {
        const sectors = await apiFetch("/admin/sectors").catch(() => []);
        const mySector = sectors.find((s: any) => 
          s.nome.trim().toLowerCase() === userSector.trim().toLowerCase()
        );
        if (mySector) unitIdToFilter = mySector.unidade_id;
      }

      let query = supabase
        .from("notificacoes")
        .select(`
          *,
          setor:setor_id(nome),
          unidade:unidade_id(nome),
          setor_ref:id_setor_ref(nome),
          unidade_ref:id_unidade_ref(nome)
        `)
        .order("created_at", { ascending: false })
        .limit(10);

      if (unitIdToFilter) {
        query = query.eq('unidade_id', unitIdToFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      const formatted = (data || []).map((n: any) => ({
        id: n.id,
        type: n.notified ? "alert" : "absence",
        fromSector: n.setor_ref?.nome || "Sistema",
        fromUnidade: n.unidade_ref?.nome || "Geral",
        toSector: n.setor?.nome || "Auditado",
        toUnidade: n.unidade?.nome || "Unidade",
        description: n.description,
        points: n.notified ? -50 : -100, // Pontos negativos para o receptor
        timestamp: n.created_at,
        status: n.status
      }));

      setActivities(formatted);
    } catch (error) {
      console.error("Erro ao buscar atividades:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), {
        addSuffix: true,
        locale: ptBR,
      });
    } catch (e) {
      return timestamp;
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "Audit":
      case "audit":
        return <Trophy className="w-5 h-5 text-primary" />;
      case "Alerta":
      case "alert":
        return <AlertTriangle className="w-5 h-5 text-warning" />;
      case "Ausência":
      case "absence":
        return <AlertTriangle className="w-5 h-5 text-destructive" />;
      case "Agravamento":
      case "aggravation":
        return <Star className="w-5 h-5 text-gold" />;
      default:
        return <Plus className="w-5 h-5" />;
    }
  };

  const getActivityLabel = (type: string) => {
    switch (type) {
      case "Audit":
      case "audit":
        return "Auditoria";
      case "Alerta":
      case "alert":
        return "Alerta";
      case "Ausência":
      case "absence":
        return "Ausência";
      case "Agravamento":
      case "aggravation":
        return "Agravamento";
      default:
        return type || "Atividade";
    }
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="mb-6">
        <h3 className="text-xl font-bold text-foreground">Atividade Recente</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Últimas ações registradas no sistema
        </p>
      </div>

      <div className="space-y-4">
        {activities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma atividade registrada ainda.
          </div>
        ) : (
          activities.map((activity, index) => (
            <div key={activity.id} className="flex items-start gap-4">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  {getActivityIcon(activity.type)}
                </div>
                {index < activities.length - 1 && (
                  <div className="absolute left-1/2 top-10 w-0.5 h-8 bg-border -translate-x-1/2" />
                )}
              </div>

              <div className="flex-1 pb-4">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                        {getActivityLabel(activity.type)}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTimestamp(activity.timestamp)}
                      </span>
                      {activity.status && (
                        <Badge variant="outline" className={`text-[9px] ${
                          activity.status === "pending" ? "bg-warning/10 text-warning border-warning/30" :
                          activity.status === "disputed" ? "bg-destructive/10 text-destructive border-destructive/30" :
                          "bg-success/10 text-success border-success/30"
                        }`}>
                          {activity.status === "pending" ? "Pendente" :
                           activity.status === "disputed" ? "Contestada" : "Aceita"}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-muted-foreground uppercase">De:</span>
                        <span className="text-xs font-semibold text-foreground py-0.5 px-2 bg-muted rounded">
                          {activity.fromUnidade} • {activity.fromSector}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-primary uppercase">Para:</span>
                        <span className="text-xs font-semibold text-primary py-0.5 px-2 bg-primary/10 rounded">
                          {activity.toUnidade} • {activity.toSector}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Badge className={`${activity.points >= 0 ? "bg-success/20 text-success border-success/30" : "bg-destructive/20 text-destructive border-destructive/30"} font-bold flex-shrink-0 variant-outline`}>
                    {activity.points > 0 ? "+" : ""}{activity.points}
                  </Badge>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
};
