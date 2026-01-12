import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import './index.css'

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
  Dog: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 5.172C10 3.782 8.423 2.679 6.5 3c-2.823.47-4.113 6.006-4 7 .08.703 1.725 1.722 3.656 1 1.261-.472 1.96-1.45 2.344-2.5"></path>
      <path d="M14.267 5.172c0-1.39 1.577-2.493 3.5-2.172 2.823.47 4.113 6.006 4 7-.08.703-1.725 1.722-3.656 1-1.261-.472-1.855-1.45-2.239-2.5"></path>
      <path d="M8 14v.5"></path>
      <path d="M16 14v.5"></path>
      <path d="M11.25 16.25h1.5L12 17l-.75-.75Z"></path>
      <path d="M4.42 11.247A13.152 13.152 0 0 0 4 14.556C4 18.728 7.582 21 12 21s8-2.272 8-6.444c0-1.061-.162-2.2-.493-3.309m-9.243-6.082A8.801 8.801 0 0 1 12 5c.78 0 1.5.108 2.161.306"></path>
    </svg>
  ),
}

// Navigation Component
function Navigation() {
  return (
    <nav className="nav">
      <div className="container">
        <div className="nav-inner">
          <a href="#" className="nav-logo logo-font">gendei</a>
          <div className="nav-links">
            <a href="#clinicas" className="nav-link">O Agente</a>
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
        chatRef.current.scrollTo({ top: 0, behavior: 'instant' })
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
              Nosso Agente de IA cuida de todo o agendamento e cobra o sinal via PIX, gerando compromisso e reduzindo o no-show.
            </p>
            <div className="hero-features">
              <div className="hero-feature">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <path d="m9 11 3 3L22 4"></path>
                </svg>
                <span>Sinal via PIX</span>
              </div>
              <div className="hero-feature">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <path d="m9 11 3 3L22 4"></path>
                </svg>
                <span>Lembretes Automáticos</span>
              </div>
              <div className="hero-feature">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <path d="m9 11 3 3L22 4"></path>
                </svg>
                <span>IA entende contexto e áudio</span>
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
  const [activeCard, setActiveCard] = useState(null)

  const steps = [
    {
      id: 'agendamento',
      title: 'Agendamento em menos de 2 minutos',
      description: 'O paciente agenda direto no WhatsApp usando um mini app nativo no chat. Sem sair da conversa, escolhe especialidade, profissional, data e horário, e informa convênio. Tudo em uma experiência fluida e rápida.',
      icon: <Icons.MessageCircle />,
      image: '/agendamento.png',
    },
    {
      id: 'pagamento',
      title: 'Sinal via PIX no WhatsApp que elimina no-show',
      description: 'Após escolher o horário, o paciente paga o sinal via PIX dentro do WhatsApp (geralmente 10-15% do valor da consulta). Esse compromisso reduz faltas - de 20% para 5%. Pagamento confirmado automaticamente.',
      icon: <Icons.CreditCard />,
      image: '/pagamento.png',
    },
    {
      id: 'lembretes',
      title: 'Lembretes automáticos inteligentes',
      description: 'O agente envia lembretes 24h e 2h antes. O paciente confirma ou reagenda com um clique. Se precisar, há handover humano, e a clínica acompanha relatório básico de no-show e conversões.',
      icon: <Icons.Bell />,
      image: '/lembretes.png',
    },
  ]

  const handleCardClick = (index) => {
    setActiveCard(activeCard === index ? null : index)
  }

  const getCardPositionClass = (index) => {
    if (index === 1) return 'card-middle'
    if (index === 2) return 'card-right'
    return 'card-left'
  }

  return (
    <section id="clinicas" className="section section-alt">
      <div className="container">
        <div className="section-header">
          <span className="section-number">01</span>
          <h2 className="section-title">
            <span className="section-title-sans">como o Agente de IA atende no WhatsApp</span>
          </h2>
          <p className="section-subtitle section-subtitle-large">
            Um mini app dentro do WhatsApp guia todo o agendamento: entende a intenção do paciente, coleta dados em formulários, mostra horários disponíveis, cobra o sinal via PIX e envia lembretes 24h/2h. Tudo automático, sem precisar da recepção.
          </p>
        </div>

        <div className={`sell-cards-container ${activeCard !== null ? 'has-active' : ''}`}>
          <div className="sell-cards-grid">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`sell-card ${getCardPositionClass(index)} ${activeCard === index ? 'active' : ''} ${activeCard !== null && activeCard !== index ? 'hidden' : ''}`}
                onClick={() => handleCardClick(index)}
              >
                <div className="sell-card-image">
                  {step.image ? (
                    <img src={step.image} alt={step.title} />
                  ) : (
                    <div className="sell-card-placeholder">
                      {step.icon}
                    </div>
                  )}
                  <div className="sell-card-overlay">
                    <span className="sell-card-label">{step.title}</span>
                  </div>
                </div>
                {activeCard === index && (
                  <div className="sell-expanded-content">
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                    <button
                      className="sell-expanded-back"
                      onClick={(e) => {
                        e.stopPropagation()
                        setActiveCard(null)
                      }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="19" y1="12" x2="5" y2="12"></line>
                        <polyline points="12 19 5 12 12 5"></polyline>
                      </svg>
                      Ver outros passos
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
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
      title: 'Configure sua Clínica e especialidades',
    },
    {
      number: '2',
      title: 'Adicione profissionais e horários',
    },
    {
      number: '3',
      title: 'Conecte WhatsApp e templates',
    },
    {
      number: '4',
      title: 'Ative o agente e comece a agendar',
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
          <span className="section-number">02</span>
          <h2 className="section-title">
            <span className="section-title-sans">comece a agendar em 10 minutos</span>
          </h2>
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
        'Visualize agendamentos por dia, semana ou mês. Acompanhe confirmações e comparecimento para reduzir no-show.',
      features: ['Calendário visual', 'Confirmações em tempo real', 'Comparecimento por profissional'],
    },
    {
      id: 'conversas',
      label: 'Conversas',
      image: '/conversas.png',
      description:
        'Acompanhe conversas com pacientes, intervenção humana quando necessário e alertas para não perder oportunidades.',
      features: ['Histórico completo', 'Handover humano', 'Alertas de follow-up'],
    },
    {
      id: 'pacientes',
      label: 'Pacientes',
      image: '/pacientes.png',
      description:
        'Base completa dos pacientes com histórico, contato e convênio. Facilita reagendamentos e melhora a taxa de comparecimento.',
      features: ['Cadastro automático', 'Histórico de consultas', 'Contato e convênio'],
    },
    {
      id: 'relatorios',
      label: 'Relatórios',
      image: '/relatorios.png',
      description:
        'Métricas essenciais: no-show por profissional, taxa de comparecimento e economia gerada. Decisões baseadas em dados.',
      features: ['No-show por profissional', 'Taxa de comparecimento', 'Economia gerada'],
    },
  ]

  return (
    <section id="app" className="app-screenshots-section">
      <div className="container">
        <div className="section-header">
          <span className="section-number">03</span>
          <h2 className="section-title">
            <span className="section-title-sans">o app em ação:</span>
          </h2>
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
      description: 'Sinal via PIX + lembretes reduzem no-show e recuperam consultas que seriam perdidas.',
    },
    {
      icon: <Icons.Clock />,
      title: 'Atendimento mais rápido no WhatsApp',
      description: 'Respostas em segundos, com agenda e confirmação sem fricção.',
    },
    {
      icon: <Icons.CreditCard />,
      title: 'Sinal Automático via PIX',
      description: 'Cobra o sinal via PIX dentro do WhatsApp para confirmar o agendamento. Sem trabalho manual.',
    },
    {
      icon: <Icons.Bell />,
      title: 'Lembretes Inteligentes',
      description: 'Lembretes 24h e 2h antes da consulta. Paciente confirma ou reagenda pelo WhatsApp.',
    },
    {
      icon: <Icons.Users />,
      title: 'Menos caos na recepção',
      description: 'Equipe foca no atendimento presencial enquanto o WhatsApp agenda sozinho.',
    },
    {
      icon: <Icons.Sparkles />,
      title: 'Conversas Naturais',
      description: 'IA entende histórico e áudio, responde com contexto e guia o paciente até o agendamento.',
    },
  ]

  return (
    <section className="section">
      <div className="container">
        <div className="section-header">
          <span className="section-number">04</span>
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
    { value: '48%', label: 'gestores citam no-show' },
    { value: '290k', label: 'clínicas no Brasil' },
    { value: '20-30%', label: 'média de no-show' },
    { value: 'R$35k', label: 'recuperação (exemplo)' },
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
          <span className="section-number">05</span>
          <h2 className="section-title">
            <span className="section-title-sans">preço simples. ROI garantido.</span>
          </h2>
          <p className="section-subtitle section-subtitle-large">
            Exemplo de ROI: 60 consultas/dia, ticket médio R$ 180, no-show 20% = R$ 35.640/mês perdidos. Com 5% de no-show, a recuperação passa de R$ 23.000/mês.
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
              Valor fixo mensal que se paga com poucas consultas recuperadas. O ROI cresce conforme o volume da clínica. Sem taxa por agendamento, sem surpresas.
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
            <a href="#" className="nav-logo logo-font">gendei</a>
          </div>
          <div className="footer-column">
            <h4>Produto</h4>
            <ul>
              <li><a href="#clinicas">O Agente</a></li>
              <li><a href="#como-funciona">Configuração</a></li>
              <li><a href="#app">App</a></li>
              <li><a href="#preco">Preço</a></li>
            </ul>
          </div>
          <div className="footer-column">
            <h4>Recursos</h4>
            <ul>
              <li><a href="#">Blog</a></li>
              <li><a href="#">Central de Ajuda</a></li>
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
          <p>&copy; 2025 Gendei. Todos os direitos reservados.</p>
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
    <div className="app">
      <Navigation />
      <HeroSection />
      <ClinicsSection />
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
