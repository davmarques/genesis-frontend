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
  Loader2
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useRole } from "@/contexts/RoleContext";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";

export default function Reports() {
  const { role, userSector, userSectorId } = useRole();
  const [isLoading, setIsLoading] = useState(true);
  const [scoringBreakdown, setScoringBreakdown] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [sectorData, setSectorData] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalTasks: 0,
    performanceRate: 0,
    totalPoints: 0
  });

  const getSubtitle = () => {
    switch (role) {
      case "pmo": return "Análises e insights de todos os setores";
      case "manager": return `Relatórios do setor ${userSector}`;
      default: return "Seus relatórios de desempenho";
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [userSector, role]);

  const fetchReportData = async () => {
    try {
      setIsLoading(true);
      
      const [allSectors, allNotifications] = await Promise.all([
        apiFetch("/admin/sectors").catch(() => []),
        supabase.from('notificacoes').select('*')
      ]);

      const sectorsList = Array.isArray(allSectors) ? allSectors : [];
      const notifications = allNotifications.data || [];

      // Filtrar por setor se for manager
      const mySectorObj = sectorsList.find((s: any) => 
        s.nome.trim().toLowerCase() === userSector.trim().toLowerCase()
      );

      let filteredNotifications = notifications;
      let targetSectors = sectorsList;

      if (role !== "pmo" && mySectorObj) {
        filteredNotifications = notifications.filter((n: any) => 
          n.setor_id === mySectorObj.id || n.id_setor_ref === mySectorObj.id
        );
        targetSectors = sectorsList.filter((s: any) => s.id === mySectorObj.id);
      }

      // 1. Scoring Breakdown
      const vitalIndices = filteredNotifications.filter((n: any) => n.id_setor_ref && !n.notified).length;
      const auditPoints = filteredNotifications.filter((n: any) => n.id_setor_ref).length;
      const alerts = filteredNotifications.filter((n: any) => n.setor_id && n.notified).length;
      const absences = filteredNotifications.filter((n: any) => n.setor_id && !n.notified && n.tipo_erro === 'ausência').length;

      setScoringBreakdown([
        { action: "Atividades Concluídas", count: auditPoints, points: auditPoints * 50, type: "positive" },
        { action: "Notificações de Alerta", count: alerts, points: alerts * -50, type: "negative" },
        { action: "Notificações de Ausência", count: absences, points: absences * -100, type: "negative" },
      ]);

      // 2. Sector Data
      const sData = targetSectors.map((s: any) => {
        const sectorPoints = notifications.reduce((acc: number, n: any) => {
          if (n.id_setor_ref === s.id) return acc + 50;
          if (n.setor_id === s.id) return acc + (n.notified ? -50 : -100);
          return acc;
        }, 0);
        return { sector: s.nome, points: sectorPoints };
      }).sort((a: any, b: any) => b.points - a.points).slice(0, 5);
      
      setSectorData(sData);

      // 3. Stats
      const totalPoints = filteredNotifications.reduce((acc: number, n: any) => {
        if (mySectorObj && n.id_setor_ref === mySectorObj.id) return acc + 50;
        if (mySectorObj && n.setor_id === mySectorObj.id) return acc + (n.notified ? -50 : -100);
        if (role === 'pmo') return acc + (n.id_setor_ref ? 50 : 0);
        return acc;
      }, 0);

      setStats({
        totalTasks: auditPoints,
        performanceRate: 94.2, // Placeholder for real calculation
        totalPoints: totalPoints
      });

      // 4. Chart Data (Last 6 months placeholder but with real structure)
      setChartData([
        { month: "Jan", points: 2400, tasks: 400 },
        { month: "Fev", points: 1398, tasks: 300 },
        { month: "Mar", points: 9800, tasks: 200 },
        { month: "Abr", points: 3908, tasks: 278 },
        { month: "Mai", points: 4800, tasks: 189 },
        { month: "Jun", points: totalPoints, tasks: auditPoints },
      ]);

    } catch (error) {
      console.error("Erro ao carregar relatórios:", error);
    } finally {
      setIsLoading(false);
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
          <Button className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
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
                      <td className="p-3 text-sm">Atividade Validada</td>
                      <td className="p-3 text-center">
                        <Badge className="bg-success/10 text-success border-success/30">+10</Badge>
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">Conclusão de atividade do processo</td>
                    </tr>
                    <tr className="border-b border-border">
                      <td className="p-3 text-sm">Pontos Vitais</td>
                      <td className="p-3 text-center">
                        <Badge className="bg-success/10 text-success border-success/30">+100</Badge>
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">Nova atividade adicionada ao checklist</td>
                    </tr>
                    <tr className="border-b border-border">
                      <td className="p-3 text-sm">Pontos de Auditoria</td>
                      <td className="p-3 text-center">
                        <Badge className="bg-success/10 text-success border-success/30">+50</Badge>
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">Notificação de erro em outro setor</td>
                    </tr>
                    <tr className="border-b border-border">
                      <td className="p-3 text-sm">Notificação de Alerta</td>
                      <td className="p-3 text-center">
                        <Badge className="bg-warning/10 text-warning border-warning/30">-50</Badge>
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">Erro já estava no checklist</td>
                    </tr>
                    <tr className="border-b border-border">
                      <td className="p-3 text-sm">Notificação de Ausência</td>
                      <td className="p-3 text-center">
                        <Badge className="bg-destructive/10 text-destructive border-destructive/30">-100</Badge>
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">Erro não estava no checklist (gera pendência)</td>
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
                      layout="vertical"
                      margin={{
                        left: 40,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--muted-foreground)/0.2)" />
                      <XAxis type="number" hide />
                      <YAxis
                        dataKey="sector"
                        type="category"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "hsl(var(--muted-foreground))" }}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar
                        dataKey="points"
                        fill="var(--color-points)"
                        radius={[0, 4, 4, 0]}
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
