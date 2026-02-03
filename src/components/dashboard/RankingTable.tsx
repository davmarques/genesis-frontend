import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, TrendingUp, TrendingDown, Minus, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useRole } from "@/contexts/RoleContext";

interface RankingItem {
  id: number;
  sector: string;
  score: number;
  change: number;
  trend: "up" | "down" | "same";
  activities: number;
  alerts: number;
}

export const RankingTable = () => {
  const [ranking, setRanking] = useState<RankingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { role, userSector } = useRole();

  useEffect(() => {
    fetchRanking();
  }, [userSector, role]);

  const fetchRanking = async () => {
    try {
      setIsLoading(true);
      
      // 1. Buscar todos os setores
      const allSectors = await apiFetch("/admin/sectors").catch(() => []);
      let sectorsList = Array.isArray(allSectors) ? allSectors : [];
      
      // 2. Identificar a unidade para filtro se não for PMO
      let unitIdToFilter = null;
      if (role !== "pmo") {
        const mySectorObj = sectorsList.find((s: any) => 
          s.nome.trim().toLowerCase() === userSector.trim().toLowerCase()
        );
        if (mySectorObj && mySectorObj.unidade_id) {
          unitIdToFilter = mySectorObj.unidade_id;
          sectorsList = sectorsList.filter((s: any) => s.unidade_id === unitIdToFilter);
        } else if (mySectorObj) {
          sectorsList = sectorsList.filter((s: any) => s.id === mySectorObj.id);
        }
      }

      // 3. Buscar notificações para calcular pontos
      let query = supabase.from("notificacoes").select("*");
      if (unitIdToFilter) {
        query = query.eq('unidade_id', unitIdToFilter); // Filtro básico (precisa de OR se quisermos ver reporte cross-unit mas aqui focamos na unidade logada)
      }

      const { data: notifications } = await query;

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const rankingData = sectorsList.map((sector: any, index: number) => {
        const sectorId = sector.id;
        
        // Sumarizar pontos totais
        const pointsAsAuditor = (notifications || [])
          .filter(n => n.id_setor_ref === sectorId)
          .length * 50;
        
        const penaltyAsAuditee = (notifications || [])
          .filter(n => n.setor_id === sectorId)
          .reduce((acc, n) => acc + (n.notified ? -50 : -100), 0);

        // Calcular variação mensal (pontos ganhos/perdidos no mês atual)
        const monthlyPointsAsAuditor = (notifications || [])
          .filter(n => n.id_setor_ref === sectorId && new Date(n.created_at) >= startOfMonth)
          .length * 50;
        
        const monthlyPenaltyAsAuditee = (notifications || [])
          .filter(n => n.setor_id === sectorId && new Date(n.created_at) >= startOfMonth)
          .reduce((acc, n) => acc + (n.notified ? -50 : -100), 0);
        
        const monthlyChange = monthlyPointsAsAuditor + monthlyPenaltyAsAuditee;

        // Total de notificações recebidas (independentemente do tipo)
        const totalReceived = (notifications || [])
          .filter(n => n.setor_id === sectorId)
          .length;

        const activitiesCount = (notifications || [])
          .filter(n => n.id_setor_ref === sectorId)
          .length;

        return {
          id: index + 1,
          sector: sector.nome,
          score: 0 + pointsAsAuditor + penaltyAsAuditee,
          change: monthlyChange,
          trend: monthlyChange > 0 ? "up" : monthlyChange < 0 ? "down" : "same",
          activities: activitiesCount,
          alerts: totalReceived
        };
      });

      // Sort by score
      rankingData.sort((a, b) => b.score - a.score);
      
      // Update IDs to reflect position
      const finalRanking = rankingData.map((item, idx) => ({
        ...item,
        id: idx + 1
      }));

      setRanking(finalRanking);
    } catch (error) {
      console.error("Erro ao carregar ranking:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "up": return <TrendingUp className="w-4 h-4 text-success" />;
      case "down": return <TrendingDown className="w-4 h-4 text-destructive" />;
      default: return <Minus className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getRankBadge = (position: number) => {
    const colors = {
      1: "bg-gradient-to-r from-gold to-warning text-gold-foreground",
      2: "bg-gradient-to-r from-muted to-border text-foreground",
      3: "bg-gradient-to-r from-warning/30 to-warning/50 text-foreground",
    };
    return colors[position as keyof typeof colors] || "bg-muted text-foreground";
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
          <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Trophy className="w-5 h-5 text-gold" />
            Ranking de Setores
          </h3>
          <p className="text-sm text-muted-foreground mt-1">Classificação por pontuação total</p>
        </div>
        <Badge variant="outline" className="gap-2">
          Atualizado agora
        </Badge>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Posição</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Setor</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-foreground">Pontuação</th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-foreground">Variação</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-foreground">Atividades</th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-foreground">Alertas</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((item) => (
              <tr key={item.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                <td className="py-4 px-4">
                  <Badge className={`${getRankBadge(item.id)} font-bold w-8 h-8 rounded-full flex items-center justify-center`}>
                    {item.id}
                  </Badge>
                </td>
                <td className="py-4 px-4">
                  <span className="font-medium text-foreground">{item.sector}</span>
                </td>
                <td className="py-4 px-4 text-right">
                  <span className="text-lg font-bold text-foreground">{item.score.toLocaleString()}</span>
                </td>
                <td className="py-4 px-4">
                  <div className="flex items-center justify-center gap-1">
                    {getTrendIcon(item.trend)}
                    <span className={`text-sm font-medium ${
                      item.trend === "up" ? "text-success" : 
                      item.trend === "down" ? "text-destructive" : 
                      "text-muted-foreground"
                    }`}>
                      {item.change > 0 ? "+" : ""}{item.change}
                    </span>
                  </div>
                </td>
                <td className="py-4 px-4 text-right">
                  <span className="text-foreground">{item.activities}</span>
                </td>
                <td className="py-4 px-4 text-center">
                  {item.alerts > 0 ? (
                    <Badge variant="destructive" className="rounded-full px-2">
                      {item.alerts}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="rounded-full px-2 text-success border-success">
                      0
                    </Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
