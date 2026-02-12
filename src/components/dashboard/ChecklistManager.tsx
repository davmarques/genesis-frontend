import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, CheckCircle2, Clock, AlertCircle, Star, Loader2, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { useRole } from "@/contexts/RoleContext";
import { useToast } from "@/hooks/use-toast";

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  points: number;
  status: "pending" | "completed" | "overdue" | "in-progress";
  priority: "low" | "medium" | "high";
  assignedTo?: string;
  dueDate: string;
}

interface ChecklistManagerProps {
  role: "pmo" | "manager" | "collaborator";
}

export const ChecklistManager = ({ role: componentRole }: ChecklistManagerProps) => {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sectors, setSectors] = useState<any[]>([]);
  const [selectedSectorId, setSelectedSectorId] = useState<string | null>(null);
  const [newActivityTitle, setNewActivityTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { role, userSectorId, userUnitId } = useRole();
  const { toast } = useToast();

  // Inicializar o setor selecionado com o setor do usuário, se houver
  useEffect(() => {
    if (userSectorId) {
      setSelectedSectorId(userSectorId.toString());
    }
  }, [userSectorId]);

  const fetchSectors = async () => {
    try {
      // Tentar buscar do banco via Supabase
      let query = supabase.from('setor').select('id, nome');
      if (role !== 'pmo' && userUnitId) {
        query = query.eq('unidade_id', userUnitId);
      }
      const { data, error } = await query.order('nome');
      
      if (error) {
        console.error("Erro Supabase ao buscar setores:", error);
        // Fallback para apiFetch se disponível e erro de permissão
        const apiSectors = await apiFetch("/admin/sectors").catch(() => []);
        if (apiSectors && Array.isArray(apiSectors)) {
          setSectors(apiSectors.map((s: any) => ({ id: s.id, nome: s.nome || s.name })));
          return;
        }
        throw error;
      };

      setSectors(data || []);
      
      // Se tiver setores mas nenhum selecionado, e o usuário tiver um setor vinculado
      if (data && data.length > 0 && !selectedSectorId && userSectorId) {
        setSelectedSectorId(userSectorId.toString());
      }
    } catch (error) {
      console.error("Erro geral ao carregar setores:", error);
    }
  };

  const fetchChecklists = async () => {
    if (!selectedSectorId && role !== 'pmo') return;
    
    try {
      setIsLoading(true);
      let query = supabase
        .from('checklist')
        .select('*')
        .order('created_at', { ascending: false });

      if (selectedSectorId) {
        query = query.eq('setor_id', selectedSectorId);
      } else if (role !== 'pmo' && userSectorId) {
        query = query.eq('setor_id', userSectorId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const formatted = (data || []).map(item => ({
        id: item.id.toString(),
        title: item.title || item.titulo, // Suporte a ambos os nomes de coluna caso variem
        description: item.description || '',
        points: item.points || 0,
        status: (item.status === 'completed' ? 'completed' : 
                 item.status === 'overdue' ? 'overdue' : 'pending'),
        priority: item.priority || 'medium',
        dueDate: item.dueDate || item.created_at ? new Date(item.dueDate || item.created_at).toLocaleDateString('pt-BR') : 'Sem data'
      }));

      setItems(formatted as ChecklistItem[]);
    } catch (error) {
      console.error("Erro ao carregar checklists:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSectors();
  }, []);

  useEffect(() => {
    fetchChecklists();
  }, [selectedSectorId, role, userSectorId]);

  const handleAddActivity = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newActivityTitle.trim() || !selectedSectorId) {
      toast({
        title: "Aviso",
        description: "Digite o título da atividade e selecione um setor.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('checklist')
        .insert({
          title: newActivityTitle,
          titulo: newActivityTitle, // Inserindo em ambos para garantir
          setor_id: selectedSectorId ? Number(selectedSectorId) : null,
          status: 'pending',
          points: 100, // Pontuação padrão para novas atividades "Pontos Vitais"
          priority: 'medium'
        })
        .select();

      if (error) throw error;

      // Registrar ganho de pontos por melhoria proativa
      await supabase.from('notificacoes').insert({
        setor_id: Number(selectedSectorId),
        unidade_id: Number(userUnitId) || null,
        description: `Melhoria proativa: Inclusão de "${newActivityTitle}" no checklist.`,
        status: 'accepted',
        nao_no_checklist: true,
        created_at: new Date().toISOString()
      });

      toast({
        title: "Sucesso (+100 pts)",
        description: "Atividade cadastrada e pontos creditados!",
      });
      
      setNewActivityTitle("");
      fetchChecklists();
    } catch (error: any) {
      toast({
        title: "Erro ao cadastrar",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleItem = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "completed" ? "pending" : "completed";
    
    try {
      const { error } = await supabase
        .from('checklist')
        .update({ status: newStatus })
        .eq('id', id);
      
      if (error) throw error;
      
      setItems(items.map(item => 
        item.id === id 
          ? { ...item, status: newStatus as any }
          : item
      ));
    } catch (error) {
      console.error("Erro ao atualizar status do checklist:", error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="w-5 h-5 text-success" />;
      case "overdue": return <AlertCircle className="w-5 h-5 text-destructive" />;
      default: return <Clock className="w-5 h-5 text-warning" />;
    }
  };

  const getPriorityBadge = (priority: string) => {
    const colors = {
      high: "bg-destructive/10 text-destructive border-destructive/30",
      medium: "bg-warning/10 text-warning border-warning/30",
      low: "bg-success/10 text-success border-success/30",
    };
    return colors[priority as keyof typeof colors] || colors.medium;
  };

  return (
    <Card className="p-6">
      <div className="flex flex-col gap-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-foreground">
              {role === "collaborator" ? "Minhas Atividades" : "Checklist do Setor"}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {isLoading ? "Carregando..." : `${items.filter(i => i.status === "pending").length} atividades pendentes`}
            </p>
          </div>

          <div className="w-full md:w-64">
            <Select 
              value={selectedSectorId || ""} 
              onValueChange={setSelectedSectorId}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder={sectors.length === 0 ? "Carregando setores..." : "Selecionar Setor"} />
              </SelectTrigger>
              <SelectContent>
                {sectors.length === 0 ? (
                  <SelectItem value="none" disabled>Nenhum setor encontrado</SelectItem>
                ) : (
                  sectors.map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      {s.nome}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        {(role === "manager" || role === "pmo") && (
          <form onSubmit={handleAddActivity} className="flex gap-2">
            <Input 
              placeholder="Cadastrar nova atividade do setor..." 
              value={newActivityTitle}
              onChange={(e) => setNewActivityTitle(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" disabled={isSubmitting} className="gap-2 bg-primary hover:bg-primary/90">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Cadastrar
            </Button>
          </form>
        )}
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground italic">
            Nenhuma atividade encontrada para {selectedSectorId ? `o setor ${sectors.find(s => s.id.toString() === selectedSectorId)?.nome}` : "este setor"}.
            <br />
            { (role === "manager" || role === "pmo") && "Use o campo acima para cadastrar uma nova atividade."}
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className={cn(
                "p-4 rounded-lg border-2 transition-all",
                item.status === "completed" 
                  ? "bg-success/5 border-success/30" 
                  : item.status === "overdue"
                  ? "bg-destructive/5 border-destructive/30"
                  : "bg-card border-border hover:border-primary/50"
              )}
            >
              <div className="flex items-start gap-4">
                <div className="pt-1">
                  <Checkbox
                    checked={item.status === "completed"}
                    onCheckedChange={() => toggleItem(item.id, item.status)}
                    className="border-2"
                  />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1">
                      <h4 className={cn(
                        "font-semibold text-foreground mb-1",
                        item.status === "completed" && "line-through text-muted-foreground"
                      )}>
                        {item.title}
                      </h4>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {item.points === 100 && (
                        <Star className="w-4 h-4 text-gold fill-gold" />
                      )}
                      <Badge className="bg-primary/10 text-primary border-primary/30 font-bold">
                        +{item.points}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(item.status)}
                      <span className="text-xs text-muted-foreground">{item.dueDate}</span>
                    </div>
                    
                    <Badge variant="outline" className={getPriorityBadge(item.priority)}>
                      {item.priority === "high" ? "Alta" : item.priority === "medium" ? "Média" : "Baixa"}
                    </Badge>

                    {item.assignedTo && (
                      <span className="text-xs text-muted-foreground">
                        Responsável: {item.assignedTo}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-border">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total de pontos possíveis:</span>
          <span className="text-xl font-bold text-foreground">
            {items.reduce((acc, item) => acc + item.points, 0)} pontos
          </span>
        </div>
      </div>
    </Card>
  );
};
