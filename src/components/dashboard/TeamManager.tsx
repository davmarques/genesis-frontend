import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus, Mail, MoreVertical, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useRole } from "@/contexts/RoleContext";
import { apiFetch } from "@/lib/api";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "pmo" | "manager" | "collaborator";
  status: "active" | "inactive";
  tasksCompleted: number;
  totalTasks: number;
  points: number;
  setor_id?: string;
}

export const TeamManager = () => {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { role, userSectorId } = useRole();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        setIsLoading(true);
        const data = await apiFetch("/admin/members");
        
        let sectorMembers = data || [];
        
        // Se não for PMO, filtrar pelo setor do usuário
        if (role !== 'pmo' && userSectorId) {
          sectorMembers = sectorMembers.filter((m: any) => 
            String(m.setor_id) === String(userSectorId)
          );
        }
        
        setMembers(sectorMembers);
      } catch (error) {
        console.error("Erro ao carregar membros do setor:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMembers();
  }, [userSectorId, role]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getCompletionRate = (completed: number, total: number) => {
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-foreground">Equipe do Setor</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {isLoading ? "Carregando..." : `${members.filter(m => m.status === "active").length} membros ativos`}
          </p>
        </div>
          
        <Button onClick={() => navigate("/teams")} className="gap-2 bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4" />
          Adicionar Membro
        </Button>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground italic">
            Nenhum membro encontrado para este setor.
          </div>
        ) : (
          members.map((member) => {
            const completionRate = getCompletionRate(member.tasksCompleted, member.totalTasks);
            
            return (
              <div
                key={member.id}
                className="p-4 rounded-lg border-2 border-border bg-card hover:border-primary/50 transition-all"
              >
                <div className="flex items-start gap-4">
                  <Avatar className="w-12 h-12 bg-gradient-to-br from-primary to-secondary">
                    <AvatarFallback className="bg-transparent text-primary-foreground font-semibold">
                      {getInitials(member.name)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-foreground truncate">{member.name}</h4>
                          
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="w-3 h-3" />
                          <span className="truncate">{member.email}</span>
                        </div>
                      </div>
                      {/* <Button variant="ghost" size="icon" className="flex-shrink-0">
                        <MoreVertical className="w-4 h-4" />
                      </Button> */}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
};

