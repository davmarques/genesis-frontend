import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Plus, CheckCircle2, Clock, AlertCircle, Star, Loader2, Send, FileText } from "lucide-react";
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
  servico?: {
    id: number;
    nome: string;
  };
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
  const navigate = useNavigate();

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
        .select('*, servico(id, nome)')
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
        dueDate: item.dueDate || item.created_at ? new Date(item.dueDate || item.created_at).toLocaleDateString('pt-BR') : 'Sem data',
        servico: item.servico
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
              {isLoading ? "Carregando..." : ""}
            </p>
          </div>
          {(role === "manager" || role === "pmo") && (
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                onClick={() => navigate("/checklists")}
                className="gap-2 bg-primary hover:bg-primary/90"
              >
                <Plus className="w-4 h-4" />
                Cadastrar
              </Button>
            </div>
          )}
        </div>
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
            {(role === "manager" || role === "pmo") && "Use o campo acima para cadastrar uma nova atividade."}
          </div>
        ) : (
          <Accordion type="single" collapsible className="space-y-3">
            {items.map((item) => (
              <AccordionItem
                key={item.id}
                value={item.id}
                className={cn(
                  "border rounded-lg bg-card transition-all",
                  item.status === "completed"
                    ? "bg-success/5 border-success/30"
                    : item.status === "overdue"
                      ? "bg-destructive/5 border-destructive/30"
                      : "border-border hover:border-primary/50"
                )}
              >
                <AccordionTrigger className="flex-1 py-4 px-4 hover:no-underline w-full">
                  <div className="flex flex-col items-start gap-1 text-left w-full">
                    <div className="flex items-center gap-2">
                      <h4 className={cn(
                        "font-semibold text-foreground",
                        item.status === "completed" && "line-through text-muted-foreground"
                      )}>
                        {item.title}
                      </h4>
                    </div>
                    {item.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1">{item.description}</p>
                    )}
                  </div>
                </AccordionTrigger>

                <AccordionContent className="pb-4 px-4 border-t border-dashed mt-0">
                  <div className="space-y-4 pt-4">
                    <div className="space-y-4">
                      <h5 className="text-sm font-bold flex items-center gap-2 text-primary/80">
                        <FileText className="w-4 h-4" />
                        Serviço(s) Vinculado(s)
                      </h5>
                      {item.servico ? (
                        <div className="p-3 bg-primary/5 border border-primary/10 rounded-lg flex items-center justify-between">
                          <span className="font-medium text-sm">{item.servico.nome}</span>
                        </div>
                      ) : (
                        <div className="p-3 bg-muted/20 border border-dashed rounded-lg text-sm text-muted-foreground italic text-center">
                          Nenhum serviço vinculado a esta atividade
                        </div>
                      )}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>
    </Card>
  );
};
