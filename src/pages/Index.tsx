import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Users, Trophy, CheckCircle2, AlertTriangle, TrendingUp, Shield, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import logo from "../assets/images/genesis-logo.png";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-52 h-8 rounded-lg flex items-center justify-center">
              <img src={logo} alt="Gênesis Logo" />
            </div>
          </div>
          <Link to="/dashboard">
            <Button variant="default" className="bg-primary hover:bg-primary/90">
              Acessar Plataforma
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-secondary/5 to-background" />
        <div className="container mx-auto px-4 py-20 md:py-32 relative">
          <div className="max-w-4xl mx-auto text-center animate-fade-in">
            <Badge className="mb-4 bg-primary/10 text-primary hover:bg-primary/20 border-primary/20">
              Transformação Digital Hospitalar
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
              Excelência Operacional através da{" "}
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Gamificação
              </span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Digitalize, gerencie e gamifique os checklists hospitalares. Promova a cultura de auditoria interna e melhoria contínua com um sistema transparente de pontuação.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/dashboard">
                <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all">
                  Começar Agora
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="border-2 hover:bg-muted">
                Conhecer Funcionalidades
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Sistema Completo de Gestão
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Uma plataforma robusta com tudo que você precisa para transformar a gestão hospitalar
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <Card className="p-6 hover:shadow-lg transition-all border-2 bg-card">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <CheckCircle2 className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">Gestão de Checklists</h3>
              <p className="text-muted-foreground">
                Digitalize e estruture os checklists de cada setor com validação do PMO e acompanhamento em tempo real.
              </p>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-all border-2 bg-card">
              <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center mb-4">
                <Trophy className="w-6 h-6 text-secondary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">Sistema de Pontuação</h3>
              <p className="text-muted-foreground">
                Gamificação completa com pontos para atividades, auditorias e melhorias. Rankings transparentes por setor.
              </p>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-all border-2 bg-card">
              <div className="w-12 h-12 bg-warning/10 rounded-lg flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6 text-warning" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">Auditoria Interna</h3>
              <p className="text-muted-foreground">
                Sistema de notificação de erros entre setores com classificação de gravidade e pontos de auditoria.
              </p>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-all border-2 bg-card">
              <div className="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-success" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">Gestão de Equipes</h3>
              <p className="text-muted-foreground">
                Três perfis de acesso (PMO, Gestor, Colaborador) com funcionalidades específicas para cada papel.
              </p>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-all border-2 bg-card">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">Dashboard Analítico</h3>
              <p className="text-muted-foreground">
                Visualize indicadores, rankings e histórico de pontuações em tempo real com relatórios detalhados.
              </p>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-all border-2 bg-card">
              <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-secondary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">Melhoria Contínua</h3>
              <p className="text-muted-foreground">
                Pontos Vitais para adição de novas atividades e sistema de pendências para evolução constante dos processos.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Scoring System Preview */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Sistema de Pontuação Transparente
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Regras claras que promovem a excelência e a auditoria colaborativa
            </p>
          </div>

          <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-6">
            <Card className="p-6 border-2 border-success/30 bg-gradient-to-br from-success/5 to-card">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-success rounded-full flex items-center justify-center text-success-foreground font-bold text-lg flex-shrink-0">
                  +10
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-lg mb-1">Atividade Validada</h3>
                  <p className="text-sm text-muted-foreground">Conclusão de atividade do processo validada pelo PMO</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 border-2 border-gold/30 bg-gradient-to-br from-gold/5 to-card">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-gold rounded-full flex items-center justify-center text-gold-foreground font-bold text-lg flex-shrink-0">
                  +100
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-lg mb-1">Pontos Vitais</h3>
                  <p className="text-sm text-muted-foreground">Adição de nova atividade ao checklist (melhoria de processo)</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-card">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold text-lg flex-shrink-0">
                  +50
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-lg mb-1">Pontos de Auditoria</h3>
                  <p className="text-sm text-muted-foreground">Identificação e notificação de erro em outro setor</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 border-2 border-destructive/30 bg-gradient-to-br from-destructive/5 to-card">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-destructive rounded-full flex items-center justify-center text-destructive-foreground font-bold text-lg flex-shrink-0">
                  -50
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-lg mb-1">Notificação de Alerta</h3>
                  <p className="text-sm text-muted-foreground">Erro identificado que já estava no checklist</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* User Roles */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Perfis de Acesso Personalizados
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Cada usuário tem acesso às funcionalidades específicas do seu papel
            </p>
          </div>

          <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
            <Card className="p-6 text-center hover:shadow-xl transition-all border-2 bg-card">
              <div className="w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">PMO</h3>
              <p className="text-sm text-muted-foreground mb-4">Project Management Office</p>
              <ul className="text-sm text-left space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Validação de checklists e atividades</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Julgamento de disputas</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Gestão global do sistema</span>
                </li>
              </ul>
            </Card>

            <Card className="p-6 text-center hover:shadow-xl transition-all border-2 bg-card">
              <div className="w-16 h-16 bg-gradient-to-br from-secondary to-accent rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-secondary-foreground" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Gestor</h3>
              <p className="text-sm text-muted-foreground mb-4">Responsável do Setor</p>
              <ul className="text-sm text-left space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-secondary mt-0.5 flex-shrink-0" />
                  <span>Gestão do checklist do setor</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-secondary mt-0.5 flex-shrink-0" />
                  <span>Designação de colaboradores</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-secondary mt-0.5 flex-shrink-0" />
                  <span>Notificação de erros</span>
                </li>
              </ul>
            </Card>

            <Card className="p-6 text-center hover:shadow-xl transition-all border-2 bg-card">
              <div className="w-16 h-16 bg-gradient-to-br from-accent to-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <Activity className="w-8 h-8 text-accent-foreground" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Colaborador</h3>
              <p className="text-sm text-muted-foreground mb-4">Liderado</p>
              <ul className="text-sm text-left space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                  <span>Validação de atividades</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                  <span>Visualização do checklist</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                  <span>Execução de tarefas diárias</span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-secondary to-accent opacity-10" />
        <div className="container mx-auto px-4 text-center relative">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Pronto para Transformar seu Hospital?
          </h2>
          <p className="text-muted-foreground text-lg mb-8 max-w-2xl mx-auto">
            Implemente a excelência operacional com uma plataforma completa de gestão e gamificação
          </p>
          <Link to="/dashboard">
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl hover:shadow-2xl transition-all">
              Solicitar Demonstração
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 bg-card/50">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2024 Gênesis. Plataforma de Gestão Hospitalar e Gamificação.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
