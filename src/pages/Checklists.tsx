import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Plus,
  Search,
  Trash2,
  Building2,
  Handshake,
  FileText,
  Loader2,
  ChevronRight,
  ArrowRight,
  Layers
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";
import { useRole } from "@/contexts/RoleContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

export default function Checklists() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("servicos");
  const { role, rolePermissions, userSector, userSectorId, userUnitId } = useRole();
  const [dbChecklists, setDbChecklists] = useState<any[]>([]);
  const [dbServicos, setDbServicos] = useState<any[]>([]);
  const [dbConvenios, setDbConvenios] = useState<any[]>([]);
  const [unidades, setUnidades] = useState<any[]>([]);
  const [setores, setSetores] = useState<any[]>([]);

  // Novos estados para cadastro rápido
  const [quickActivityTitle, setQuickActivityTitle] = useState("");
  const [selectedSectorMain, setSelectedSectorMain] = useState<string>("");
  const [isRegistering, setIsRegistering] = useState(false);

  // Estados para Atividades do Serviço
  const [isAddingSubItem, setIsAddingSubItem] = useState(false);
  const [subItemTitle, setSubItemTitle] = useState("");
  const [selectedServicoId, setSelectedServicoId] = useState<number | null>(null);
  const [openServicos, setOpenServicos] = useState<string[]>([]);

  // Estados para Atividades do Convênio
  const [selectedConvenioId, setSelectedConvenioId] = useState<number | null>(null);
  const [openConvenios, setOpenConvenios] = useState<string[]>([]);
  const [newServiceName, setNewServiceName] = useState("");
  const [isAddingServiceInConvenio, setIsAddingServiceInConvenio] = useState(false);
  const [openNestedServicos, setOpenNestedServicos] = useState<string[]>([]);

  const { toast } = useToast();

  useEffect(() => {
    if (userSectorId) {
      setSelectedSectorMain(userSectorId.toString());
    }
  }, [userSectorId]);

  const getStorageUrl = (path: string) => {
    if (!path) return "#";
    if (path.startsWith('http')) return path;

    try {
      const { data } = supabase.storage.from('checklist_upload').getPublicUrl(path);
      return data?.publicUrl || "#";
    } catch (e) {
      console.error("Erro ao gerar URL do storage:", e);
      return "#";
    }
  };

  const fetchChecklists = async () => {
    try {
      console.log("Fetching for sector:", selectedSectorMain);

      // 1. Busca Atividades Principais (Tabela checklist)
      let checklistsQuery = supabase
        .from('checklist')
        .select('*') // Simplificado para garantir o carregamento
        .order('created_at', { ascending: false });

      // 2. Busca Serviços (Tabela servico)
      let servicosQuery = supabase
        .from('servico')
        .select('*')
        .order('created_at', { ascending: false });

      // 3. Busca Convênios (Tabela convenio)
      let conveniosQuery = supabase
        .from('convenio')
        .select(`
          *,
          servico_convenio (
            *
          ),
          checklist_convenio!checklist_convenio_convenio_id_fkey (
            *
          )
        `)
        .order('created_at', { ascending: false });

      if (selectedSectorMain) {
        const sid = Number(selectedSectorMain);
        checklistsQuery = checklistsQuery.eq('setor_id', sid);
        servicosQuery = servicosQuery.eq('setor_id', sid);
        conveniosQuery = conveniosQuery.eq('setor_id', sid);
      } else if (role !== 'pmo') {
        if (userSectorId) {
          const sid = Number(userSectorId);
          checklistsQuery = checklistsQuery.eq('setor_id', sid);
          servicosQuery = servicosQuery.eq('setor_id', sid);
          conveniosQuery = conveniosQuery.eq('setor_id', sid);
        } else if (userUnitId) {
          const uid = Number(userUnitId);
          checklistsQuery = checklistsQuery.eq('unidade_id', uid);
          servicosQuery = servicosQuery.eq('unidade_id', uid);
          conveniosQuery = conveniosQuery.eq('unidade_id', uid);
        }
      }

      const [resChecklists, resServicos, resConvenios] = await Promise.all([
        checklistsQuery,
        servicosQuery,
        conveniosQuery
      ]);

      if (resChecklists.error) {
        console.error("Checklists error:", resChecklists.error);
        throw resChecklists.error;
      }
      if (resServicos.error) {
        console.error("Servicos error:", resServicos.error);
        throw resServicos.error;
      }
      if (resConvenios.error) {
        console.error("Convenios error:", resConvenios.error);
        throw resConvenios.error;
      }

      console.log("Checklists found:", resChecklists.data?.length);
      console.log("Servicos found:", resServicos.data?.length);
      console.log("Convenios found:", resConvenios.data?.length);

      setDbChecklists(resChecklists.data || []);
      setDbServicos(resServicos.data || []);
      setDbConvenios(resConvenios.data || []);
    } catch (error: any) {
      console.error("Erro ao buscar dados:", error);
      toast({ variant: "destructive", title: "Erro de Conexão", description: "Não foi possível carregar os dados do banco." });
    }
  };

  const handleQuickRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickActivityTitle.trim() || !selectedSectorMain) {
      toast({
        variant: "destructive",
        title: "Campos obrigatórios",
        description: "Digite o título e selecione um setor.",
      });
      return;
    }

    setIsRegistering(true);
    try {
      if (activeTab === "atividades") {
        const { error } = await supabase
          .from('checklist')
          .insert({
            titulo: quickActivityTitle,
            setor_id: Number(selectedSectorMain),
            unidade_id: Number(userUnitId) || null,
            pdf_url: "" // Requisito da tabela
          });
        if (error) throw error;

        // Registrar ganho de pontos por melhoria proativa
        await supabase.from('notificacoes').insert({
          setor_id: Number(selectedSectorMain),
          unidade_id: Number(userUnitId) || null,
          description: `Melhoria proativa: Inclusão de "${quickActivityTitle}" no checklist.`,
          status: 'accepted',
          nao_no_checklist: true,
          created_at: new Date().toISOString()
          // id_setor_ref fica null (Sistema)
        });
      } else if (activeTab === "servicos") {
        const { error } = await supabase
          .from('servico')
          .insert({
            nome: quickActivityTitle,
            setor_id: Number(selectedSectorMain),
            unidade_id: Number(userUnitId) || null
          });
        if (error) throw error;

        // Registrar ganho de pontos por melhoria proativa (Serviço)
        await supabase.from('notificacoes').insert({
          setor_id: Number(selectedSectorMain),
          unidade_id: Number(userUnitId) || null,
          description: `Melhoria proativa: Novo serviço "${quickActivityTitle}" cadastrado.`,
          status: 'accepted',
          nao_no_checklist: true,
          created_at: new Date().toISOString()
        });
      } else if (activeTab === "convenios") {
        const { error } = await supabase
          .from('convenio')
          .insert({
            nome: quickActivityTitle,
            setor_id: Number(selectedSectorMain),
            unidade_id: Number(userUnitId) || null
          });
        if (error) throw error;

        // Registrar ganho de pontos por melhoria proativa (Convênio)
        await supabase.from('notificacoes').insert({
          setor_id: Number(selectedSectorMain),
          unidade_id: Number(userUnitId) || null,
          description: `Melhoria proativa: Novo convênio "${quickActivityTitle}" cadastrado.`,
          status: 'accepted',
          nao_no_checklist: true,
          created_at: new Date().toISOString()
        });
      }

      toast({ title: "Sucesso!", description: activeTab === "atividades" ? "Atividade cadastrada (+100 pts)." : activeTab === "servicos" ? "Serviço cadastrado (+100 pts)." : "Convênio cadastrado (+100 pts)." });
      setQuickActivityTitle("");
      fetchChecklists();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro", description: error.message });
    } finally {
      setIsRegistering(false);
    }
  };

  const handleAddSubItem = async (e: React.FormEvent, type: 'servico' | 'convenio', forceServiceId?: number) => {
    e.preventDefault();
    const parentId = type === 'servico' ? selectedServicoId : selectedConvenioId;
    if (!subItemTitle.trim() || !parentId) return;

    setIsAddingSubItem(true);
    try {
      if (type === 'servico') {
        const { error } = await supabase
          .from('checklist_convenio_geral')
          .insert({
            titulo: subItemTitle,
            servico_convenio_id: parentId,
            setor_id: Number(selectedSectorMain),
            unidade_id: Number(userUnitId) || null
          });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('checklist_convenio')
          .insert({
            titulo: subItemTitle,
            convenio_id: parentId,
            servico_convenio_id: forceServiceId,
            setor_id: Number(selectedSectorMain),
            unidade_id: Number(userUnitId) || null
          });
        if (error) throw error;
      }

      toast({ title: "Atividade adicionada", description: "Sucesso ao cadastrar atividade." });
      setSubItemTitle("");
      fetchChecklists();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro", description: error.message });
    } finally {
      setIsAddingSubItem(false);
    }
  };

  const handleCreateServiceInConvenio = async (e: React.FormEvent, convenioId: number) => {
    e.preventDefault();
    if (!newServiceName.trim()) {
      toast({ variant: "destructive", title: "Campos vazios", description: "Nome do serviço é obrigatório." });
      return;
    }

    setIsAddingServiceInConvenio(true);
    try {
      const { error } = await supabase.from('servico_convenio').insert({
        nome: newServiceName.trim(),
        convenio_id: convenioId,
        setor_id: Number(selectedSectorMain),
        unidade_id: Number(userUnitId) || null
      });

      if (error) throw error;

      toast({ title: "Serviço criado", description: "O serviço foi associado a este convênio." });
      setNewServiceName("");
      fetchChecklists();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro", description: error.message });
    } finally {
      setIsAddingServiceInConvenio(false);
    }
  };

  const handleDeleteServiceFromConvenio = async (relId: number) => {
    if (!confirm("Deseja remover este serviço deste convênio? Todas as atividades vinculadas serão excluídas.")) return;
    try {
      const { error } = await supabase
        .from('servico_convenio')
        .delete()
        .eq('id', relId);
      
      if (error) throw error;
      toast({ title: "Removido", description: "Serviço e atividades removidos do convênio." });
      fetchChecklists();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro", description: error.message });
    }
  };

  const fetchMetadata = async () => {
    try {
      const { data: units } = await supabase.from('unidade').select('id, nome');

      let sectorsQuery = supabase.from('setor').select('id, nome, unidade_id');

      // Apenas PMO vê todos os setores. Outros vêem apenas o seu designado.
      if (!rolePermissions.canViewAllSectors) {
        if (userSectorId) {
          sectorsQuery = sectorsQuery.eq('id', userSectorId);
        } else if (userUnitId) {
          sectorsQuery = sectorsQuery.eq('unidade_id', userUnitId);
        }
      }

      const { data: sectors } = await sectorsQuery.order('nome');

      setUnidades(units || []);
      setSetores(sectors || []);

      const userStr = localStorage.getItem("genesis_user");
      const user = userStr ? JSON.parse(userStr) : null;
      if (user?.setor_id) {
        if (!selectedSectorMain) setSelectedSectorMain(user.setor_id.toString());
      }
    } catch (error) {
      console.error("Erro ao buscar metadados:", error);
    }
  };

  const groupActivitiesByService = (servicosConvenio: any[], checklistConvenio: any[]) => {
    const groups: { [key: string]: { id: number | null, relId?: number, nome: string, atividades: any[] } } = {};

    // 1. Mostrar os serviços que já estão vinculados a este convênio (pela tabela servico_convenio)
    servicosConvenio.forEach(rel => {
      groups[rel.id.toString()] = {
        id: rel.id, // Usamos o ID da servico_convenio como identificador do grupo neste convênio
        relId: rel.id,
        nome: rel.nome,
        atividades: []
      };
    });

    // 2. Distribuir as atividades (pela tabela checklist_convenio usando servico_id que aponta para o ID de servico_convenio)
    checklistConvenio.forEach(sub => {
      const groupId = sub.servico_convenio_id?.toString();
      if (groupId && groups[groupId]) {
        groups[groupId].atividades.push(sub);
      }
    });

    return Object.values(groups);
  };

  useEffect(() => {
    fetchChecklists();
    fetchMetadata();
  }, [role, userSector, selectedSectorMain]);

  const handleDeleteItem = async (id: number, table: 'checklist' | 'servico' | 'convenio' | 'checklist_convenio') => {
    if (!confirm(`Deseja excluir este item de ${table}?`)) return;
    try {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      toast({ title: "Excluído", description: "Item removido com sucesso." });
      fetchChecklists();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro", description: error.message });
    }
  };

  const getSubtitle = () => {
    switch (role) {
      case "pmo": return "Gerenciar atividades e serviços de todos os setores";
      case "manager": return `Gerencie o setor ${userSector}`;
      default: return "Visualize suas atividades";
    }
  };

  const filteredItems = dbChecklists.filter(item => {
    const searchLower = searchQuery.toLowerCase();
    return item.titulo.toLowerCase().includes(searchLower);
  });

  const filteredServicos = dbServicos.filter(item => {
    const searchLower = searchQuery.toLowerCase();
    return item.nome.toLowerCase().includes(searchLower);
  });

  const filteredConvenios = dbConvenios.filter(item => {
    const searchLower = searchQuery.toLowerCase();
    return item.nome.toLowerCase().includes(searchLower);
  });

  return (
    <AppLayout title="Checklists" subtitle={getSubtitle()}>
      <div className="p-6">
        <div className={cn(
          "grid grid-cols-1 gap-8",
          rolePermissions.canViewAllSectors ? "lg:grid-cols-4" : "lg:grid-cols-1"
        )}>
          {/* Coluna de Setores - Só aparece se puder ver todos (PMO) */}
          {rolePermissions.canViewAllSectors && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary" />
                  Setores
                </h3>
                <Badge variant="secondary" className="font-bold">
                  {setores.length}
                </Badge>
              </div>

              <div className="flex flex-col gap-2">
                {setores.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
                    Carregando setores...
                  </div>
                ) : (
                  setores.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedSectorMain(s.id.toString())}
                      className={cn(
                        "group w-full text-left p-4 rounded-xl border-2 transition-all flex items-center justify-between",
                        selectedSectorMain === s.id.toString()
                          ? "border-primary bg-primary/5 text-primary shadow-sm"
                          : "border-transparent bg-card hover:bg-muted/50 text-muted-foreground"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          selectedSectorMain === s.id.toString() ? "bg-primary" : "bg-muted-foreground/30"
                        )} />
                        <span className="font-semibold text-sm truncate max-w-[150px]">{s.nome}</span>
                      </div>
                      <ChevronRight className={cn(
                        "w-4 h-4 transition-all",
                        selectedSectorMain === s.id.toString()
                          ? "translate-x-0 opacity-100"
                          : "translate-x-[-10px] opacity-0 group-hover:translate-x-0 group-hover:opacity-100"
                      )} />
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Coluna de Atividades/Checklists */}
          <div className={cn(
            "space-y-6",
            rolePermissions.canViewAllSectors ? "lg:col-span-3" : "lg:col-span-1"
          )}>
            {!selectedSectorMain ? (
              <Card className="h-[400px] flex flex-col items-center justify-center border-dashed border-2">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <ArrowRight className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-2">Selecione um Setor</h3>
                <p className="text-muted-foreground text-center max-w-xs">
                  Escolha um setor à esquerda para visualizar e gerenciar suas atividades e checklists.
                </p>
              </Card>
            ) : (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Header do Setor Selecionado e Cadastro Rápido */}
                <Card className="p-6 bg-gradient-to-br from-card to-muted/30">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
                    <div>
                      <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        {setores.find(s => s.id.toString() === selectedSectorMain)?.nome || "Setor"}
                      </h2>
                      <p className="text-muted-foreground">Gerenciamento de atividades e serviços</p>
                    </div>

                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="servicos" className="gap-2">
                          <Layers className="w-4 h-4" />
                          Serviços
                        </TabsTrigger>
                        <TabsTrigger value="convenios" className="gap-2">
                          <Handshake className="w-4 h-4" />
                          Convênios
                        </TabsTrigger>
                        
                      </TabsList>
                    </Tabs>
                  </div>

                  {(role === "manager" || role === "pmo") && (
                    <form onSubmit={handleQuickRegister} className="flex flex-col sm:flex-row items-end gap-3 p-4 bg-background/50 rounded-xl border border-border">
                      <div className="flex-1 w-full space-y-2">
                        <Label className="text-xs font-bold uppercase text-muted-foreground">
                          {activeTab === "servicos" ? "Novo Serviço" : activeTab === "convenios" ? "Novo Convênio" : "Nova Atividade Extra"}
                        </Label>
                        <Input
                          placeholder={activeTab === "servicos" ? "Ex: Serviço de Enfermagem..." : activeTab === "convenios" ? "Ex: Convênio Porto Seguro..." : "Ex: Verificação de carrinhos..."}
                          value={quickActivityTitle}
                          onChange={(e) => setQuickActivityTitle(e.target.value)}
                          className="bg-background"
                        />
                      </div>
                      <Button type="submit" disabled={isRegistering} className="w-full sm:w-auto bg-primary hover:bg-primary/90 gap-2 h-10 px-6">
                        {isRegistering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        Cadastrar
                      </Button>
                    </form>
                  )}
                </Card>

                {/* Filtro de Busca e Lista */}
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder={`Filtrar ${activeTab === "servicos" ? "serviços" : activeTab === "convenios" ? "convênios" : "atividades"} por título...`}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 h-11"
                    />
                  </div>

                  <div className="space-y-3">
                    {activeTab === "atividades" && (
                      filteredItems.length > 0 ? (
                        filteredItems.map((item) => (
                          <Card key={item.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-2 hover:border-primary/30 transition-all group">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                <FileText className="w-5 h-5" />
                              </div>
                              <div className="flex flex-col">
                                <span className="font-bold text-foreground group-hover:text-primary transition-colors">{item.titulo}</span>
                                <Badge variant="outline" className="text-[10px] w-fit mt-1 bg-muted/50">Atividade Geral</Badge>
                              </div>
                            </div>
                            {(role === "manager" || role === "pmo") && (
                              <Button size="sm" variant="ghost" onClick={() => handleDeleteItem(item.id, 'checklist')} className="h-9 w-9 p-0 text-destructive hover:bg-destructive/10 shrink-0">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </Card>
                        ))
                      ) : (
                        <NoItemsFound type="atividades" />
                      )
                    )}

                    {activeTab === "servicos" && (
                      filteredServicos.length > 0 ? (
                        <Accordion type="multiple" className="space-y-3" value={openServicos} onValueChange={setOpenServicos}>
                          {filteredServicos.map((item) => (
                            <AccordionItem key={item.id} value={item.id.toString()} className="border-2 rounded-xl overflow-hidden px-0">
                              <Card className="border-0 shadow-none relative">
                                <AccordionTrigger className="flex w-full items-center justify-between p-4 bg-muted/20 hover:no-underline hover:bg-muted/30 transition-colors border-none group">
                                  <div className="flex items-center gap-4 text-left">
                                    <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center text-secondary shrink-0">
                                      <Layers className="w-5 h-5" />
                                    </div>
                                    <div>
                                      <h4 className="font-bold text-foreground line-clamp-1">{item.nome}</h4>
                                      <Badge variant="outline" className="text-[10px] bg-background">Serviço</Badge>
                                    </div>
                                  </div>
                                </AccordionTrigger>

                                <div className="absolute right-12 top-1/2 -translate-y-1/2 z-10">
                                   {(role === "manager" || role === "pmo") && !openServicos.includes(item.id.toString()) && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleDeleteItem(item.id, 'servico');
                                      }}
                                      className="h-9 w-9 p-0 text-destructive hover:bg-destructive/10 rounded-full"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  )}
                                </div>

                                <AccordionContent className="p-4 bg-background">
                                  <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                      <h5 className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Atividades do Serviço</h5>
                                      <Badge variant="secondary" className="text-[10px]">{item.atividades?.length || 0} itens</Badge>
                                    </div>

                                    {item.atividades && item.atividades.length > 0 ? (
                                      <div className="grid gap-2">
                                        {item.atividades.map((sub: any) => (
                                          <div key={sub.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-transparent hover:border-border transition-all group/sub">
                                            <div className="flex items-center gap-3">
                                              <div className="w-1.5 h-1.5 rounded-full bg-secondary/40" />
                                              <span className="text-sm font-medium text-foreground/80">{sub.titulo}</span>
                                            </div>
                                            {(role === "manager" || role === "pmo") && (
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => handleDeleteItem(sub.id, 'checklist_convenio')}
                                                className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10 transition-all shrink-0"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </Button>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="text-center py-6 px-4 rounded-lg border border-dashed bg-muted/10">
                                        <p className="text-xs text-muted-foreground italic">Nenhuma atividade cadastrada para este serviço.</p>
                                      </div>
                                    )}

                                    {(role === "manager" || role === "pmo") && (
                                      <form
                                        onSubmit={(e) => {
                                          e.preventDefault();
                                          setSelectedServicoId(item.id);
                                          handleAddSubItem(e, 'servico');
                                        }}
                                        className="pt-4 flex gap-2"
                                      >
                                        <Input
                                          placeholder="Adicionar nova atividade..."
                                          className="h-9 text-sm bg-muted/20"
                                          value={selectedServicoId === item.id ? subItemTitle : ""}
                                          onChange={(e) => {
                                            setSelectedServicoId(item.id);
                                            setSubItemTitle(e.target.value);
                                          }}
                                        />
                                        <Button type="submit" size="sm" className="h-9 px-4 gap-2 shrink-0">
                                          <Plus className="w-4 h-4" /> Adicionar
                                        </Button>
                                      </form>
                                    )}
                                  </div>
                                </AccordionContent>
                              </Card>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      ) : (
                        <NoItemsFound type="servicos" />
                      )
                    )}

                    {activeTab === "convenios" && (
                      filteredConvenios.length > 0 ? (
                        <Accordion type="multiple" className="space-y-4" value={openConvenios} onValueChange={setOpenConvenios}>
                          {filteredConvenios.map((item) => {
                            const serviceGroups = groupActivitiesByService(item.servico_convenio || [], item.checklist_convenio || []);
                            
                            return (
                              <AccordionItem key={item.id} value={item.id.toString()} className="border-2 rounded-2xl overflow-hidden bg-card/50 shadow-sm transition-all hover:shadow-md border-muted/50">
                                <Card className="border-0 shadow-none relative bg-transparent">
                                  <AccordionTrigger className="flex w-full items-center justify-between p-5 bg-gradient-to-r from-muted/20 to-transparent hover:no-underline hover:from-muted/30 transition-all border-none group">
                                    <div className="flex items-center gap-5 text-left">
                                      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-data-[state=open]:bg-primary group-data-[state=open]:text-white transition-all shadow-inner">
                                        <Handshake className="w-6 h-6" />
                                      </div>
                                      <div>
                                        <h4 className="font-bold text-lg text-foreground line-clamp-1 tracking-tight">{item.nome}</h4>
                                        <Badge variant="outline" className="text-[10px] bg-background/50 backdrop-blur-sm px-2 py-0 border-primary/20 text-primary uppercase font-bold tracking-wider">Convênio</Badge>
                                      </div>
                                    </div>
                                  </AccordionTrigger>

                                  <div className="absolute right-14 top-1/2 -translate-y-1/2 z-10">
                                    {(role === "manager" || role === "pmo") && !openConvenios.includes(item.id.toString()) && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          handleDeleteItem(item.id, 'convenio');
                                        }}
                                        className="h-10 w-10 p-0 text-destructive hover:bg-destructive/10 rounded-xl transition-all"
                                      >
                                        <Trash2 className="w-5 h-5" />
                                      </Button>
                                    )}
                                  </div>

                                  <AccordionContent className="p-6 pt-2 bg-gradient-to-b from-transparent to-muted/5 space-y-6">
                                    {/* Lista de Serviços dentro do Convênio */}
                                    <div className="space-y-4">
                                      <div className="flex items-center justify-between px-1">
                                        <h5 className="text-xs font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                                          <Layers className="w-3 h-3" />
                                          Grupos de Serviços
                                        </h5>
                                        
                                      </div>

                                      <Accordion type="multiple" className="space-y-4" value={openNestedServicos} onValueChange={setOpenNestedServicos}>
                                        {serviceGroups.map((group) => (
                                          <AccordionItem 
                                            key={group.id?.toString() || 'general'} 
                                            value={`${item.id}-${group.id?.toString() || 'general'}`}
                                            className="border border-border/60 bg-background/60 backdrop-blur-sm rounded-xl overflow-hidden shadow-sm"
                                          >
                                            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/20 transition-all font-semibold text-sm text-foreground/80 first-letter:uppercase group/nest">
                                              <div className="flex items-center justify-between w-full pr-4">
                                                <div className="flex items-center gap-3">
                                                  <div className={cn(
                                                    "w-2 h-2 rounded-full",
                                                    group.id ? "bg-primary" : "bg-muted-foreground/40"
                                                  )} />
                                                  <span>{group.nome}</span>
                                                  <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-background font-normal ml-2 opacity-70">
                                                    {group.atividades.length} {group.atividades.length === 1 ? 'atividade' : 'atividades'}
                                                  </Badge>
                                                </div>
                                                
                                                {(role === "manager" || role === "pmo") && group.relId && (
                                                  <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={(e) => {
                                                      e.preventDefault();
                                                      e.stopPropagation();
                                                      handleDeleteServiceFromConvenio(group.relId!);
                                                    }}
                                                    className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10 rounded-full"
                                                  >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                  </Button>
                                                )}
                                              </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="p-4 bg-muted/5">
                                              <div className="space-y-3">
                                                {group.atividades.map((sub: any) => (
                                                  <div key={sub.id} className="flex items-center justify-between p-3 rounded-lg bg-card border border-border/50 hover:shadow-sm transition-all group/sub">
                                                    <div className="flex items-center gap-3">
                                                      <FileText className="w-3.5 h-3.5 text-muted-foreground/50" />
                                                      <span className="text-sm font-medium text-foreground/90">{sub.titulo}</span>
                                                    </div>
                                                    {(role === "manager" || role === "pmo") && (
                                                      <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => handleDeleteItem(sub.id, 'checklist_convenio')}
                                                        className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 transition-all opacity-0 group-hover/sub:opacity-100"
                                                      >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                      </Button>
                                                    )}
                                                  </div>
                                                ))}

                                                {(role === "manager" || role === "pmo") && (
                                                  <form
                                                    onSubmit={(e) => {
                                                      setSelectedConvenioId(item.id);
                                                      handleAddSubItem(e, 'convenio', group.id || undefined);
                                                    }}
                                                    className="pt-2 flex gap-2"
                                                  >
                                                    <Input
                                                      placeholder="Nova atividade..."
                                                      className="h-9 text-xs bg-background"
                                                      value={selectedConvenioId === item.id ? subItemTitle : ""}
                                                      onChange={(e) => {
                                                        setSelectedConvenioId(item.id);
                                                        setSubItemTitle(e.target.value);
                                                      }}
                                                    />
                                                    <Button type="submit" size="sm" className="h-9 px-3 gap-1.5 text-xs font-bold shrink-0">
                                                      <Plus className="w-3.5 h-3.5" /> Incluir
                                                    </Button>
                                                  </form>
                                                )}
                                              </div>
                                            </AccordionContent>
                                          </AccordionItem>
                                        ))}
                                      </Accordion>
                                    </div>

                                    {(role === "manager" || role === "pmo") && (
                                      <form
                                        onSubmit={(e) => {
                                          e.preventDefault();
                                          setSelectedConvenioId(item.id);
                                          handleCreateServiceInConvenio(e, item.id);
                                        }}
                                        className="pt-4 flex gap-2"
                                      >
                                        <div className="flex-1">
                                          <div className="flex gap-2">
                                            <Input
                                              placeholder="Nome do serviço (Enfermagem, Médico...)"
                                              className="h-10 text-sm bg-background border-primary/20"
                                              value={selectedConvenioId === item.id ? newServiceName : ""}
                                              onChange={(e) => {
                                                setSelectedConvenioId(item.id);
                                                setNewServiceName(e.target.value);
                                              }}
                                            />
                                            <Button 
                                              type="submit" 
                                              disabled={isAddingServiceInConvenio} 
                                              className="h-10 bg-primary hover:bg-primary/90 gap-2 px-6 shadow-sm"
                                            >
                                              {isAddingServiceInConvenio ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                              Adicionar Serviço
                                            </Button>
                                          </div>
                                        </div>
                                      </form>
                                    )}
                                  </AccordionContent>
                                </Card>
                              </AccordionItem>
                            );
                          })}
                        </Accordion>
                      ) : (
                        <NoItemsFound type="convenios" />
                      )
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function NoItemsFound({ type }: { type: string }) {
  return (
    <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-2xl bg-muted/20">
      {type === "atividades" ? (
        <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
      ) : type === "servicos" ? (
        <Layers className="w-12 h-12 mx-auto mb-4 opacity-20" />
      ) : (
        <Handshake className="w-12 h-12 mx-auto mb-4 opacity-20" />
      )}
      <p className="font-medium">Nenhum {type === "atividades" ? "item" : type === "servicos" ? "serviço" : "convênio"} encontrado.</p>
    </div>
  );
}
