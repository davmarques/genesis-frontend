import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, XCircle, Clock, Image, FileText, Loader2, Link as LinkIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRole } from "@/contexts/RoleContext";
import { apiFetch } from "@/lib/api";

interface Notification {
  id: string;
  type: string;
  fromSector: string;
  fromUnidade: string;
  toSector: string;
  toUnidade: string;
  description: string;
  points: number;
  status: string;
  timestamp: string;
  has_evidence?: boolean;
}

interface NotificationPanelProps {
  role: "pmo" | "manager";
}

export const NotificationPanel = ({ role: componentRole }: NotificationPanelProps) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { role, userSector } = useRole();

  useEffect(() => {
    fetchNotifications();
  }, [userSector, role]);

  const fetchNotifications = async () => {
    try {
      setIsLoading(true);
      
      // Buscar unidade do usuário se não for PMO
      let unitIdToFilter = null;
      let sectorIdToFilter = null;
      if (role !== "pmo") {
        const sectors = await apiFetch("/admin/sectors").catch(() => []);
        const mySector = sectors.find((s: any) => 
          s.nome.trim().toLowerCase() === userSector.trim().toLowerCase()
        );
        if (mySector) {
          unitIdToFilter = mySector.unidade_id;
          sectorIdToFilter = mySector.id;
        }
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
        .limit(5);

      if (role !== "pmo") {
        if (sectorIdToFilter) {
          // Filtro por setor (Pedido do usuário): vê o que enviou OU o que recebeu no seu setor específico
          query = query.or(`setor_id.eq.${sectorIdToFilter},id_setor_ref.eq.${sectorIdToFilter}`);
        } else if (unitIdToFilter) {
          // Fallback para unidade apenas se não houver setor
          query = query.eq('unidade_id', unitIdToFilter);
        } else {
          // Usuário sem setor/unidade identificado
          setNotifications([]);
          setIsLoading(false);
          return;
        }
      }

      const { data, error } = await query;

      if (error) throw error;

      const formattedData = (data || []).map((n: any) => ({
        id: n.id,
        type: n.notified ? "alert" : "absence",
        fromSector: n.setor_ref?.nome || "Sistema",
        fromUnidade: n.unidade_ref?.nome || "Geral",
        toSector: n.setor?.nome || "Auditado",
        toUnidade: n.unidade?.nome || "Unidade",
        description: n.description,
        points: n.notified ? -50 : -100,
        status: n.status || "pending",
        timestamp: n.created_at,
        has_evidence: !!n.upload_url
      }));

      setNotifications(formattedData);
    } catch (error) {
      console.error("Erro ao buscar notificações:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const isoString = timestamp.includes('T') 
        ? timestamp 
        : timestamp.replace(' ', 'T');
      const dateObj = new Date(isoString.endsWith('Z') || isoString.includes('+') ? isoString : `${isoString}Z`);
      return dateObj.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    } catch (e) {
      return timestamp;
    }
  };

  const getTypeInfo = (type: string) => {
    switch (type) {
      case "Alerta":
      case "alert":
        return { 
          label: "Notificação de Alerta", 
          color: "bg-warning/10 text-warning border-warning/30",
          icon: <AlertTriangle className="w-4 h-4" />
        };
      case "Ausência":
      case "absence":
        return { 
          label: "Notificação de Ausência", 
          color: "bg-destructive/10 text-destructive border-destructive/30",
          icon: <XCircle className="w-4 h-4" />
        };
      case "Agravamento":
      case "aggravation":
        return { 
          label: "Notificação de Agravamento", 
          color: "bg-destructive text-destructive-foreground",
          icon: <AlertTriangle className="w-4 h-4 fill-current" />
        };
      case "Audit":
      case "audit":
        return { 
          label: "Pontos de Auditoria", 
          color: "bg-primary/10 text-primary border-primary/30",
          icon: <CheckCircle2 className="w-4 h-4" />
        };
      default:
        return { 
          label: type || "Notificação", 
          color: "bg-muted text-foreground",
          icon: <FileText className="w-4 h-4" />
        };
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('notificacoes')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;
      
      const statusLabels: Record<string, string> = {
        accepted: "reconhecida",
        disputed: "contestada",
        approved: "aprovada",
        rejected: "rejeitada"
      };

      await fetchNotifications();
    } catch (error: any) {
      console.error("Erro ao atualizar status:", error);
    }
  };

  const statusMap: Record<string, string> = {
    pending: "Pendente",
    disputed: "Contestada",
    accepted: "Aceita",
    approved: "Aprovada",
    rejected: "Rejeitada"
  };

  const getStatusBadge = (status: string) => {
    const s = status?.toLowerCase() || "pending";
    switch (s) {
      case "pending":
      case "pendente":
        return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">Pendente</Badge>;
      case "disputed":
      case "contestada":
        return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">Contestada</Badge>;
      case "accepted":
      case "aceita":
      case "approved":
        return <Badge variant="outline" className="bg-success/10 text-success border-success/30">Aceita</Badge>;
      default:
        return <Badge variant="outline">{statusMap[s] || s}</Badge>;
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-foreground">
            {role === "pmo" ? "Gestão de Notificações" : "Notificações Recentes"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Exibindo as últimas ocorrências
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.location.href='/notifications'}>
          Ver Todas
        </Button>
      </div>

      <div className="space-y-4">
        {notifications.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma notificação encontrada.
          </div>
        ) : (
          notifications.map((notification) => {
            const typeInfo = getTypeInfo(notification.type);
            return (
              <div key={notification.id} className="p-4 rounded-lg border-2 border-border bg-card hover:border-primary/50 transition-all">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className={typeInfo.color} variant="outline">
                        {typeInfo.icon}
                        <span className="ml-1">{typeInfo.label}</span>
                      </Badge>
                      {getStatusBadge(notification.status)}
                    </div>
                    <Badge className={`${notification.points > 0 ? "bg-success" : "bg-destructive"} text-white font-bold`}>
                      {notification.points > 0 ? "+" : ""}{notification.points}
                    </Badge>
                  </div>

                  <div>
                    <div className="flex flex-col gap-1.5 mb-2">
                       <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase">
                        <span className="bg-muted px-1.5 py-0.5 rounded">De: {notification.fromUnidade} • {notification.fromSector}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-bold text-primary uppercase">
                        <span className="bg-primary/10 px-1.5 py-0.5 rounded">Para: {notification.toUnidade} • {notification.toSector}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTimestamp(notification.timestamp)}
                    </span>
                    <div className="flex items-center gap-2">
                      {notification.status === "pending" && 
                       notification.toSector?.trim().toLowerCase() === userSector.trim().toLowerCase() && (
                        <div className="flex gap-1">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-7 text-[10px] text-success border-success/30 hover:bg-success/10 px-2"
                            onClick={(e) => { e.stopPropagation(); handleUpdateStatus(notification.id, "accepted"); }}
                          >
                            Reconhecer
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-7 text-[10px] text-destructive border-destructive/30 hover:bg-destructive/10 px-2"
                            onClick={(e) => { e.stopPropagation(); handleUpdateStatus(notification.id, "disputed"); }}
                          >
                            Contestar
                          </Button>
                        </div>
                      )}
                      {notification.status === "disputed" && role === "pmo" && (
                        <div className="flex gap-1">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-7 text-[10px] text-success border-success/30 hover:bg-success/10 px-2"
                            onClick={(e) => { e.stopPropagation(); handleUpdateStatus(notification.id, "accepted"); }}
                          >
                            Aprovar
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-7 text-[10px] text-destructive border-destructive/30 hover:bg-destructive/10 px-2"
                            onClick={(e) => { e.stopPropagation(); handleUpdateStatus(notification.id, "rejected"); }}
                          >
                            Rejeitar
                          </Button>
                        </div>
                      )}
                      
                      {notification.has_evidence && (
                        <Badge variant="outline" className="text-[9px] gap-1 bg-blue-500/5 text-blue-500 border-blue-500/20">
                          <LinkIcon className="w-2.5 h-2.5" />
                          Evidência
                        </Badge>
                      )}
                      <Button variant="ghost" size="sm" className="h-7 text-[10px] hover:text-primary" onClick={() => window.location.href='/notifications'}>
                        Detalhes
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
};

