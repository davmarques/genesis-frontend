import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area
} from "recharts";
import { 
  ChartContainer, 
  ChartTooltip, 
  ChartTooltipContent,
  type ChartConfig
} from "@/components/ui/chart";
import { 
  Download,
  TrendingUp,
  Activity,
  Target,
  Award,
  Calendar,
  Filter,
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Lightbulb
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useRole } from "@/contexts/RoleContext";
import { useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { jsPDF } from "jspdf";
import { useQuery } from "@tanstack/react-query";

export default function Reports() {
  const { role, userSector, userSectorId } = useRole();
  const [exporting, setExporting] = useState(false);

  const getSubtitle = () => {
    switch (role) {
      case "pmo": return "Análises e insights de todos os setores";
      case "manager": return `Relatórios do setor ${userSector}`;
      default: return "Seus relatórios de desempenho";
    }
  };

  // 1. Fetch de Dados com React Query (Cache e Performance)
  const { data: rawData, isLoading } = useQuery({
    queryKey: ['reportData', role, userSectorId],
    queryFn: async () => {
      // Definir data de corte (últimos 6 meses) para reduzir volume de dados
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
      sixMonthsAgo.setDate(1);
      const dateStr = sixMonthsAgo.toISOString();

      let nQuery = supabase.from('notificacoes').select('*').gte('created_at', dateStr);
      let rQuery = supabase.from('report').select('*, servico(setor_id)').gte('created_at', dateStr);
      let rcQuery = supabase.from('report_convenio').select('*, report(*, servico(setor_id))').gte('created_at', dateStr);

      if (role !== "pmo" && userSectorId) {
        nQuery = nQuery.or(`setor_id.eq.${userSectorId},id_setor_ref.eq.${userSectorId}`);
        // Para reports, filtramos no JS pois depende de join complexo nas tabelas base do Supabase
      }

      const [allSectors, allNotifications, allReports, allReportConvenios] = await Promise.all([
        apiFetch("/admin/sectors").catch(() => []),
        nQuery,
        rQuery,
        rcQuery
      ]);

      return {
        sectors: Array.isArray(allSectors) ? allSectors : [],
        notifications: allNotifications.data || [],
        reports: allReports.data || [],
        reportConvenios: allReportConvenios.data || []
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutos de cache
  });

  // 2. Processamento de Dados via useMemo (Performance de UI)
  const reportStats = useMemo(() => {
    if (!rawData) return null;

    const { sectors, notifications, reports, reportConvenios } = rawData;

    // Filtrar notificações por status
    const activeNotifications = notifications.filter((n: any) => {
      const status = n.status?.toLowerCase();
      return status !== 'disputed' && status !== 'contestada' && status !== 'rejected' && status !== 'rejeitada';
    });

    const activeReports = reports.filter((r: any) => r.status?.toLowerCase() !== 'cancelado');
    const activeReportConvenios = reportConvenios.filter((rc: any) => rc.report?.status?.toLowerCase() !== 'cancelado');

    const mySectorObj = sectors.find((s: any) => 
      (userSectorId && String(s.id) === String(userSectorId)) ||
      (userSector && s.nome?.trim().toLowerCase() === userSector.trim().toLowerCase())
    );

    let filteredNotifications = activeNotifications;
    if (role !== "pmo" && mySectorObj) {
      filteredNotifications = activeNotifications.filter((n: any) => 
        n.setor_id === mySectorObj.id || n.id_setor_ref === mySectorObj.id
      );
    }

    // Cálculos de Resumo
    const auditPointsCount = filteredNotifications.filter((n: any) => n.id_setor_ref === mySectorObj?.id).length;
    const alerts = filteredNotifications.filter((n: any) => n.setor_id === mySectorObj?.id && n.notified && !n.nao_no_checklist).length;
    const absences = filteredNotifications.filter((n: any) => n.setor_id === mySectorObj?.id && !n.notified && !n.nao_no_checklist).length;
    const notificationImprovements = filteredNotifications.filter((n: any) => n.setor_id === mySectorObj?.id && !n.id_setor_ref && n.nao_no_checklist).length;

    const reportsCount = role === "pmo" 
      ? activeReports.length 
      : activeReports.filter((r: any) => r.servico?.setor_id === mySectorObj?.id).length;
    
    const reportConveniosCount = role === "pmo"
      ? activeReportConvenios.length
      : activeReportConvenios.filter((rc: any) => rc.report?.servico?.setor_id === mySectorObj?.id).length;
    
    const totalWishlistCount = notificationImprovements + reportsCount + reportConveniosCount;

    const scoringBreakdown = [
      { action: "Auditorias Realizadas", count: auditPointsCount, points: auditPointsCount * 50, type: "positive" },
      { action: "Melhorias Proativas", count: totalWishlistCount, points: totalWishlistCount * 100, type: "positive" },
      { action: "Notificações de Alerta", count: alerts, points: alerts * -50, type: "negative" },
      { action: "Notificações de Ausência", count: absences, points: absences * -100, type: "negative" },
    ];

    // Ranking de Setores (Otimizado: apenas para PMO carrega todos)
    const sectorData = sectors.map((s: any) => {
      const sectorPoints = activeNotifications.reduce((acc: number, n: any) => {
        if (n.setor_id !== s.id && n.id_setor_ref !== s.id) return acc;
        
        let score = acc;
        if (n.id_setor_ref === s.id) score += 50;
        if (n.setor_id === s.id) {
          if (!n.id_setor_ref && n.nao_no_checklist) score += 100;
          else score += (n.notified ? -50 : -100) + (n.nao_no_checklist ? 100 : 0);
        }
        return score;
      }, 0);
      return { sector: s.nome, points: sectorPoints };
    }).sort((a: any, b: any) => b.points - a.points);

    // Gráfico mensal (6 meses)
    const currentMonth = new Date().getMonth();
    const monthlyData = Array.from({ length: 6 }, (_, i) => {
      const monthIndex = (currentMonth - 5 + i + 12) % 12;
      const monthLabel = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][monthIndex];
      
      const monthNotifications = activeNotifications.filter((n: any) => new Date(n.created_at).getMonth() === monthIndex);

      const points = monthNotifications.reduce((acc: number, n: any) => {
        let score = acc;
        const isReporter = mySectorObj && n.id_setor_ref === mySectorObj.id;
        const isTarget = mySectorObj && n.setor_id === mySectorObj.id;

        if (role === 'pmo') {
           if (n.id_setor_ref) score += 50;
           if (n.setor_id) {
             if (!n.id_setor_ref && n.nao_no_checklist) score += 100;
             else score += (n.notified ? -50 : -100) + (n.nao_no_checklist ? 100 : 0);
           }
        } else {
           if (isReporter) score += 50;
           if (isTarget) {
             if (!n.id_setor_ref && n.nao_no_checklist) score += 100;
             else score += (n.notified ? -50 : -100) + (n.nao_no_checklist ? 100 : 0);
           }
        }
        return score;
      }, 0);

      const tasks = monthNotifications.filter((n: any) => 
        role === 'pmo' ? !!n.id_setor_ref : (mySectorObj && n.id_setor_ref === mySectorObj.id)
      ).length;

      return { month: monthLabel, points, tasks };
    });

    const totalPoints = role === 'pmo' 
      ? sectorData.reduce((acc, s) => acc + s.points, 0)
      : (sectorData.find(s => s.sector === mySectorObj?.nome)?.points || 0);

    const positiveActions = filteredNotifications.filter(n => n.id_setor_ref || n.nao_no_checklist).length + reportsCount + reportConveniosCount;
    const totalActions = filteredNotifications.length + reportsCount + reportConveniosCount;
    
    return {
      scoringBreakdown,
      sectorData: sectorData.slice(0, 5),
      chartData: monthlyData,
      stats: {
        totalTasks: role === 'pmo' ? activeNotifications.filter(n => n.id_setor_ref).length : auditPointsCount,
        performanceRate: totalActions > 0 ? parseFloat(((positiveActions / totalActions) * 100).toFixed(1)) : 100,
        totalPoints,
        wishlistCount: totalWishlistCount
      }
    };
  }, [rawData, role, userSectorId, userSector]);

  const stats = reportStats?.stats || { totalTasks: 0, performanceRate: 0, totalPoints: 0, wishlistCount: 0 };
  const scoringBreakdown = reportStats?.scoringBreakdown || [];
  const chartData = reportStats?.chartData || [];
  const sectorData = reportStats?.sectorData || [];

  const exportToPDF = () => {
    setExporting(true);
    try {
      const doc = new jsPDF();
      const timestamp = new Date().toLocaleDateString('pt-BR');
      const primaryColor = [33, 150, 243]; // #2196f3
      const successColor = [76, 175, 80];  // #4caf50
      const goldColor = [255, 193, 7];    // #ffc107
      
      // --- PÁGINA 1: RESUMO E PONTUAÇÃO ---
      // Header Decorativo
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, 210, 40, 'F');
      
      doc.setFontSize(24);
      doc.setTextColor(255, 255, 255);
      doc.text("GÊNESIS", 14, 25);
      doc.setFontSize(12);
      doc.text("Relatório Geral de Performance de Processos", 14, 33);
      
      doc.setFontSize(10);
      doc.text(`Emitido em: ${timestamp}`, 196, 25, { align: "right" });
      doc.text(`Setor: ${role === 'pmo' ? 'Global (PMO)' : userSector}`, 196, 33, { align: "right" });

      // Seção 1: Indicadores Chave (KPIs)
      let currentY = 55;
      doc.setFontSize(16);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("1. Resumo de Indicadores", 14, currentY);
      
      currentY += 10;
      // Desenhar Cards de KPI (Simulados)
      const cardWidth = 44;
      const cardHeight = 25;
      const kpis = [
        { label: 'Tarefas', value: stats.totalTasks.toString() },
        { label: 'Aproveit.', value: `${stats.performanceRate}%` },
        { label: 'Wishlist', value: stats.wishlistCount.toString() },
        { label: 'Pontos', value: stats.totalPoints.toLocaleString() }
      ];

      kpis.forEach((kpi, i) => {
        const x = 14 + (i * (cardWidth + 4));
        doc.setDrawColor(230);
        doc.setFillColor(249, 250, 251);
        doc.roundedRect(x, currentY, cardWidth, cardHeight, 2, 2, 'FD');
        
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(kpi.label, x + cardWidth/2, currentY + 8, { align: 'center' });
        
        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.text(kpi.value, x + cardWidth/2, currentY + 18, { align: 'center' });
      });

      // Seção 2: Detalhamento de Pontuação (Aba "Detalhamento de Pontos")
      currentY += 40;
      doc.setFontSize(16);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("2. Detalhamento de Pontuação", 14, currentY);
      
      currentY += 8;
      doc.setFontSize(10);
      doc.setFillColor(240);
      doc.rect(14, currentY, 182, 8, 'F');
      doc.setTextColor(80);
      doc.text("Ação / Movimentação", 18, currentY + 5.5);
      doc.text("Qtd", 130, currentY + 5.5);
      doc.text("Pontos", 165, currentY + 5.5);
      
      currentY += 12;
      scoringBreakdown.forEach(item => {
        doc.setFontSize(10);
        doc.setTextColor(0);
        doc.text(item.action, 18, currentY);
        doc.text(item.count.toString(), 130, currentY);
        
        if (item.points > 0) doc.setTextColor(successColor[0], successColor[1], successColor[2]);
        else doc.setTextColor(220, 38, 38); // Red
        doc.text(`${item.points > 0 ? '+' : ''}${item.points}`, 165, currentY);
        
        currentY += 4;
        doc.setDrawColor(240);
        doc.line(14, currentY, 196, currentY);
        currentY += 6;
      });

      // --- PÁGINA 2: VISÃO GERAL E GRÁFICOS ---
      doc.addPage();
      currentY = 25;
      doc.setFontSize(16);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("3. Histórico e Evolução Mensal", 14, currentY);
      
      currentY += 10;
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text("Performance dos últimos 6 meses (Baseado na Aba Visão Geral)", 14, currentY);
      
      currentY += 8;
      doc.setFillColor(240);
      doc.rect(14, currentY, 182, 8, 'F');
      doc.setTextColor(80);
      doc.text("Mês", 18, currentY + 5.5);
      doc.text("Pontos Acumulados", 80, currentY + 5.5);
      doc.text("Tarefas Realizadas", 150, currentY + 5.5);
      
      currentY += 12;
      chartData.forEach(data => {
        doc.setTextColor(0);
        doc.text(data.month, 18, currentY);
        doc.text(data.points.toString(), 80, currentY);
        doc.text(data.tasks.toString(), 150, currentY);
        currentY += 8;
      });

      // --- PÁGINA 3: ANÁLISE POR SETOR (SOMENTE PMO) ---
      if (role === 'pmo' && sectorData.length > 0) {
        doc.addPage();
        currentY = 25;
        doc.setFontSize(12);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text("4. Análise e Ranking por Setor", 14, currentY);
        
        currentY += 12;
        doc.setFillColor(240);
        doc.rect(14, currentY, 182, 8, 'F');
        doc.setTextColor(80);
        doc.text("Pos.", 18, currentY + 5.5);
        doc.text("Setor", 35, currentY + 5.5);
        doc.text("Performance Total", 160, currentY + 5.5);

        currentY += 12;
        sectorData.forEach((s, index) => {
          if (currentY > 270) {
            doc.addPage();
            currentY = 20;
          }
          
          doc.setTextColor(0);
          if (index < 3) {
             doc.setFillColor(255, 248, 225); // Light gold highlight
             doc.rect(14, currentY - 5, 182, 8, 'F');
          }
          
          doc.text((index + 1).toString(), 18, currentY);
          doc.text(s.sector, 35, currentY);
          doc.text(`${s.points.toLocaleString()} pts`, 160, currentY);
          currentY += 9;
        });
      }

      // Rodapé em todas as páginas
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
          doc.setPage(i);
          doc.setDrawColor(200);
          doc.line(14, 280, 196, 280);
          doc.setFontSize(8);
          doc.setTextColor(150);
          doc.text("Gênesis Healthcare Management System - Confidencial", 14, 285);
          doc.text(`Página ${i} de ${totalPages}`, 196, 285, { align: "right" });
      }

      doc.save(`relatorio_genesis_${userSector || 'global'}_${new Date().getTime()}.pdf`);
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
    } finally {
      setExporting(false);
    }
  };

  const chartConfig = {
    points: {
      label: "Pontuação",
      color: "hsl(var(--primary))",
    },
    tasks: {
      label: "Tarefas",
      color: "hsl(var(--secondary))",
    },
  } satisfies ChartConfig;

  const totalPositive = scoringBreakdown.filter(s => s.type === "positive").reduce((acc, s) => acc + s.points, 0);
  const totalNegative = scoringBreakdown.filter(s => s.type === "negative").reduce((acc, s) => acc + s.points, 0);
  const totalScore = totalPositive + totalNegative;

  if (isLoading) {
    return (
      <AppLayout title="Relatórios" subtitle={getSubtitle()}>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Relatórios" subtitle={getSubtitle()}>
      <div className="p-6 space-y-6">
        {/* Header Actions */}
        <div className="flex flex-wrap gap-4 justify-between items-center">
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <Calendar className="w-4 h-4" />
              Período
            </Button>
            <Button variant="outline" className="gap-2">
              <Filter className="w-4 h-4" />
              Filtros
            </Button>
          </div>
          <Button 
            onClick={exportToPDF}
            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Download className="w-4 h-4" />
            Exportar Relatório
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Target className="w-5 h-5 text-primary" />
              </div>
              <Badge variant="outline" className="gap-1 text-success border-success/30">
                <TrendingUp className="w-3 h-3" />
                +12%
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-1">Tarefas Concluídas</p>
            <p className="text-3xl font-bold text-foreground">
              {stats.totalTasks}
            </p>
            <p className="text-xs text-muted-foreground mt-1">vs. mês anterior</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-success/10">
                <Activity className="w-5 h-5 text-success" />
              </div>
              <Badge variant="outline" className="gap-1 text-success border-success/30">
                <TrendingUp className="w-3 h-3" />
                +8%
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-1">Taxa de Aproveitamento</p>
            <p className="text-3xl font-bold text-foreground">{stats.performanceRate}%</p>
            <p className="text-xs text-muted-foreground mt-1">vs. mês anterior</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Lightbulb className="w-5 h-5 text-orange-500" />
              </div>
              <Badge variant="outline" className="gap-1 text-success border-success/30">
                <TrendingUp className="w-3 h-3" />
                +10%
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-1">Itens Wishlist</p>
            <p className="text-3xl font-bold text-foreground">{stats.wishlistCount}</p>
            <p className="text-xs text-muted-foreground mt-1">vs. mês anterior</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-gold/10">
                <Award className="w-5 h-5 text-gold" />
              </div>
              <Badge variant="outline" className="gap-1 text-success border-success/30">
                <TrendingUp className="w-3 h-3" />
                +15%
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-1">Pontos Totais</p>
            <p className="text-3xl font-bold text-foreground">
              {stats.totalPoints.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">vs. mês anterior</p>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="scoring">
          <TabsList>
            <TabsTrigger value="scoring">Detalhamento de Pontos</TabsTrigger>
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            {role === "pmo" && <TabsTrigger value="sectors">Por Setor</TabsTrigger>}
          </TabsList>

          {/* Scoring Breakdown Tab */}
          <TabsContent value="scoring" className="mt-6 space-y-6">
            <Card className="p-6">
              <h3 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                <Award className="w-5 h-5 text-gold" />
                Detalhamento da Pontuação
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                Veja como seus pontos são calculados com base nas regras de gamificação.
              </p>
              
              <div className="space-y-4">
                {scoringBreakdown.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-4 rounded-lg border border-border">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${item.type === "positive" ? "bg-success/10" : "bg-destructive/10"}`}>
                        {item.type === "positive" ? (
                          <CheckCircle2 className={`w-5 h-5 text-success`} />
                        ) : (
                          <AlertCircle className={`w-5 h-5 text-destructive`} />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{item.action}</p>
                        <p className="text-sm text-muted-foreground">{item.count} ocorrências</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={
                      item.type === "positive" 
                        ? "bg-success/10 text-success border-success/30 text-lg font-bold px-3 py-1"
                        : "bg-destructive/10 text-destructive border-destructive/30 text-lg font-bold px-3 py-1"
                    }>
                      {item.points > 0 ? `+${item.points}` : item.points} pts
                    </Badge>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-6 border-t border-border">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 rounded-lg bg-success/10">
                    <p className="text-sm text-muted-foreground mb-1">Pontos Ganhos</p>
                    <p className="text-2xl font-bold text-success">+{totalPositive}</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-destructive/10">
                    <p className="text-sm text-muted-foreground mb-1">Pontos Perdidos</p>
                    <p className="text-2xl font-bold text-destructive">{totalNegative}</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-primary/10">
                    <p className="text-sm text-muted-foreground mb-1">Saldo Total</p>
                    <p className="text-2xl font-bold text-primary">{totalScore}</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Scoring Rules Reference */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Tabela de Referência de Pontuação
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-3 text-sm font-semibold text-foreground">Ação</th>
                      <th className="text-center p-3 text-sm font-semibold text-foreground">Pontos</th>
                      <th className="text-left p-3 text-sm font-semibold text-foreground">Descrição</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border">
                      <td className="p-3 text-sm">Auditoria Realizada</td>
                      <td className="p-3 text-center">
                        <Badge className="bg-success/10 text-success border-success/30">+50</Badge>
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">Notificação de erro em outro setor</td>
                    </tr>
                    <tr className="border-b border-border">
                      <td className="p-3 text-sm">Melhoria Proativa</td>
                      <td className="p-3 text-center">
                        <Badge className="bg-success/10 text-success border-success/30">+100</Badge>
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">Inclusão voluntária de item no checklist</td>
                    </tr>
                    <tr className="border-b border-border">
                      <td className="p-3 text-sm">Notificação de Alerta</td>
                      <td className="p-3 text-center">
                        <Badge className="bg-warning/10 text-warning border-warning/30">-50</Badge>
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">Erro de processo menor (Alertado)</td>
                    </tr>
                    <tr className="border-b border-border">
                      <td className="p-3 text-sm">Notificação de Ausência</td>
                      <td className="p-3 text-center">
                        <Badge className="bg-destructive/10 text-destructive border-destructive/30">-100</Badge>
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">Erro de processo grave (Item faltando no checklist)</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-sm">Notificação de Agravamento</td>
                      <td className="p-3 text-center">
                        <Badge className="bg-destructive/10 text-destructive border-destructive/30">-150</Badge>
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">Erro recorrente (3ª notificação em 30 dias)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="overview" className="mt-6 space-y-6">
            {/* Performance Chart */}
            <Card className="p-6">
              <h3 className="text-xl font-bold text-foreground mb-4">Desempenho Semestral</h3>
              <div className="h-[900px] w-full">
                <ChartContainer config={chartConfig}>
                  <AreaChart
                    data={chartData}
                    margin={{
                      top: 10,
                      right: 30,
                      left: 0,
                      bottom: 0,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground)/0.2)" />
                    <XAxis 
                      dataKey="month" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      type="monotone"
                      dataKey="points"
                      stroke="var(--color-points)"
                      fill="var(--color-points)"
                      fillOpacity={0.1}
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="tasks"
                      stroke="var(--color-tasks)"
                      fill="var(--color-tasks)"
                      fillOpacity={0.1}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ChartContainer>
              </div>
            </Card>

            {/* Top Sectors - PMO Only */}
            {role === "pmo" && (
              <Card className="p-6">
                <h3 className="text-xl font-bold text-foreground mb-4">Top 5 Setores</h3>
                <div className="space-y-3">
                  {sectorData.map((sector, index) => (
                    <div key={sector.sector} className="flex items-center gap-4 p-4 rounded-lg border border-border hover:border-primary/50 transition-all">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                        index === 0 ? "bg-gradient-to-r from-gold to-warning text-gold-foreground" :
                        index === 1 ? "bg-gradient-to-r from-muted to-border text-foreground" :
                        "bg-muted text-foreground"
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-foreground">{sector.sector}</p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                          <span>{sector.points / 50} tarefas</span>
                          <span>94% conclusão</span>
                        </div>
                      </div>
                      <Badge className="bg-primary/10 text-primary border-primary/30 font-bold">
                        {sector.points} pts
                      </Badge>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </TabsContent>

          {role === "pmo" && (
            <TabsContent value="sectors" className="mt-6">
              <Card className="p-6">
                <h3 className="text-xl font-bold text-foreground mb-4">Análise por Setor</h3>
                <div className="h-[900px] w-full">
                  <ChartContainer config={chartConfig}>
                    <BarChart
                      data={sectorData}
                      margin={{
                        top: 20,
                        right: 30,
                        left: 20,
                        bottom: 40,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground)/0.2)" />
                      <XAxis 
                        dataKey="sector" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                        interval={0}
                        angle={-45}
                        textAnchor="end"
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "hsl(var(--muted-foreground))" }}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar
                        dataKey="points"
                        fill="var(--color-points)"
                        radius={[4, 4, 0, 0]}
                        barSize={30}
                      />
                    </BarChart>
                  </ChartContainer>
                </div>
              </Card>
            </TabsContent>
          )}

          
        </Tabs>
      </div>
    </AppLayout>
  );
}
