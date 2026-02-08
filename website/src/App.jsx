import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import './index.css'

const CURRENT_YEAR = new Date().getFullYear()

// Icons as SVG components
const Icons = {
  ArrowRight: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"></line>
      <polyline points="12 5 19 12 12 19"></polyline>
    </svg>
  ),
  Calendar: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
      <line x1="16" y1="2" x2="16" y2="6"></line>
      <line x1="8" y1="2" x2="8" y2="6"></line>
      <line x1="3" y1="10" x2="21" y2="10"></line>
    </svg>
  ),
  Users: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
      <circle cx="9" cy="7" r="4"></circle>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
    </svg>
  ),
  MessageCircle: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
    </svg>
  ),
  Clock: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <polyline points="12 6 12 12 16 14"></polyline>
    </svg>
  ),
  Bell: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
    </svg>
  ),
  CreditCard: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
      <line x1="1" y1="10" x2="23" y2="10"></line>
    </svg>
  ),
  TrendingDown: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline>
      <polyline points="17 18 23 18 23 12"></polyline>
    </svg>
  ),
  Heart: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
    </svg>
  ),
  Stethoscope: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"></path>
      <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"></path>
      <circle cx="20" cy="10" r="2"></circle>
    </svg>
  ),
  Sparkles: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path>
      <path d="M5 3v4"></path>
      <path d="M19 17v4"></path>
      <path d="M3 5h4"></path>
      <path d="M17 19h4"></path>
    </svg>
  ),
}

// Navigation Component
function Navigation() {
  return (
    <nav className="nav">
      <div className="container">
        <div className="nav-inner">
          <a href="#top" className="nav-logo logo-font">gendei</a>
          <div className="nav-links">
            <a href="#clinicas" className="nav-link">Agendamento IA</a>
            <a href="#dominios" className="nav-link">Domínios</a>
            <a href="#como-funciona" className="nav-link">Como funciona</a>
            <a href="#app" className="nav-link">App</a>
            <a href="#preco" className="nav-link">Preço</a>
          </div>
          <div className="nav-cta">
            <a href="https://go.gendei.app/pt-BR/signin" className="nav-link">
              Entrar
            </a>
            <a href="https://go.gendei.app/pt-BR/signup" className="btn btn-primary">
              COMEÇAR AGORA
            </a>
          </div>
        </div>
      </div>
    </nav>
  )
}

// iPhone Mockup Component with WhatsApp Scheduling Chat
function IPhoneMockup() {
  const chatRef = useRef(null)
  const [animationKey, setAnimationKey] = useState(0)

  const messageDelays = [500, 1500, 2500, 4000, 5000, 6500, 7500, 9000, 10500]
  const totalAnimationTime = 14000

  useEffect(() => {
    const scrollTimers = messageDelays.slice(4).map((delay) => {
      return setTimeout(() => {
        if (chatRef.current) {
          chatRef.current.scrollTo({
            top: chatRef.current.scrollHeight,
            behavior: 'smooth'
          })
        }
      }, delay + 300)
    })

    return () => scrollTimers.forEach(timer => clearTimeout(timer))
  }, [animationKey])

  useEffect(() => {
    const loopTimer = setTimeout(() => {
      if (chatRef.current) {
        chatRef.current.scrollTo({ top: 0, behavior: 'auto' })
      }
      setAnimationKey(prev => prev + 1)
    }, totalAnimationTime)

    return () => clearTimeout(loopTimer)
  }, [animationKey])

  return (
    <div className="iphone-mockup">
      <div className="iphone-frame">
        <div className="iphone-dynamic-island"></div>
        <div className="iphone-screen">
          <div className="wa-chat" ref={chatRef} key={animationKey}>
            {/* Patient message */}
            <div className="wa-message wa-message-user">
              <div className="wa-bubble wa-bubble-user">
                <p>Olá, gostaria de agendar uma consulta com a Dra. Ana</p>
              </div>
            </div>

            {/* AI response */}
            <div className="wa-message wa-message-ai">
              <div className="wa-bubble wa-bubble-ai">
                <p>Olá! Sou o assistente virtual da Clínica Dermato. Vou ajudar você a agendar com a Dra. Ana!</p>
              </div>
            </div>

            {/* Time slots */}
            <div className="wa-message wa-message-ai">
              <div className="wa-slots-card">
                <div className="wa-slots-header">
                  <span>Horários disponíveis</span>
                </div>
                <div className="wa-slots-list">
                  <div className="wa-slot">Seg 13/01 - 09:00</div>
                  <div className="wa-slot">Seg 13/01 - 10:30</div>
                  <div className="wa-slot wa-slot-selected">Ter 14/01 - 14:00</div>
                  <div className="wa-slot">Qua 15/01 - 11:00</div>
                </div>
              </div>
            </div>

            {/* Patient selects */}
            <div className="wa-message wa-message-user">
              <div className="wa-bubble wa-bubble-user">
                <p>Quero terça às 14h. Dermatologia, Unimed.</p>
              </div>
            </div>

            {/* AI confirms and requests payment */}
            <div className="wa-message wa-message-ai">
              <div className="wa-bubble wa-bubble-ai">
                <p>Ótimo! Para confirmar, preciso de um sinal via PIX (geralmente 10-15% do valor da consulta).</p>
              </div>
            </div>

            {/* PIX Card */}
            <div className="wa-message wa-message-ai">
              <div className="wa-pix-card">
                <div className="wa-pix-header">
                  <span>PIX - Sinal</span>
                  <span className="wa-pix-id">#c7d3e1</span>
                </div>
                <div className="wa-pix-product">Consulta Dra. Ana</div>
                <div className="wa-pix-total">
                  <span>Sinal (15%)</span>
                  <span>R$ 30,00</span>
                </div>
                <div className="wa-pix-button">Copiar código PIX</div>
              </div>
            </div>

            {/* AI confirmation */}
            <div className="wa-message wa-message-ai">
              <div className="wa-bubble wa-bubble-ai">
                <p>Pagamento confirmado! Consulta agendada: Ter 14/01 às 14h com Dra. Ana (Dermatologia).</p>
              </div>
            </div>

            {/* Reminder simulation */}
            <div className="wa-message wa-message-ai">
              <div className="wa-reminder-card">
                <div className="wa-reminder-icon">&#128276;</div>
                <div className="wa-reminder-text">
                  <strong>Lembrete</strong>
                  <p>Sua consulta é amanhã às 14h. Confirme ou reagende por aqui.</p>
                </div>
                <div className="wa-reminder-buttons">
                  <span className="wa-btn-confirm">Confirmo</span>
                  <span className="wa-btn-cancel">Remarcar</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Hero Section
function HeroSection() {
  return (
    <section className="hero">
      <div className="container">
        <div className="hero-inner">
          <div className="hero-content">
            <h1 className="hero-title">
              <span className="hero-title-sans">Reduza no-show de 20% para 5% e recupere receita perdida com WhatsApp</span>
            </h1>
            <p className="hero-subtitle">
              A Gendei automatiza o agendamento no WhatsApp, confirma presença com cobrança de sinal via PIX e reduz faltas com lembretes inteligentes.
            </p>
            <div className="hero-features">
              <div className="hero-feature">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <path d="m9 11 3 3L22 4"></path>
                </svg>
                <span>Confirmação com sinal via PIX</span>
              </div>
              <div className="hero-feature">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <path d="m9 11 3 3L22 4"></path>
                </svg>
                <span>Lembretes automáticos</span>
              </div>
              <div className="hero-feature">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <path d="m9 11 3 3L22 4"></path>
                </svg>
                <span>Fluxo natural para o paciente</span>
              </div>
            </div>
            <a href="https://go.gendei.app/pt-BR/signup" className="btn btn-primary btn-lg">
              Começar Agora
              <Icons.ArrowRight />
            </a>
          </div>
          <div className="hero-visual">
            <IPhoneMockup />
          </div>
        </div>
      </div>
    </section>
  )
}

// How the Agent Works Section - Expandable Cards
function ClinicsSection() {
  const steps = [
    {
      id: 'agendamento',
      title: 'Agendamento em menos de 2 minutos',
      description: 'O paciente agenda direto no WhatsApp, escolhe especialidade, profissional, data e horário em poucos passos. Tudo sem tirar a equipe da recepção para tarefas operacionais.',
      icon: <Icons.MessageCircle />,
      image: '/agendamento.png',
    },
    {
      id: 'pagamento',
      title: 'Sinal via PIX no WhatsApp que elimina no-show',
      description: 'Após escolher o horário, o paciente recebe a cobrança de sinal via PIX no próprio WhatsApp. A confirmação é automática e gera mais compromisso com o comparecimento.',
      icon: <Icons.CreditCard />,
      image: '/pagamento.png',
    },
    {
      id: 'lembretes',
      title: 'Lembretes automáticos inteligentes',
      description: 'A plataforma envia lembretes 24h e 2h antes da consulta. O paciente confirma ou solicita remarcação pelo chat, e a clínica mantém controle completo no painel.',
      icon: <Icons.Bell />,
      image: '/lembretes.png',
    },
  ]

  return (
    <section id="clinicas" className="section section-alt">
      <div className="container">
        <div className="section-header">
          <span className="section-number">01</span>
          <h2 className="section-title">
            <span className="section-title-sans">como o Agente de IA atende no WhatsApp</span>
          </h2>
          <p className="section-subtitle section-subtitle-large">
            Um fluxo guiado no WhatsApp conduz toda a jornada: triagem inicial, escolha de horários, confirmação de sinal e lembretes. A clínica ganha previsibilidade sem aumentar o time.
          </p>
        </div>
        <div className="flow-grid">
          {steps.map((step) => (
            <article key={step.id} className="flow-card">
              <div className="flow-card-image">
                {step.image ? (
                  <img src={step.image} alt={step.title} />
                ) : (
                  <div className="flow-card-placeholder">
                    {step.icon}
                  </div>
                )}
              </div>
              <div className="flow-card-content">
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function DomainsSection() {
  const domains = [
    {
      id: 'med',
      icon: <Icons.Stethoscope />,
      title: 'Clínica Médica',
      subtitle: 'Consultas e retorno com múltiplos profissionais',
    },
    {
      id: 'dental',
      icon: <Icons.Sparkles />,
      title: 'Odontologia',
      subtitle: 'Agenda por procedimento, triagem e confirmações',
    },
    {
      id: 'psi',
      icon: <Icons.Heart />,
      title: 'Psicologia',
      subtitle: 'Sessões recorrentes com gestão de remarcações',
    },
    {
      id: 'nutri',
      icon: <Icons.Users />,
      title: 'Nutrição',
      subtitle: 'Acompanhamento contínuo e lembretes inteligentes',
    },
    {
      id: 'fisio',
      icon: <Icons.Clock />,
      title: 'Fisioterapia',
      subtitle: 'Agenda por sessão e controle de comparecimento',
    },
    {
      id: 'multi',
      icon: <Icons.Calendar />,
      title: 'Clínicas Multiespecialidade',
      subtitle: 'Múltiplas agendas e profissionais no mesmo fluxo',
    },
  ]

  return (
    <section id="dominios" className="section">
      <div className="container">
        <div className="section-header">
          <span className="section-number">02</span>
          <h2 className="section-title">
            <span className="section-title-sans">domínios e verticais atendidos</span>
          </h2>
          <p className="section-subtitle section-subtitle-large">
            A plataforma é configurável por vertical e atende operações com agenda real, confirmação de presença e redução consistente de faltas.
          </p>
        </div>
        <div className="domains-grid">
          {domains.map((domain) => (
            <article key={domain.id} className="domain-card">
              <div className="domain-icon">{domain.icon}</div>
              <h3>{domain.title}</h3>
              <p>{domain.subtitle}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

// How It Works Section
function HowSection() {
  const [activeStep, setActiveStep] = useState(0)

  const steps = [
    {
      number: '1',
      title: 'Configure clínica, serviços e especialidades',
    },
    {
      number: '2',
      title: 'Adicione profissionais e horários',
    },
    {
      number: '3',
      title: 'Conecte o WhatsApp da clínica',
    },
    {
      number: '4',
      title: 'Ative o agente e acompanhe no painel',
    },
  ]

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % steps.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [steps.length])

  return (
    <section id="como-funciona" className="section">
      <div className="container">
        <div className="section-header">
          <span className="section-number">03</span>
          <h2 className="section-title">
            <span className="section-title-sans">comece a agendar em 10 minutos</span>
          </h2>
          <p className="section-subtitle">
            Onboarding simples, sem projeto longo de implantação.
          </p>
        </div>
        <div className="how-steps">
          {steps.map((step, index) => (
            <div key={index} className={`how-step ${activeStep === index ? 'active' : ''}`}>
              <div className="how-step-number-wrapper">
                <div className="how-step-number">{step.number}</div>
                <div className="how-step-spinner"></div>
              </div>
              <h3>{step.title}</h3>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// App Screenshots Section
function AppScreenshotsSection() {
  const [activeTab, setActiveTab] = useState(0)

  const tabs = [
    {
      id: 'agenda',
      label: 'Agenda',
      image: '/agenda.png',
      description:
        'Visualize agendamentos por dia, semana ou mês. Acompanhe confirmações e comparecimento com visão clara da operação.',
      features: ['Calendário visual', 'Confirmações em tempo real', 'Comparecimento por profissional'],
    },
    {
      id: 'conversas',
      label: 'Conversas',
      image: '/conversas.png',
      description:
        'Acompanhe conversas com pacientes, assuma o atendimento quando necessário e não perca oportunidades de confirmação.',
      features: ['Histórico completo', 'Atendimento humano quando necessário', 'Alertas de follow-up'],
    },
    {
      id: 'pacientes',
      label: 'Pacientes',
      image: '/pacientes.png',
      description:
        'Base de pacientes com histórico, contato e convênio para facilitar reagendamentos e melhorar a experiência de atendimento.',
      features: ['Cadastro automático', 'Histórico de consultas', 'Contato e convênio'],
    },
    {
      id: 'relatorios',
      label: 'Relatórios',
      image: '/relatorios.png',
      description:
        'Métricas essenciais: no-show por profissional, taxa de comparecimento e evolução operacional para decisões baseadas em dados.',
      features: ['No-show por profissional', 'Taxa de comparecimento', 'Economia gerada'],
    },
  ]

  return (
    <section id="app" className="app-screenshots-section">
      <div className="container">
        <div className="section-header">
          <span className="section-number">04</span>
          <h2 className="section-title">
            <span className="section-title-sans">o app em ação:</span>
          </h2>
          <p className="section-subtitle">
            Tudo que sua equipe precisa para operar com controle e velocidade.
          </p>
        </div>

        <div className="app-tabs-nav">
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              className={`app-tab-btn ${activeTab === index ? 'active' : ''}`}
              onClick={() => setActiveTab(index)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="app-tab-content-wrapper">
          {tabs.map((tab, index) => (
            <div
              key={tab.id}
              className={`app-tab-content ${activeTab === index ? 'active' : ''}`}
            >
              <div className="app-screenshot-display">
                {tab.image ? (
                  <img src={tab.image} alt={tab.label} />
                ) : (
                  <div className="app-screenshot-placeholder">
                    <span>{tab.label}</span>
                  </div>
                )}
              </div>

              <div className="app-tab-description">
                <p>{tab.description}</p>
                <div className="app-tab-features">
                  {tab.features.map((feature, i) => (
                    <div key={i} className="app-tab-feature">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                      {feature}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// Benefits Section
function BenefitsSection() {
  const benefits = [
    {
      icon: <Icons.TrendingDown />,
      title: 'Recupere receita perdida',
      description: 'Sinal via PIX e lembretes reduzem faltas e recuperam receita que seria perdida com horários vagos.',
    },
    {
      icon: <Icons.Clock />,
      title: 'Atendimento mais rápido no WhatsApp',
      description: 'Respostas rápidas com jornada de agendamento clara para o paciente.',
    },
    {
      icon: <Icons.CreditCard />,
      title: 'Sinal Automático via PIX',
      description: 'Cobrança de sinal via PIX no WhatsApp para confirmar o agendamento sem processo manual.',
    },
    {
      icon: <Icons.Bell />,
      title: 'Lembretes Inteligentes',
      description: 'Lembretes 24h e 2h antes da consulta, com confirmação ou remarcação pelo próprio chat.',
    },
    {
      icon: <Icons.Users />,
      title: 'Menos caos na recepção',
      description: 'A equipe foca no atendimento presencial enquanto o fluxo digital resolve a parte repetitiva.',
    },
    {
      icon: <Icons.Sparkles />,
      title: 'Conversas Naturais',
      description: 'A interação respeita contexto da conversa e conduz o paciente até a confirmação.',
    },
  ]

  return (
    <section className="section">
      <div className="container">
        <div className="section-header">
          <span className="section-number">05</span>
          <h2 className="section-title">
            <span className="section-title-sans">por que clínicas escolhem Gendei</span>
          </h2>
        </div>
        <div className="benefits-grid">
          {benefits.map((benefit, index) => (
            <div key={index} className="benefit-card">
              <div className="benefit-icon">
                {benefit.icon}
              </div>
              <h3>{benefit.title}</h3>
              <p>{benefit.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// Stats Section
function StatsSection() {
  const stats = [
    { value: '24/7', label: 'atendimento no WhatsApp' },
    { value: '2h + 24h', label: 'lembretes automáticos' },
    { value: 'PIX', label: 'confirmação com sinal' },
    { value: '1 painel', label: 'controle da operação' },
  ]

  return (
    <section className="stats-section">
      <div className="container">
        <div className="stats-grid">
          {stats.map((stat, index) => (
            <div key={index} className="stat-item">
              <div className="stat-value">{stat.value}</div>
              <div className="stat-label">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// Pricing Section
function PricingSection() {
  const features = [
    'Agente de IA disponível 24/7 no WhatsApp',
    'Agendamento guiado com seleção de horários',
    'Cobrança automática de sinal via PIX',
    'Lembretes 24h e 2h antes da consulta',
    'Reagendamento e cancelamento pelo chat',
    'Painel completo com agenda e relatórios',
    'Fallback para atendimento humano quando necessário',
    'Suporte dedicado para sua clínica',
  ]

  return (
    <section id="preco" className="pricing-section">
      <div className="container">
        <div className="section-header">
          <span className="section-number">06</span>
          <h2 className="section-title">
            <span className="section-title-sans">preço simples para operação profissional</span>
          </h2>
          <p className="section-subtitle section-subtitle-large">
            Valor mensal fixo para padronizar o atendimento via WhatsApp, reduzir no-show e escalar agendamentos sem aumentar custo operacional da recepção.
          </p>
        </div>

        <div className="pricing-comparison-glass">
          <div className="pricing-card-glass pricing-card-zapcomm">
            <div className="pricing-card-glass-header">
              <div className="pricing-zapcomm-logo logo-font">gendei</div>
              <div className="pricing-rate-box">
                <span className="pricing-rate-value">R$ 2.000</span>
                <span className="pricing-rate-label">por mês</span>
              </div>
            </div>

            <p className="pricing-explanation">
              Um plano direto: sem cobrança por mensagem e sem taxa por agendamento. Previsibilidade para clínicas que querem operar com processo, não improviso.
            </p>

            <ul className="pricing-features-glass">
              {features.map((feature, index) => (
                <li key={index}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pricing-check-icon">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <path d="m9 11 3 3L22 4"></path>
                  </svg>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '48px' }}>
          <a href="https://go.gendei.app/pt-BR/signup" className="btn btn-primary btn-lg">
            Começar Agora
            <Icons.ArrowRight />
          </a>
        </div>
      </div>
    </section>
  )
}

// Footer
function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-inner">
          <div className="footer-brand">
            <a href="#top" className="nav-logo logo-font">gendei</a>
            <p>Agendamento inteligente via WhatsApp para clínicas que querem reduzir no-show e aumentar eficiência operacional.</p>
          </div>
          <div className="footer-column">
            <h4>Produto</h4>
            <ul>
              <li><a href="#clinicas">Agendamento IA</a></li>
              <li><a href="#dominios">Domínios</a></li>
              <li><a href="#como-funciona">Configuração</a></li>
              <li><a href="#app">App</a></li>
              <li><a href="#preco">Preço</a></li>
            </ul>
          </div>
          <div className="footer-column">
            <h4>Acesso</h4>
            <ul>
              <li><a href="https://go.gendei.app/pt-BR/signin">Entrar</a></li>
              <li><a href="https://go.gendei.app/pt-BR/signup">Criar conta</a></li>
            </ul>
          </div>
          <div className="footer-column">
            <h4>Legal</h4>
            <ul>
              <li><Link to="/terms">Termos de uso</Link></li>
              <li><Link to="/privacy">Privacidade</Link></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; {CURRENT_YEAR} Gendei. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  )
}

// Main App
function App() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
          }
        })
      },
      { threshold: 0.1 }
    )

    document.querySelectorAll('.fade-in').forEach((el) => {
      observer.observe(el)
    })

    return () => {
      observer.disconnect()
    }
  }, [])

  return (
    <div className="app" id="top">
      <Navigation />
      <HeroSection />
      <ClinicsSection />
      <DomainsSection />
      <HowSection />
      <AppScreenshotsSection />
      <BenefitsSection />
      <PricingSection />
      <StatsSection />
      <Footer />
    </div>
  )
}

export default App
