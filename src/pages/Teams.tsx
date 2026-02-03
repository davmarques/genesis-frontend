import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Plus, 
  Search, 
  Mail, 
  Phone,
  MoreVertical,
  TrendingUp,
  Award,
  Target,
  Users,
  Building2,
  UserPlus,
  Settings,
  Loader2,
  Trophy,
  CheckCircle2
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ScoreCard } from "@/components/dashboard/ScoreCard";
import { useRole } from "@/contexts/RoleContext";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { supabase } from "@/lib/supabase";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "pmo" | "coordinator" | "collaborator";
  sector: string;
  setor_id?: number | string;
  unidade_id?: number | string;
  unidade_nome?: string;
  status: "active" | "inactive";
  tasksCompleted: number;
  totalTasks: number;
  points: number;
  level: number;
  joinDate: string;
}

interface Sector {
  id: string | number;
  nome: string;
  unidade_id?: number;
  unidade_nome?: string;
  coordenador_id?: number;
  coordinator?: string; // Nome vindo do join no backend
  membersCount?: number;
  score?: number;
  completionRate?: number;
  status?: "active" | "inactive";
}

interface Unidade {
  id: number;
  nome: string;
}

interface Coordinator {
  id: number;
  name: string;
}

const mockTeamMembers: TeamMember[] = [
 /*  {
    id: "1",
    name: "João Silva",
    email: "joao.silva@hospital.com",
    phone: "(11) 98765-4321",
    role: "collaborator",
    sector: "Cardiologia",
    status: "active",
    tasksCompleted: 127,
    totalTasks: 135,
    points: 1270,
    level: 5,
    joinDate: "2024-01-15"
  },
  {
    id: "2",
    name: "Ana Oliveira",
    email: "ana.oliveira@hospital.com",
    phone: "(11) 98765-4322",
    role: "collaborator",
    sector: "Cardiologia",
    status: "active",
    tasksCompleted: 98,
    totalTasks: 102,
    points: 980,
    level: 4,
    joinDate: "2024-02-20"
  },
  {
    id: "3",
    name: "Pedro Costa",
    email: "pedro.costa@hospital.com",
    phone: "(11) 98765-4323",
    role: "collaborator",
    sector: "Cardiologia",
    status: "active",
    tasksCompleted: 156,
    totalTasks: 160,
    points: 1560,
    level: 6,
    joinDate: "2023-11-10"
  },
  {
    id: "4",
    name: "Lucia Ferreira",
    email: "lucia.ferreira@hospital.com",
    phone: "(11) 98765-4324",
    role: "collaborator",
    sector: "Cardiologia",
    status: "inactive",
    tasksCompleted: 45,
    totalTasks: 78,
    points: 450,
    level: 2,
    joinDate: "2024-08-05"
  }, */
];

const mockSectors: Sector[] = [
  /* { id: "1", nome: "Ambulatório", coordinator: "Dra. Maria Santos", membersCount: 15, score: 3845, completionRate: 94, status: "active" },
  { id: "2", nome: "Atendimento PS", coordinator: "Dr. Paulo Lima", membersCount: 22, score: 3720, completionRate: 91, status: "active" },
  { id: "3", nome: "Central de Autorização", coordinator: "Dra. Clara Mendes", membersCount: 28, score: 3580, completionRate: 88, status: "active" },
  { id: "4", nome: "Central de Internação", coordinator: "Dr. Ricardo Alves", membersCount: 12, score: 3420, completionRate: 95, status: "active" },
  { id: "5", nome: "Centro Cirúrgico", coordinator: "Dra. Fernanda Dias", membersCount: 10, score: 3210, completionRate: 93, status: "active" },
  { id: "6", nome: "Centro Diagnóstico", coordinator: "Dr. Marcos Souza", membersCount: 18, score: 2980, completionRate: 89, status: "active" },
  { id: "7", nome: "Controladoria", coordinator: "Dr. Marcos Souza", membersCount: 18, score: 2980, completionRate: 89, status: "active" },
  { id: "8", nome: "Farmácia e Suprimentos", coordinator: "Dr. Marcos Souza", membersCount: 18, score: 2980, completionRate: 89, status: "active" },
  { id: "9", nome: "Faturamento", coordinator: "Dr. Marcos Souza", membersCount: 18, score: 2980, completionRate: 89, status: "active" },
  { id: "10", nome: "Financeiro", coordinator: "Dr. Marcos Souza", membersCount: 18, score: 2980, completionRate: 89, status: "active" },
  { id: "11", nome: "Gestão de Leitos", coordinator: "Dr. Marcos Souza", membersCount: 18, score: 2980, completionRate: 89, status: "active" },
  { id: "12", nome: "Higienização", coordinator: "Dr. Marcos Souza", membersCount: 18, score: 2980, completionRate: 89, status: "active" },
  { id: "13", nome: "Hotelaria", coordinator: "Dr. Marcos Souza", membersCount: 18, score: 2980, completionRate: 89, status: "active" },
  { id: "14", nome: "IRT", coordinator: "Dr. Marcos Souza", membersCount: 18, score: 2980, completionRate: 89, status: "active" },
  { id: "15", nome: "Laboratório", coordinator: "Dr. Marcos Souza", membersCount: 18, score: 2980, completionRate: 89, status: "active" },
  { id: "16", nome: "Nutrição", coordinator: "Dr. Marcos Souza", membersCount: 18, score: 2980, completionRate: 89, status: "active" },
  { id: "17", nome: "Oncologia", coordinator: "Dr. Marcos Souza", membersCount: 18, score: 2980, completionRate: 89, status: "active" },
  { id: "18", nome: "Pediatria", coordinator: "Dr. Marcos Souza", membersCount: 18, score: 2980, completionRate: 89, status: "active" },
  { id: "19", nome: "Pré-Faturamento", coordinator: "Dr. Marcos Souza", membersCount: 18, score: 2980, completionRate: 89, status: "active" },
  { id: "20", nome: "Pronto-Socorro", coordinator: "Dr. Marcos Souza", membersCount: 18, score: 2980, completionRate: 89, status: "active" },
  { id: "21", nome: "Regra de Negócios", coordinator: "Dr. Marcos Souza", membersCount: 18, score: 2980, completionRate: 89, status: "active" },
  { id: "22", nome: "Transporte", coordinator: "Dr. Marcos Souza", membersCount: 18, score: 2980, completionRate: 89, status: "active" },
  { id: "23", nome: "Unidade de Internação", coordinator: "Dr. Marcos Souza", membersCount: 18, score: 2980, completionRate: 89, status: "active" },
  { id: "24", nome: "UTI Adulto", coordinator: "Dr. Marcos Souza", membersCount: 18, score: 2980, completionRate: 89, status: "active" },
  { id: "25", nome: "UTINP", coordinator: "Dr. Marcos Souza", membersCount: 18, score: 2980, completionRate: 89, status: "active" }, */
];

export default function Teams() {
  const [searchQuery, setSearchQuery] = useState("");
  const { role, rolePermissions, userSector } = useRole();
  const [activeTab, setActiveTab] = useState(role === "pmo" ? "sectors" : "members");
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isSectorModalOpen, setIsSectorModalOpen] = useState(false);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [coordinators, setCoordinators] = useState<Coordinator[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [newSectorFormData, setNewSectorFormData] = useState({
    nome: "",
    unidade_id: "",
    coordenador_id: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [isLoadingSectors, setIsLoadingSectors] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    cpf: "",
    role: "collaborator",
    unidade_id: "",
    sector: ""
  });

  // Buscar dados reais do banco
  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingSectors(true);
      setIsLoadingMembers(true);
      try {
        const [sectorsData, unidadesData, coordinatorsData, membersData, notificationsData] = await Promise.allSettled([
          apiFetch("/admin/sectors"),
          apiFetch("/admin/unidades"),
          apiFetch("/admin/coordinators"),
          apiFetch("/admin/members"),
          supabase.from('notificacoes').select('*')
        ]);

        setSectors(sectorsData.status === 'fulfilled' ? (sectorsData.value || []) : []);
        setUnidades(unidadesData.status === 'fulfilled' ? (unidadesData.value || []) : []);
        setCoordinators(coordinatorsData.status === 'fulfilled' ? (coordinatorsData.value || []) : []);
        setMembers(membersData.status === 'fulfilled' ? (membersData.value || []) : []);
        setNotifications(notificationsData.status === 'fulfilled' ? (notificationsData.value.data || []) : []);

        if (sectorsData.status === 'rejected' || unidadesData.status === 'rejected' || coordinatorsData.status === 'rejected' || membersData.status === 'rejected') {
          console.warn("Alguns dados não puderam ser carregados");
        }
      } catch (error) {
        console.error("Erro fatal ao carregar dados:", error);
        toast.error("Não foi possível carregar os dados necessários.");
      } finally {
        setIsLoadingSectors(false);
        setIsLoadingMembers(false);
      }
    };

    fetchData();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.unidade_id) {
      toast.error("Por favor, selecione uma unidade.");
      return;
    }
    
    if (!formData.sector) {
      toast.error("Por favor, selecione um setor.");
      return;
    }

    setIsSubmitting(true);
    console.log("Enviando solicitação de criação de usuário para o backend...");

    try {
      // Agora chamamos o backend para criar o usuário com segurança
      const result = await apiFetch("/admin/users", {
        method: "POST",
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          cpf: formData.cpf,
          role: formData.role,
          sector: formData.sector,
          unidade_id: parseInt(formData.unidade_id)
        })
      });
      console.log("Resposta do servidor:", result);

      toast.success("Usuário criado com sucesso! Senha padrão: admin123");
      setIsUserModalOpen(false);
      setFormData({
        name: "",
        email: "",
        cpf: "",
        role: "collaborator",
        unidade_id: "",
        sector: ""
      });
    } catch (error: any) {
      console.error("Erro ao criar usuário:", error);
      toast.error(error.message || "Erro ao criar usuário");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddSector = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const result = await apiFetch("/admin/sectors", {
        method: "POST",
        body: JSON.stringify({ 
          nome: newSectorFormData.nome,
          unidade_id: parseInt(newSectorFormData.unidade_id),
          coordenador_id: (newSectorFormData.coordenador_id && newSectorFormData.coordenador_id !== "none") 
            ? parseInt(newSectorFormData.coordenador_id) 
            : null
        })
      });

      toast.success("Setor criado com sucesso!");
      setIsSectorModalOpen(false);
      setNewSectorFormData({ nome: "", unidade_id: "", coordenador_id: "" });
      
      // Atualizar lista de setores
      const updatedSectors = await apiFetch("/admin/sectors");
      setSectors(updatedSectors);
    } catch (error: any) {
      console.error("Erro ao criar setor:", error);
      toast.error(error.message || "Erro ao criar setor");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSubtitle = () => {
    switch (role) {
      case "pmo": return "Gerencie todos os setores e usuários";
      case "coordinator": return `Gerencie sua equipe do setor ${userSector}`;
      default: return "Visualize membros da equipe";
    }
  };

  // Filter based on role
  const filteredMembers = (members.length > 0 ? members : []).filter(m => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      m.name.toLowerCase().includes(searchLower) || 
      m.email.toLowerCase().includes(searchLower) ||
      m.sector.toLowerCase().includes(searchLower) ||
      (m.unidade_nome || "").toLowerCase().includes(searchLower);
    
    if (!matchesSearch) return false;

    if (role === "pmo") return true;
    if (role === "coordinator") return m.sector === userSector;
    return false;
  });

  const filteredSectors = (sectors.length > 0 ? sectors : []).filter(s => {
    const searchLower = searchQuery.toLowerCase();
    return (
      s.nome.toLowerCase().includes(searchLower) ||
      (s.unidade_nome || "").toLowerCase().includes(searchLower) ||
      (s.coordinator || "").toLowerCase().includes(searchLower)
    );
  }).map(sector => {
    // Vincular membros e pontos reais
    const sectorMembers = members.filter(m => 
      m.setor_id === sector.id || 
      m.sector === sector.nome
    );

    // Calcular score baseado nas notificações do setor
    const sectorScore = notifications.reduce((acc, n) => {
      let score = acc;
      // Ganha 50 pontos se reportou uma irregularidade
      if (Number(n.id_setor_ref) === Number(sector.id)) {
        score += 50;
      }
      // Perde pontos se recebeu uma irregularidade
      if (Number(n.setor_id) === Number(sector.id)) {
        score += (n.notified ? -50 : -100);
      }
      return score;
    }, 0);

    return {
      ...sector,
      membersCount: sectorMembers.length,
      score: sectorScore
    };
  });

  const getInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const getCompletionRate = (completed: number, total: number) => {
    return Math.round((completed / total) * 100);
  };

  const getRoleBadge = (memberRole: string) => {
    const variants = {
      pmo: "bg-gold/10 text-gold border-gold/30",
      coordinator: "bg-primary/10 text-primary border-primary/30",
      collaborator: "bg-secondary/10 text-secondary-foreground border-secondary/30"
    };
    const labels = {
      pmo: "PMO",
      coordinator: "Coordenador",
      collaborator: "Colaborador"
    };
    return (
      <Badge variant="outline" className={variants[memberRole as keyof typeof variants]}>
        {labels[memberRole as keyof typeof labels]}
      </Badge>
    );
  };

  return (
    <AppLayout title="Equipes" subtitle={getSubtitle()}>
      <div className="p-6 space-y-6">
        {/* Header Actions */}
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            {role === "pmo" && (
              <Button 
                className="gap-2 bg-primary hover:bg-primary/90"
                onClick={() => setIsSectorModalOpen(true)}
              >
                <Building2 className="w-4 h-4" />
                Novo Setor
              </Button>
            )}
          </div>
          {(role === "pmo" || role === "coordinator") && (
            <Button 
              className="gap-2 bg-primary hover:bg-primary/90"
              onClick={() => setIsUserModalOpen(true)}
            >
              <UserPlus className="w-4 h-4" />
              {role === "coordinator" ? "Adicionar Colaborador" : "Adicionar Usuário"}
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <ScoreCard
            title={role === "pmo" ? "Total de Membros" : "Membros da Equipe"}
            value={filteredMembers.length.toString()}
            icon={Users}
            variant="default"
          />
          <ScoreCard
            title="Membros Ativos"
            value={filteredMembers.filter(m => m.status === "active").length.toString()}
            icon={CheckCircle2}
            variant="success"
          />
          <ScoreCard
            title="Pontos Totais"
            value={
              notifications.length > 0 
                ? (notifications.length * 50 + notifications.reduce((acc, n) => acc + (n.notified ? -50 : -100), 0)).toLocaleString('pt-BR') 
                : "0"
            }
            icon={Trophy}
            variant="primary"
          />
          <ScoreCard
            title={role === "pmo" ? "Setores Ativos" : "Taxa Média"}
            value={role === "pmo" ? (sectors?.length || 0).toString() : "94%"}
            icon={Target}
            variant="warning"
          />
        </div>

        {/* Search */}
        <Card className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, setor ou unidade..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            {role === "pmo" && <TabsTrigger value="sectors">Setores</TabsTrigger>}
            {role === "pmo" && <TabsTrigger value="coordinators">Coordenadores</TabsTrigger>}
            <TabsTrigger value="members">
              {role === "coordinator" ? "Minha Equipe" : "Membros"}
            </TabsTrigger>
          </TabsList>

          {/* Members Tab */}
          <TabsContent value="members" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredMembers.map((member) => {
                const completionRate = getCompletionRate(member.tasksCompleted, member.totalTasks);
                
                return (
                  <Card key={member.id} className="p-6 hover:border-primary/50 transition-all">
                    <div className="flex items-start gap-4">
                      <Avatar className="w-16 h-16 bg-gradient-to-br from-primary to-secondary">
                        <AvatarFallback className="bg-transparent text-primary-foreground font-semibold text-lg">
                          {getInitials(member.name)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-xl font-bold text-foreground mb-1">
                              {member.name}
                            </h3>
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              {getRoleBadge(member.role)}
                              <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">
                                {member.unidade_nome || "Anchieta"}
                              </Badge>
                              <Badge 
                                variant="outline" 
                                className={member.status === "active" 
                                  ? "bg-success/10 text-success border-success/30" 
                                  : "bg-muted text-muted-foreground"}
                              >
                                {member.status === "active" ? "Ativo" : "Inativo"}
                              </Badge>
                              <Badge variant="outline">Nível {member.level}</Badge>
                            </div>
                          </div>
                          {(role === "pmo" || role === "coordinator") && (
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          )}
                        </div>

                        <div className="space-y-2 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Mail className="w-3 h-3" />
                            <span>{member.email}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone className="w-3 h-3" />
                            <span>{member.phone}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Setor</p>
                            <Badge variant="outline">{member.sector}</Badge>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Pontos</p>
                            <Badge className="bg-primary/10 text-primary border-primary/30 font-bold">
                              {member.points}
                            </Badge>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Tarefas</p>
                            <p className="text-sm font-semibold text-foreground">
                              {member.tasksCompleted}/{member.totalTasks}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Taxa</p>
                            <p className="text-sm font-semibold text-foreground">{completionRate}%</p>
                          </div>
                        </div>

                        {role === "coordinator" && (
                          <div className="flex gap-2 pt-3">
                            <Button size="sm" variant="outline" className="flex-1">
                              Atribuir Tarefa
                            </Button>
                            <Button size="sm" variant="ghost">
                              <Settings className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Sectors Tab (PMO Only) */}
          {role === "pmo" && (
            <TabsContent value="sectors" className="mt-6">
              <div className="space-y-4">
                {filteredSectors.map((sector, index) => (
                  <Card key={sector.id} className="p-6 hover:border-primary/50 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                          index === 0 ? "bg-gradient-to-r from-gold to-warning text-gold-foreground" :
                          index === 1 ? "bg-gradient-to-r from-muted to-border text-foreground" :
                          index === 2 ? "bg-gradient-to-r from-amber-700 to-amber-500 text-white" :
                          "bg-muted text-foreground"
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-foreground">{sector.nome}</h3>
                          <p className="text-sm text-muted-foreground">
                            Unidade: <span className="font-semibold text-primary">{sector.unidade_nome}</span> | Coordenador: <span className="font-semibold text-foreground">{sector.coordinator || "Sem coordenador"}</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Membros</p>
                          <p className="text-lg font-bold text-foreground">{sector.membersCount || 0}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Taxa</p>
                          <p className="text-lg font-bold text-foreground">{sector.completionRate || 0}%</p>
                        </div>
                        <Badge className="bg-primary/10 text-primary border-primary/30 font-bold text-lg px-3 py-1">
                          {sector.score || 0} pts
                        </Badge>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </TabsContent>
          )}

          {/* Coordinators Tab (PMO Only) */}
          {role === "pmo" && (
            <TabsContent value="coordinators" className="mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredSectors.map((sector) => (
                  <Card key={sector.id} className="p-6 hover:border-primary/50 transition-all">
                    <div className="flex items-start gap-4">
                      <Avatar className="w-14 h-14 bg-gradient-to-br from-primary to-secondary">
                        <AvatarFallback className="bg-transparent text-primary-foreground font-semibold">
                          {(sector.coordinator || "SC").split(" ").map(n => n[0]).join("").slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-foreground mb-1">
                          {sector.coordinator || "Sem Coordenador"}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                            Coordenador
                          </Badge>
                          <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">
                            {sector.unidade_nome || "Anchieta"}
                          </Badge>
                          <Badge variant="outline">{sector.nome}</Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-4 pt-3 border-t border-border">
                          <div>
                            <p className="text-xs text-muted-foreground">Equipe</p>
                            <p className="font-semibold text-foreground">{sector.membersCount || 0}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Score</p>
                            <p className="font-semibold text-primary">{sector.score || 0}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Taxa</p>
                            <p className="font-semibold text-foreground">{sector.completionRate || 0}%</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </TabsContent>
          )}
        </Tabs>

        {/* Add User Modal */}
        <Dialog open={isUserModalOpen} onOpenChange={setIsUserModalOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {role === "coordinator" ? "Adicionar Novo Colaborador" : "Adicionar Novo Usuário"}
              </DialogTitle>
              <DialogDescription>
                Preencha os dados abaixo para cadastrar um novo membro na equipe.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddUser} className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="name">Nome Completo</Label>
                  <Input
                    id="name"
                    placeholder="Ex: João Silva"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cpf">CPF</Label>
                  <Input
                    id="cpf"
                    placeholder="000.000.000-00"
                    value={formData.cpf}
                    onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Cargo</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) => setFormData({ ...formData, role: value })}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o cargo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="coordinator">Coordenador</SelectItem>
                      <SelectItem value="collaborator">Colaborador</SelectItem>
                      {role === "pmo" && <SelectItem value="pmo">PMO</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="joao.silva@hospital.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="unidade">Unidade</Label>
                  <Select
                    value={formData.unidade_id}
                    onValueChange={(value) => setFormData({ ...formData, unidade_id: value, sector: "" })}
                    disabled={isSubmitting || isLoadingSectors}
                  >
                    <SelectTrigger>
                      {isLoadingSectors ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Carregando unidades...</span>
                        </div>
                      ) : (
                        <SelectValue placeholder="Selecione a unidade" />
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {unidades.length > 0 ? (
                        unidades.map((unidade) => (
                          <SelectItem key={unidade.id} value={unidade.id.toString()}>
                            {unidade.nome}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled>
                          Nenhuma unidade cadastrada
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="sector">Setor</Label>
                  <Select
                    value={formData.sector}
                    onValueChange={(value) => setFormData({ ...formData, sector: value })}
                    disabled={isSubmitting || isLoadingSectors || !formData.unidade_id}
                  >
                    <SelectTrigger>
                      {isLoadingSectors ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Carregando setores...</span>
                        </div>
                      ) : (
                        <SelectValue placeholder={!formData.unidade_id ? "Selecione primeiro a unidade" : "Selecione o setor"} />
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {formData.unidade_id && sectors
                        .filter(s => s.unidade_id === parseInt(formData.unidade_id))
                        .map((sector) => (
                          <SelectItem key={sector.id} value={sector.nome}>
                            {sector.nome}
                          </SelectItem>
                        ))}
                      {formData.unidade_id && sectors.filter(s => s.unidade_id === parseInt(formData.unidade_id)).length === 0 && !isLoadingSectors && (
                        <SelectItem value="none" disabled>Nenhum setor encontrado para esta unidade</SelectItem>
                      )}
                      {!formData.unidade_id && (
                        <SelectItem value="none" disabled>Selecione uma unidade primeiro</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter className="pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsUserModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Criando..." : "Criar Usuário"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Add Sector Modal */}
        <Dialog open={isSectorModalOpen} onOpenChange={setIsSectorModalOpen}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Adicionar Novo Setor</DialogTitle>
              <DialogDescription>
                Informe o nome do novo setor que será criado no sistema.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddSector} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="unidadeId">Unidade</Label>
                <Select
                  value={newSectorFormData.unidade_id}
                  onValueChange={(value) => setNewSectorFormData({ ...newSectorFormData, unidade_id: value })}
                  required
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a unidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {unidades.map((unidade) => (
                      <SelectItem key={unidade.id} value={unidade.id.toString()}>
                        {unidade.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sectorName">Nome do Setor</Label>
                <Input
                  id="sectorName"
                  placeholder="Ex: Recursos Humanos"
                  value={newSectorFormData.nome}
                  onChange={(e) => setNewSectorFormData({ ...newSectorFormData, nome: e.target.value })}
                  required
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="coordinatorId">Coordenador (Opcional)</Label>
                <Select
                  value={newSectorFormData.coordenador_id}
                  onValueChange={(value) => setNewSectorFormData({ ...newSectorFormData, coordenador_id: value })}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o coordenador" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {coordinators.map((coord) => (
                      <SelectItem key={coord.id} value={coord.id.toString()}>
                        {coord.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter className="pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsSectorModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Criando..." : "Criar Setor"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
