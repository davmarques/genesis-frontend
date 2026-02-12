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
  ArrowRight
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";
import { useRole } from "@/contexts/RoleContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

export default function Checklists() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("atividades");
  const { role, rolePermissions, userSector, userSectorId, userUnitId } = useRole();
  const [dbChecklists, setDbChecklists] = useState<any[]>([]);
  const [dbConvenios, setDbConvenios] = useState<any[]>([]);
  const [unidades, setUnidades] = useState<any[]>([]);
  const [setores, setSetores] = useState<any[]>([]);

  // Novos estados para cadastro rápido
  const [quickActivityTitle, setQuickActivityTitle] = useState("");
  const [selectedSectorMain, setSelectedSectorMain] = useState<string>("");
  const [isRegistering, setIsRegistering] = useState(false);

  // Estados para Atividades do Convênio
  const [isAddingSubItem, setIsAddingSubItem] = useState(false);
  const [subItemTitle, setSubItemTitle] = useState("");
  const [selectedConvenioId, setSelectedConvenioId] = useState<number | null>(null);

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

      // 2. Busca Convênios (Tabela convenio)
      let conveniosQuery = supabase
        .from('convenio')
        .select('*, atividades:checklist_convenio!convenio_id(*)') // Especificando qual FK usar
        .order('created_at', { ascending: false });

      if (selectedSectorMain) {
        const sid = Number(selectedSectorMain);
        checklistsQuery = checklistsQuery.eq('setor_id', sid);
        conveniosQuery = conveniosQuery.eq('setor_id', sid);
      } else if (role !== 'pmo') {
        if (userSectorId) {
          const sid = Number(userSectorId);
          checklistsQuery = checklistsQuery.eq('setor_id', sid);
          conveniosQuery = conveniosQuery.eq('setor_id', sid);
        } else if (userUnitId) {
          const uid = Number(userUnitId);
          checklistsQuery = checklistsQuery.eq('unidade_id', uid);
          conveniosQuery = conveniosQuery.eq('unidade_id', uid);
        }
      }

      const [resChecklists, resConvenios] = await Promise.all([
        checklistsQuery,
        conveniosQuery
      ]);

      if (resChecklists.error) {
        console.error("Checklists error:", resChecklists.error);
        throw resChecklists.error;
      }
      if (resConvenios.error) {
        console.error("Convenios error:", resConvenios.error);
        throw resConvenios.error;
      }

      console.log("Checklists found:", resChecklists.data?.length);
      console.log("Convenios found:", resConvenios.data?.length);

      setDbChecklists(resChecklists.data || []);
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
      } else {
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

      toast({ title: "Sucesso!", description: activeTab === "convenios" ? "Convênio cadastrado (+100 pts)." : "Atividade cadastrada (+100 pts)." });
      setQuickActivityTitle("");
      fetchChecklists();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro", description: error.message });
    } finally {
      setIsRegistering(false);
    }
  };

  const handleAddSubItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subItemTitle.trim() || !selectedConvenioId) return;

    setIsAddingSubItem(true);
    try {
      const { error } = await supabase
        .from('checklist_convenio')
        .insert({
          titulo: subItemTitle,
          convenio_id: selectedConvenioId,
          setor_id: Number(selectedSectorMain),
          unidade_id: Number(userUnitId) || null
        });

      if (error) throw error;

      toast({ title: "Atividade adicionada", description: "Atividade vinculada ao convênio." });
      setSubItemTitle("");
      fetchChecklists();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro", description: error.message });
    } finally {
      setIsAddingSubItem(false);
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

  useEffect(() => {
    fetchChecklists();
    fetchMetadata();
  }, [role, userSector, selectedSectorMain]);

  const handleDeleteItem = async (id: number, table: 'checklist' | 'convenio' | 'checklist_convenio') => {
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
      case "pmo": return "Gerenciar atividades e convênios de todos os setores";
      case "manager": return `Gerencie o setor ${userSector}`;
      default: return "Visualize suas atividades";
    }
  };

  const filteredItems = dbChecklists.filter(item => {
    const searchLower = searchQuery.toLowerCase();
    return item.titulo.toLowerCase().includes(searchLower);
  });

  const filteredConvenios = dbConvenios.filter(item => {
    const searchLower = searchQuery.toLowerCase();
    return item.nome.toLowerCase().includes(searchLower);
  });

  return (
    <AppLayout title="Checklists" subtitle={getSubtitle()}>
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Coluna de Setores */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                {rolePermissions.canViewAllSectors ? "Setores" : "Meu Setor"}
              </h3>
              {rolePermissions.canViewAllSectors && (
                <Badge variant="secondary" className="font-bold">
                  {setores.length}
                </Badge>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {setores.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
                  {rolePermissions.canViewAllSectors ? "Carregando setores..." : "Setor não encontrado"}
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
                    {rolePermissions.canViewAllSectors && (
                      <ChevronRight className={cn(
                        "w-4 h-4 transition-all",
                        selectedSectorMain === s.id.toString()
                          ? "translate-x-0 opacity-100"
                          : "translate-x-[-10px] opacity-0 group-hover:translate-x-0 group-hover:opacity-100"
                      )} />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Coluna de Atividades/Checklists */}
          <div className="lg:col-span-3 space-y-6">
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
                      <p className="text-muted-foreground">Gerenciamento de atividades e convênios</p>
                    </div>

                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="atividades" className="gap-2">
                          <FileText className="w-4 h-4" />
                          Atividades
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
                          {activeTab === "atividades" ? "Nova Atividade" : "Novo Convênio"}
                        </Label>
                        <Input
                          placeholder={activeTab === "atividades" ? "Ex: Verificação de carrinhos de emergência..." : "Ex: Convênio Porto Seguro..."}
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
                      placeholder={`Filtrar ${activeTab === "atividades" ? "atividades" : "convênios"} por título...`}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 h-11"
                    />
                  </div>

                  <div className="space-y-3">
                    {activeTab === "atividades" ? (
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
                    ) : (
                      filteredConvenios.length > 0 ? (
                        <Accordion type="multiple" className="space-y-3">
                          {filteredConvenios.map((item) => (
                            <AccordionItem key={item.id} value={item.id.toString()} className="border-2 rounded-xl overflow-hidden px-0">
                              <Card className="border-0 shadow-none relative">
                                <AccordionTrigger className="flex w-full items-center justify-between p-4 bg-muted/20 hover:no-underline hover:bg-muted/30 transition-colors border-none group">
                                  <div className="flex items-center gap-4 text-left">
                                    <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center text-secondary shrink-0">
                                      <Handshake className="w-5 h-5" />
                                    </div>
                                    <div>
                                      <h4 className="font-bold text-foreground line-clamp-1">{item.nome}</h4>
                                      <Badge variant="outline" className="text-[10px] bg-background">Convênio</Badge>
                                    </div>
                                  </div>
                                </AccordionTrigger>

                                <div className="absolute right-12 top-1/2 -translate-y-1/2 z-10">
                                  {/* {(role === "manager" || role === "pmo") && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleDeleteItem(item.id, 'convenio');
                                      }}
                                      className="h-9 w-9 p-0 text-destructive hover:bg-destructive/10 rounded-full"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  )} */}
                                </div>

                                <AccordionContent className="p-4 bg-background">
                                  <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                      <h5 className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Itens do Checklist</h5>
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
                                        <p className="text-xs text-muted-foreground italic">Nenhuma atividade cadastrada para este convênio.</p>
                                      </div>
                                    )}

                                    {(role === "manager" || role === "pmo") && (
                                      <form
                                        onSubmit={(e) => {
                                          e.preventDefault();
                                          setSelectedConvenioId(item.id);
                                          handleAddSubItem(e);
                                        }}
                                        className="pt-4 flex gap-2"
                                      >
                                        <Input
                                          placeholder="Adicionar nova verificação..."
                                          className="h-9 text-sm bg-muted/20"
                                          value={selectedConvenioId === item.id ? subItemTitle : ""}
                                          onChange={(e) => {
                                            setSelectedConvenioId(item.id);
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
      {type === "atividades" ? <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" /> : <Handshake className="w-12 h-12 mx-auto mb-4 opacity-20" />}
      <p className="font-medium">Nenhum item encontrado.</p>
    </div>
  );
}
