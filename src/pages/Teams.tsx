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
  CheckCircle2,
  Trash2
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AppLayout } from "@/components/layout/AppLayout";
import { ScoreCard } from "@/components/dashboard/ScoreCard";
import { useRole, normalizeRole } from "@/contexts/RoleContext";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { supabase } from "@/lib/supabase";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "pmo" | "manager" | "collaborator" | "comercial";
  sector: string;
  managedSectorName?: string;
  setor_id?: number | string;
  unidade_id?: number | string;
  unidade_nome?: string;
  isSectorManager?: boolean;
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
  manager?: string; // Nome vindo do join no backend
  manager_email?: string;
  manager_id?: string | number;
  membersCount?: number;
  score?: number;
  completionRate?: number;
  status?: "active" | "inactive";
}

interface Unidade {
  id: number;
  nome: string;
}

interface Manager {
  id: number;
  name: string;
}

export default function Teams() {
  const [searchQuery, setSearchQuery] = useState("");
  const { role, rolePermissions, userSector, userUnitId, userSectorId } = useRole();
  const [activeTab, setActiveTab] = useState(role === "pmo" ? "sectors" : "members");
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<TeamMember | null>(null);

  // Pre-fill form data for managers
  useEffect(() => {
    if (isUserModalOpen && role === "manager") {
      setFormData(prev => ({
        ...prev,
        unidade_id: userUnitId || "",
        sector: userSector || ""
      }));
    }
  }, [isUserModalOpen, role, userUnitId, userSector]);
  const [isSectorModalOpen, setIsSectorModalOpen] = useState(false);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
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
        const [sectorsData, unidadesData, managersData, membersData, notificationsData] = await Promise.allSettled([
          apiFetch("/admin/sectors"),
          apiFetch("/admin/unidades"),
          apiFetch("/admin/managers"),
          apiFetch("/admin/members"),
          supabase.from('notificacoes').select('*')
        ]);

        setSectors(sectorsData.status === 'fulfilled' ? (sectorsData.value || []) : []);
        setUnidades(unidadesData.status === 'fulfilled' ? (unidadesData.value || []) : []);
        setManagers(managersData.status === 'fulfilled' ? (managersData.value || []) : []);
        setMembers(membersData.status === 'fulfilled' ? (membersData.value || []) : []);
        setNotifications(notificationsData.status === 'fulfilled' ? (notificationsData.value.data || []) : []);

        console.log("Data loaded:", {
          sectors: sectorsData.status === 'fulfilled' ? sectorsData.value : "error",
          members: membersData.status === 'fulfilled' ? membersData.value : "error"
        });

        if (sectorsData.status === 'rejected' || unidadesData.status === 'rejected' || managersData.status === 'rejected' || membersData.status === 'rejected') {
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

    if (formData.role !== "comercial") {
      if (!formData.unidade_id) {
        toast.error("Por favor, selecione uma unidade.");
        return;
      }

      if (!formData.sector) {
        toast.error("Por favor, selecione um setor.");
        return;
      }
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
          sector: formData.role === "comercial" ? "Comercial" : formData.sector,
          unidade_id: formData.role === "comercial" ? null : parseInt(formData.unidade_id)
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

  const handleDeleteMember = async () => {
    if (!memberToDelete) return;

    setIsSubmitting(true);
    try {
      await apiFetch(`/admin/users?id=${memberToDelete.id}`, {
        method: "DELETE"
      });

      toast.success("Membro removido com sucesso!");
      setMembers(prev => prev.filter(m => m.id !== memberToDelete.id));
      setIsDeleteDialogOpen(false);
      setMemberToDelete(null);
    } catch (error: any) {
      console.error("Erro ao deletar membro:", error);
      toast.error(error.message || "Erro ao remover membro");
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
      case "manager": return `Gerencie sua equipe do setor ${userSector}`;
      default: return "Visualize membros da equipe";
    }
  };

  // Filter based on role
  const filteredMembers = (members && members.length > 0 ? members : []).filter(m => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      (m.name || "").toLowerCase().includes(searchLower) ||
      (m.email || "").toLowerCase().includes(searchLower) ||
      (m.sector || "").toLowerCase().includes(searchLower) ||
      (m.unidade_nome || "").toLowerCase().includes(searchLower);

    if (!matchesSearch) return false;

    // PMO vê tudo
    if (role === "pmo") return true;

    // Gestor e Colaborador vêem membros do seu próprio setor
    if (userSectorId && m.setor_id) {
      return String(m.setor_id) === String(userSectorId);
    }

    return m.sector === userSector;
  });

  const filteredSectors = (sectors && sectors.length > 0 ? sectors : []).filter(s => {
    const searchLower = searchQuery.toLowerCase();
    const managerName = s.manager || (s as any).coordinator || (s as any).coordenador?.name || "";
    const matchesSearch = (
      (s.nome || "").toLowerCase().includes(searchLower) ||
      (s.unidade_nome || "").toLowerCase().includes(searchLower) ||
      managerName.toLowerCase().includes(searchLower)
    );

    if (!matchesSearch) return false;

    if (role === "pmo") return true;

    if (userSectorId && s.id) {
      return String(s.id) === String(userSectorId);
    }

    return s.nome === userSector;
  }).map(sector => {
    const sectorMembers = members.filter(m =>
      (m.setor_id && sector.id && String(m.setor_id) === String(sector.id)) ||
      m.sector === sector.nome
    );

    const sectorScore = notifications.reduce((acc, n) => {
      let score = acc;
      if (String(n.id_setor_ref) === String(sector.id)) {
        score += 50;
      }
      if (String(n.setor_id) === String(sector.id)) {
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
    const normalized = normalizeRole(memberRole);
    const variants = {
      pmo: "bg-gold/10 text-gold border-gold/30",
      manager: "bg-primary/10 text-primary border-primary/30",
      collaborator: "bg-secondary/10 text-secondary-foreground border-secondary/30",
      comercial: "bg-blue-100 text-blue-700 border-blue-200"
    };
    const labels = {
      pmo: "PMO",
      manager: "Gestor",
      collaborator: "Colaborador",
      comercial: "Comercial"
    };
    return (
      <Badge variant="outline" className={variants[normalized as keyof typeof variants] || variants.collaborator}>
        {labels[normalized as keyof typeof labels] || normalized}
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
          {rolePermissions.canManageUsers && (
            <Button
              className="gap-2 bg-primary hover:bg-primary/90"
              onClick={() => setIsUserModalOpen(true)}
            >
              <UserPlus className="w-4 h-4" />
              {role === "manager" ? "Adicionar Colaborador" : "Adicionar Usuário"}
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
            {role === "pmo" && <TabsTrigger value="managers">Gestores</TabsTrigger>}
            <TabsTrigger value="members">
              {role === "manager" ? "Minha Equipe" : "Membros"}
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
                            </div>
                          </div>
                          {rolePermissions.canManageUsers && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem 
                                  className="text-destructive focus:text-destructive cursor-pointer"
                                  onClick={() => {
                                    setMemberToDelete(member);
                                    setIsDeleteDialogOpen(true);
                                  }}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
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
                        </div>

                        {role === "manager" && (
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
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${index === 0 ? "bg-gradient-to-r from-gold to-warning text-gold-foreground" :
                            index === 1 ? "bg-gradient-to-r from-muted to-border text-foreground" :
                              index === 2 ? "bg-gradient-to-r from-amber-700 to-amber-500 text-white" :
                                "bg-muted text-foreground"
                          }`}>
                          {index + 1}
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-foreground">{sector.nome}</h3>
                          <div className="flex flex-col gap-1">
                            <p className="text-sm text-muted-foreground">
                              Unidade: <span className="font-semibold text-primary">{sector.unidade_nome}</span> | Gestor: <span className="font-semibold text-foreground">{sector.manager || (sector as any).coordinator || (sector as any).coordenador?.name || "Não definido"}</span>
                            </p>
                            {(sector.manager_email || (sector as any).coordenador?.email) && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {sector.manager_email || (sector as any).coordenador?.email}
                              </p>
                            )}
                          </div>
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

          {/* Managers Tab (PMO Only) */}
          {role === "pmo" && (
            <TabsContent value="managers" className="mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {members
                  .filter(m => m.isSectorManager || normalizeRole(m.role) === "manager")
                  .map((managerMember) => {
                    const mySector = sectors.find(s =>
                      String(s.coordenador_id) === String(managerMember.id) ||
                      String((s as any).manager_id) === String(managerMember.id) ||
                      s.nome === managerMember.managedSectorName ||
                      s.nome === managerMember.sector
                    );

                    const sectorMembers = members.filter(m =>
                      (m.setor_id && mySector?.id && String(m.setor_id) === String(mySector.id)) ||
                      (m.sector === mySector?.nome)
                    );

                    return (
                      <Card key={managerMember.id} className="p-6 hover:border-primary/50 transition-all">
                        <div className="flex items-start gap-4">
                          <Avatar className="w-14 h-14 bg-gradient-to-br from-primary to-secondary">
                            <AvatarFallback className="bg-transparent text-primary-foreground font-semibold">
                              {getInitials(managerMember.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <h3 className="text-xl font-bold text-foreground mb-1">
                              {managerMember.name}
                            </h3>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                              <Mail className="w-3 h-3" />
                              <span>{managerMember.email}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 mb-3">
                              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                                Gestor
                              </Badge>
                              <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">
                                {managerMember.unidade_nome || "Hospital"}
                              </Badge>
                              <Badge variant="outline">{mySector?.nome || managerMember.sector || managerMember.managedSectorName || "Sem Setor"}</Badge>
                            </div>
                            <div className="grid grid-cols-3 gap-4 pt-3 border-t border-border">
                              <div>
                                <p className="text-xs text-muted-foreground">Equipe</p>
                                <p className="font-semibold text-foreground">{sectorMembers.length}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Pontos</p>
                                <p className="font-semibold text-primary">{managerMember.points}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Nível</p>
                                <p className="font-semibold text-foreground">{managerMember.level}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                {members.filter(m => m.isSectorManager || normalizeRole(m.role) === "manager").length === 0 && (
                  <div className="col-span-2 text-center py-10 text-muted-foreground">
                    Nenhum gestor encontrado.
                  </div>
                )}
              </div>
            </TabsContent>
          )}
        </Tabs>

        {/* Add User Modal */}
        <Dialog open={isUserModalOpen} onOpenChange={setIsUserModalOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {role === "manager" ? "Adicionar Novo Colaborador" : "Adicionar Novo Usuário"}
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
                      <SelectItem value="manager">Gestor</SelectItem>
                      <SelectItem value="collaborator">Colaborador</SelectItem>
                      <SelectItem value="comercial">Comercial</SelectItem>
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
                    disabled={isSubmitting || isLoadingSectors || role === "manager" || formData.role === "comercial"}
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
                    disabled={isSubmitting || isLoadingSectors || !formData.unidade_id || role === "manager" || formData.role === "commercial"}
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

        {/* Delete Confirmation Modal */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. Isso excluirá permanentemente o usuário
                <span className="font-bold text-foreground mx-1">{memberToDelete?.name}</span>
                e removerá todos os dados associados de nossos servidores.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={(e) => {
                  e.preventDefault();
                  handleDeleteMember();
                }}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Excluindo...</span>
                  </div>
                ) : (
                  "Confirmar Exclusão"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

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
                <Label htmlFor="coordinatorId">Gestor (Opcional)</Label>
                <Select
                  value={newSectorFormData.coordenador_id}
                  onValueChange={(value) => setNewSectorFormData({ ...newSectorFormData, coordenador_id: value })}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o gestor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {managers.map((coord) => (
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
