import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { 
  AlertCircle, 
  CheckCircle2, 
  TrendingUp, 
  Users,
  Plus,
  FileText,
  Trophy,
  Gavel,
  Target,
  Award,
  Loader2,
  ChevronDown,
  Bell
} from "lucide-react";
import { ScoreCard } from "@/components/dashboard/ScoreCard";
import { RankingTable } from "@/components/dashboard/RankingTable";
import { ChecklistManager } from "@/components/dashboard/ChecklistManager";
import { NotificationPanel } from "@/components/dashboard/NotificationPanel";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { TeamManager } from "@/components/dashboard/TeamManager";
import { AppLayout } from "@/components/layout/AppLayout";
import { useRole } from "@/contexts/RoleContext";
import { supabase } from "@/lib/supabase";

const Dashboard = () => {
  const { role, userSector, userSectorId } = useRole();
  const [stats, setStats] = useState({
    totalSectors: 0,
    totalMembers: 0,
    pendingDisputes: 0,
    totalPoints: 0,
    sectorRank: "0º",
    sectorPoints: 0,
    sectorMembers: 0,
    pendingChecklists: 0,
    completionRate: "0%",
    userPoints: 0,
    userNotices: 0
  });
  const [disputes, setDisputes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        // Otimização: Se não for PMO, filtramos na query do Supabase para reduzir carga de dados
        let notificationsQuery = supabase.from('notificacoes').select(`
          *,
          setor:setor_id(nome),
          unidade:unidade_id(nome),
          setor_ref:id_setor_ref(nome),
          unidade_ref:id_unidade_ref(nome)
        `);

        // Query direta de setores (substituindo apiFetch)
        let sectorsQuery = supabase.from('setor').select(`
          id,
          nome,
          unidade_id,
          coordenador_id,
          unidade:unidade(nome),
          coordenador:users!coordenador_id(id, name, email)
        `).order('nome');

        // Query direta de membros (substituindo apiFetch)
        let membersQuery = supabase.from('users').select(`
          id,
          name,
          email,
          role,
          unidade_id,
          unidade:unidade!users_unidade_id_fkey(nome),
          setor_id,
          setor:setor!users_setor_id_fkey(nome),
          coordinated_sectors:setor!coordenador_id(nome),
          created_at
        `).order('name');

        if (role !== "pmo" && userSectorId) {
          // Filtrar notificações que envolvam o setor do usuário (como origem ou destino)
          notificationsQuery = notificationsQuery.or(`setor_id.eq.${userSectorId},id_setor_ref.eq.${userSectorId}`);
          // Filtrar setores e membros na fonte para melhor performance
          sectorsQuery = sectorsQuery.eq('id', userSectorId);
          membersQuery = membersQuery.eq('setor_id', userSectorId);
        }

        const [sectorsResult, membersResult, notificationsResult] = await Promise.all([
          sectorsQuery,
          membersQuery,
          notificationsQuery
        ]);

        // Formatar setores (replicando lógica do backend /admin/sectors)
        let sectorsList = (sectorsResult.data || []).map((s: any) => ({
          id: s.id,
          nome: s.nome,
          unidade_id: s.unidade_id,
          coordenador_id: s.coordenador_id,
          unidade_nome: s.unidade?.nome || 'Nenhuma',
          manager: s.coordenador?.name || 'Não definido',
          manager_email: s.coordenador?.email || '',
          manager_id: s.coordenador?.id || null,
          membersCount: 0,
          completionRate: 0,
          score: 0
        }));

        // Formatar membros (replicando lógica do backend /admin/members)
        let membersList = (membersResult.data || []).map((u: any) => {
          const dbRole = String(u.role || '').toLowerCase();
          let roleLabel = dbRole;
          if (dbRole.includes('coord') || dbRole.includes('manager') || dbRole.includes('gestor')) roleLabel = 'manager';
          else if (dbRole.includes('colab') || dbRole.includes('labor')) roleLabel = 'collaborator';
          else if (dbRole.includes('pmo')) roleLabel = 'pmo';

          const coordinated = u.coordinated_sectors;
          const firstCoordinated = Array.isArray(coordinated) ? coordinated[0] : coordinated;

          return {
            ...u,
            role: roleLabel,
            sector: u.setor?.nome || 'Nenhum',
            unidade_nome: u.unidade?.nome || 'Nenhuma',
            isSectorManager: !!firstCoordinated,
            managedSectorName: firstCoordinated?.nome,
            phone: '(11) 99999-9999',
            status: 'active',
            tasksCompleted: 0,
            totalTasks: 0,
            points: 0,
            level: 1,
            joinDate: u.created_at ? new Date(u.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
          };
        });

        let notificationsList = (notificationsResult.data || []) as any[];

        // Buscar objeto do setor do usuário logado usando ID (mais performático que nome)
        const currentUserSectorObj = userSectorId 
          ? sectorsList.find(s => String(s.id) === String(userSectorId))
          : sectorsList.find(s => s.nome?.trim().toLowerCase() === userSector?.trim().toLowerCase());

        // Se não for PMO, garantimos a filtragem final em memória para segurança
        if (role !== "pmo" && currentUserSectorObj) {
          sectorsList = sectorsList.filter(s => s.id === currentUserSectorObj.id);
          membersList = membersList.filter(m => m.setor_id === currentUserSectorObj.id);
          notificationsList = notificationsList.filter(n => 
            n.setor_id === currentUserSectorObj.id || n.id_setor_ref === currentUserSectorObj.id
          );
        }

        const pmoStats = {
          totalSectors: sectorsList.length,
          totalMembers: membersList.length,
          pendingDisputes: notificationsList.filter(n => {
            const status = n.status?.toLowerCase();
            return !status || ['disputed', 'contestada', 'pending', 'pendente'].includes(status);
          }).length,
          totalPoints: notificationsList.reduce((acc, n) => {
            const isReport = !!n.id_setor_ref;
            const basePoints = isReport ? 50 : 0;
            
            // Melhoria Voluntária: Sem reportador e com flag de checklist
            if (!isReport && n.nao_no_checklist) {
              return acc + 100;
            }

            const penalty = n.notified ? -50 : -100;
            const reward = n.nao_no_checklist ? 100 : 0;
            return acc + basePoints + penalty + reward;
          }, 0)
        };

        const pendingList = notificationsList
          .filter(n => {
            const status = n.status?.toLowerCase();
            return !status || ['disputed', 'contestada', 'pending', 'pendente'].includes(status);
          })
          .map(n => ({
            id: n.id,
            reporter: n.setor_ref?.nome || (n.id_setor_ref ? "Setor Desconhecido" : "Sistema"),
            reported: n.setor?.nome || "Setor Auditado",
            type: n.notified ? "Alerta" : (n.tipo_erro || "Ausência"),
            description: n.description || n.descricao || "Sem descrição detalhada",
            date: n.created_at,
            status: n.status || 'pending'
          }));

        // Dados específicos do setor do coordenador/colaborador
        const mySectorMembersCount = membersList.length;
        
        // Calcular pontos do setor
        const sectorPoints = notificationsList.reduce((acc, n) => {
          let score = acc;
          const isTarget = currentUserSectorObj && n.setor_id === currentUserSectorObj.id;
          const isReporter = currentUserSectorObj && n.id_setor_ref === currentUserSectorObj.id;

          // Pontos por auditoria (quem reportou)
          if (isReporter) {
            score += 50;
          }

          // Pontos por erro/correção/melhoria (setor alvo)
          if (isTarget) {
            // Melhoria Proativa (Inclusão voluntária no checklist)
            if (!n.id_setor_ref && n.nao_no_checklist) {
              score += 100;
            } else {
              // Notificação de erro
              const penalty = n.notified ? -50 : -100;
              const reward = n.nao_no_checklist ? 100 : 0;
              score += penalty + reward;
            }
          }
          return score;
        }, 0);

        const sectorNotifications = notificationsList.filter(n => currentUserSectorObj && n.setor_id === currentUserSectorObj.id);
        const pendingNotices = sectorNotifications.filter(n => {
          const status = n.status?.toLowerCase();
          return !status || ['pending', 'pendente'].includes(status);
        }).length;

        // Atualizar estados uma única vez para evitar re-renders excessivos
        setDisputes(pendingList);
        setStats({
          ...pmoStats,
          sectorRank: "1º",
          sectorMembers: mySectorMembersCount,
          sectorPoints,
          userPoints: 0,
          userNotices: sectorNotifications.length,
          pendingChecklists: pendingNotices,
          completionRate: "0%"
        });

      } catch (error) {
        console.error("Erro ao carregar dados do dashboard:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [userSectorId, userSector, role]);

  const getSubtitle = () => {
    switch (role) {
      case "pmo": return "Visão geral de todos os setores";
      case "manager": return `Gestão do setor ${userSector}`;
      case "collaborator": return "Suas atividades e tarefas";
    }
  };

  return (
    <AppLayout title="Dashboard" subtitle={getSubtitle()}>
      <div className="p-6">
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Carregando dados reais...</span>
          </div>
        ) : (
          <>
            {/* PMO Dashboard */}
            {role === "pmo" && (
              <div className="space-y-6">
                {/* Stats Overview */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <ScoreCard
                    title="Total de Setores"
                    value={stats.totalSectors.toString()}
                    icon={Users}
                    variant="default"
                  />
                  <ScoreCard
                    title="Membros Ativos"
                    value={stats.totalMembers.toString()}
                    icon={CheckCircle2}
                    variant="success"
                  />
                  <ScoreCard
                    title="Disputas Pendentes"
                    value={stats.pendingDisputes.toString()}
                    icon={Gavel}
                    variant="warning"
                  />
                  <ScoreCard
                    title="Pontos Totais"
                    value={stats.totalPoints.toLocaleString()}
                    icon={Trophy}
                    variant="primary"
                  />
                </div>

            {/* Quick Actions for PMO */}
            {/* <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-4 border-dashed border-2 hover:border-primary/50 cursor-pointer transition-all group">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Validar Áreas</p>
                    <p className="text-sm text-muted-foreground">{stats.pendingDisputes} itens aguardando</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4 border-dashed border-2 hover:border-warning/50 cursor-pointer transition-all group">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-warning/10 group-hover:bg-warning/20 transition-colors">
                    <Gavel className="w-5 h-5 text-warning" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Julgar Disputas</p>
                    <p className="text-sm text-muted-foreground">{stats.pendingDisputes} disputas abertas</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4 border-dashed border-2 hover:border-success/50 cursor-pointer transition-all group">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-success/10 group-hover:bg-success/20 transition-colors">
                    <Users className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Gerenciar Setores</p>
                    <p className="text-sm text-muted-foreground">{stats.totalSectors} setores ativos</p>
                  </div>
                </div>
              </Card>
            </div> */}

            {/* Main Content Tabs */}
            <Tabs defaultValue="ranking" className="space-y-4">
              <TabsList className="bg-muted">
                <TabsTrigger value="ranking">Ranking de Setores</TabsTrigger>
                <TabsTrigger value="disputes">Disputas Pendentes</TabsTrigger>
                <TabsTrigger value="notifications">Notificações</TabsTrigger>
                <TabsTrigger value="activity">Atividade Recente</TabsTrigger>
              </TabsList>

              <TabsContent value="ranking" className="space-y-4">
                <RankingTable />
              </TabsContent>

              <TabsContent value="disputes" className="space-y-">
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Gavel className="w-5 h-5 text-warning" />
                    Disputas Aguardando Julgamento
                  </h3>
                  <div className="space-y-4">
                    {disputes.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Nenhuma disputa pendente.
                      </div>
                    ) : (
                      <Accordion type="single" collapsible className="w-full">
                        {disputes.map(dispute => (
                          <AccordionItem 
                            key={dispute.id} 
                            value={dispute.id}
                            className="border rounded-xl border-border px-0 hover:bg-muted/30 transition-all group"
                          >
                            <AccordionTrigger className="hover:no-underline py-4 px-4 w-full [&>svg]:hidden">
                              <div className="flex items-center justify-between w-full">
                                <div className="flex flex-col items-start gap-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[10px] uppercase font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                      De: {dispute.reporter}
                                    </span>
                                    <ChevronDown className="w-3 h-3 text-muted-foreground" />
                                    <span className="text-[10px] uppercase font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                      Para: {dispute.reported}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 text-left">
                                    
                                    <Badge variant="outline" className={
                                      (dispute.status?.toLowerCase() === 'pending' || dispute.status?.toLowerCase() === 'pendente') 
                                      ? "bg-warning/10 text-warning border-warning/30"
                                        : "bg-blue-500/10 text-blue-500 border-blue-500/30" 
                                    }>
                                      {(dispute.status?.toLowerCase() === 'pending' || dispute.status?.toLowerCase() === 'pendente') ? 'Pendente' : 'Em Disputa'}
                                    </Badge>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 ml-4">
                                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                    <Button size="sm" variant="outline" className="text-success border-success/30 hover:bg-success/10 h-8">
                                      Aprovar
                                    </Button>
                                    <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10 h-8">
                                      Rejeitar
                                    </Button>
                                  </div>
                                  <ChevronDown className="w-3 h-3 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                                </div>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="pt-2 pb-4 border-t border-border mt-2 px-4">
                              <div className="space-y-3">
                                <div>
                                  <p className="text-xs font-bold text-muted-foreground uppercase mb-1">Descrição do Erro</p>
                                  <p className="text-sm text-foreground bg-muted/30 p-3 rounded-md">
                                    {dispute.description}
                                  </p>
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-muted-foreground italic">
                                  <span>ID: {dispute.id}</span>
                                  <span>Data: {(() => {
                                    const isoString = dispute.date.includes('T') 
                                      ? dispute.date 
                                      : dispute.date.replace(' ', 'T');
                                    const dateObj = new Date(isoString.endsWith('Z') || isoString.includes('+') ? isoString : `${isoString}Z`);
                                    return dateObj.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
                                  })()}</span>
                                </div>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    )}
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="notifications" className="space-y-4">
                <NotificationPanel role="pmo" />
              </TabsContent>

              <TabsContent value="activity" className="space-y-4">
                <ActivityFeed />
              </TabsContent>
            </Tabs>
          </div>
        )}

            {/* Manager Dashboard */}
            {role === "manager" && (
              <div className="space-y-6">
                {/* Manager Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <ScoreCard
                    title="Score do Setor"
                    value={stats.sectorPoints.toLocaleString()}
                    icon={Trophy}
                    trend="Posição em tempo real"
                    variant="primary"
                  />
                  <ScoreCard
                    title="Atividades Pendentes"
                    value={stats.pendingChecklists.toString()}
                    icon={FileText}
                    trend="Para hoje"
                    variant="warning"
                  />
                  <ScoreCard
                    title="Membros da Equipe"
                    value={stats.sectorMembers.toString()}
                    icon={Users}
                    trend="No seu setor"
                    variant="default"
                  />
                  <ScoreCard
                    title="Taxa de Conclusão"
                    value={stats.completionRate}
                    icon={TrendingUp}
                    trend="Sincronizado"
                    variant="success"
                  />
                </div>

            {/* Quick Actions for Manager */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-4 border-dashed border-2 hover:border-primary/50 cursor-pointer transition-all group">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <Plus className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Nova Atividade</p>
                    <p className="text-sm text-muted-foreground">Adicionar ao checklist (+100 pts)</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4 border-dashed border-2 hover:border-destructive/50 cursor-pointer transition-all group">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-destructive/10 group-hover:bg-destructive/20 transition-colors">
                    <AlertCircle className="w-5 h-5 text-destructive" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Reportar Erro</p>
                    <p className="text-sm text-muted-foreground">Notificar outro setor (+50 pts)</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4 border-dashed border-2 hover:border-success/50 cursor-pointer transition-all group">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-success/10 group-hover:bg-success/20 transition-colors">
                    <Users className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Gerenciar Equipe</p>
                    <p className="text-sm text-muted-foreground">{stats.sectorMembers} colaboradores</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Manager Tabs */}
            <Tabs defaultValue="checklist" className="space-y-4">
              <TabsList className="bg-muted">
                <TabsTrigger value="checklist">Checklist do Setor</TabsTrigger>
                <TabsTrigger value="team">Equipe</TabsTrigger>
                <TabsTrigger value="notifications">Notificações</TabsTrigger>
                <TabsTrigger value="pendencies">Pendências</TabsTrigger>
              </TabsList>

              <TabsContent value="checklist" className="space-y-4">
                <ChecklistManager role="manager" />
              </TabsContent>

              <TabsContent value="team" className="space-y-4">
                <TeamManager />
              </TabsContent>

              <TabsContent value="notifications" className="space-y-4">
                <NotificationPanel role="manager" />
              </TabsContent>

              <TabsContent value="pendencies" className="space-y-4">
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Target className="w-5 h-5 text-warning" />
                    Pendências do Setor
                  </h3>
                  <div className="space-y-4">
                    {[
                      { id: 1, type: "vital", description: "Adicionar 'Verificação de bombas de infusão' ao checklist", points: "+100", source: "Pontos Vitais" },
                      { id: 2, type: "absence", description: "Incluir 'Conferência de medicamentos' no checklist", points: "-100", source: "Notificação de Ausência" },
                    ].map(pendency => (
                      <div key={pendency.id} className="flex items-center justify-between p-4 rounded-lg border border-border">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className={
                              pendency.type === "vital" ? "bg-success/10 text-success border-success/30" :
                              "bg-destructive/10 text-destructive border-destructive/30"
                            }>
                              {pendency.source}
                            </Badge>
                            <Badge variant="outline" className={
                              pendency.points.startsWith("+") ? "bg-success/10 text-success border-success/30" :
                              "bg-destructive/10 text-destructive border-destructive/30"
                            }>
                              {pendency.points}
                            </Badge>
                          </div>
                          <p className="text-sm text-foreground">{pendency.description}</p>
                        </div>
                        <Button size="sm" className="bg-primary hover:bg-primary/90">
                          Resolver
                        </Button>
                      </div>
                    ))}
                  </div>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* Collaborator Dashboard */}
        {role === "collaborator" && (
          <div className="space-y-6">
            {/* Collaborator Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <ScoreCard
                title="Meu Score"
                value={stats.userPoints.toLocaleString()}
                icon={Trophy}
                trend="Seus pontos acumulados"
                variant="primary"
              />
              <ScoreCard
                title="Minhas Pendências"
                value={stats.pendingChecklists.toString()}
                icon={FileText}
                trend="Checklists novos"
                variant="warning"
              />
              <ScoreCard
                title="Notificações"
                value={stats.userNotices.toString()}
                icon={Bell}
                trend="Aguardando leitura"
                variant="default"
              />
              <ScoreCard
                title="Performance"
                value={stats.completionRate}
                icon={TrendingUp}
                trend="Meta do mês"
                variant="success"
              />
            </div>

            {/* Quick Actions for Collaborator */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-4 border-dashed border-2 hover:border-destructive/50 cursor-pointer transition-all group">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-destructive/10 group-hover:bg-destructive/20 transition-colors">
                    <AlertCircle className="w-5 h-5 text-destructive" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Reportar Erro</p>
                    <p className="text-sm text-muted-foreground">Notificar outro setor (+50 pts)</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4 border-dashed border-2 hover:border-gold/50 cursor-pointer transition-all group">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-gold/10 group-hover:bg-gold/20 transition-colors">
                    <Trophy className="w-5 h-5 text-gold" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Ver Ranking</p>
                    <p className="text-sm text-muted-foreground">Posição atual: 5º lugar</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Collaborator Checklist */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Meu Checklist de Hoje
                </h3>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                  5/12 concluídas
                </Badge>
              </div>
              <ChecklistManager role="collaborator" />
            </Card>
          </div>
        )}
      </>
    )}
  </div>
</AppLayout>
  );
};

export default Dashboard;
