import { Package, BarChart3, Shield, ArrowRight, Warehouse, History, Pill } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const benefits = [
  {
    icon: Pill,
    title: "Controle de Medicamentos",
    desc: "Gerencie medicamentos e produtos farmacêuticos em tempo real com precisão absoluta.",
  },
  {
    icon: Warehouse,
    title: "Múltiplas Filiais",
    desc: "Controle o estoque de cada farmácia separadamente com visão centralizada.",
  },
  {
    icon: History,
    title: "Histórico Completo",
    desc: "Rastreie todas as movimentações com data, usuário e tipo de operação.",
  },
  {
    icon: BarChart3,
    title: "Dashboard Inteligente",
    desc: "Visualize o panorama completo do seu estoque farmacêutico em um único painel.",
  },
  {
    icon: Shield,
    title: "Segurança & Controle",
    desc: "Acesso por função: admin vê tudo, filial vê apenas seus dados.",
  },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <Pill className="h-7 w-7 text-primary" />
          <span className="text-xl font-bold text-foreground">
            Lab<span className="text-secondary">GO</span>
          </span>
        </div>
        <Button onClick={() => navigate("/login")} variant="outline" size="sm">
          Entrar
        </Button>
      </nav>

      {/* Hero */}
      <section className="gradient-hero text-primary-foreground py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight mb-6 animate-fade-in">
            Controle total do seu
            <br />
            <span className="text-secondary">estoque farmacêutico</span>
          </h1>
          <p className="text-lg md:text-xl opacity-80 mb-10 max-w-2xl mx-auto animate-fade-in" style={{ animationDelay: "0.1s" }}>
            Gerencie medicamentos, organize suas filiais e tenha histórico completo de cada movimentação. Simples, rápido e seguro.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <Button
              size="lg"
              className="bg-secondary text-secondary-foreground hover:bg-secondary/90 text-base px-8"
              onClick={() => navigate("/login")}
            >
              Começar agora <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 text-base px-8"
              asChild
            >
              <a
                href="https://wa.me/5511999999999?text=Olá! Gostaria de saber mais sobre o LabGO."
                target="_blank"
                rel="noopener noreferrer"
              >
                Falar no WhatsApp
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">
            Por que escolher o <span className="text-gradient">LabGO</span>?
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-xl mx-auto">
            Tudo que você precisa para gerenciar o estoque da sua farmácia.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {benefits.map((b, i) => (
              <div
                key={b.title}
                className="gradient-card rounded-xl p-6 border shadow-sm hover:shadow-md transition-shadow animate-fade-in"
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                <div className="h-12 w-12 rounded-lg bg-accent flex items-center justify-center mb-4">
                  <b.icon className="h-6 w-6 text-accent-foreground" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{b.title}</h3>
                <p className="text-muted-foreground text-sm">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="gradient-primary text-primary-foreground py-16 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Pronto para organizar sua farmácia?</h2>
          <p className="opacity-80 mb-8">Crie sua conta gratuita e comece a controlar seus medicamentos agora mesmo.</p>
          <Button
            size="lg"
            className="bg-secondary text-secondary-foreground hover:bg-secondary/90 px-10"
            onClick={() => navigate("/login")}
          >
            Solicitar Acesso <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 text-center text-muted-foreground text-sm">
        © {new Date().getFullYear()} LabGO. Todos os direitos reservados.
      </footer>
    </div>
  );
}
