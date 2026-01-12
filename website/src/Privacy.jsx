import { Link } from 'react-router-dom'
import './index.css'

function Privacy() {
  return (
    <div className="legal-page">
      <nav className="nav">
        <div className="container">
          <div className="nav-inner">
            <Link to="/" className="nav-logo logo-font">gendei</Link>
            <div className="nav-cta">
              <a href="https://go.gendei.app/pt-BR/signup" className="btn btn-primary">
                COMECAR AGORA
              </a>
            </div>
          </div>
        </div>
      </nav>

      <main className="legal-content">
        <div className="container">
          <h1>Politica de Privacidade</h1>
          <p className="legal-updated">Ultima atualizacao: Janeiro de 2025</p>

          <section>
            <h2>1. Introducao</h2>
            <p>
              A Gendei esta comprometida em proteger sua privacidade. Esta Politica de Privacidade explica
              como coletamos, usamos e protegemos suas informacoes pessoais quando voce utiliza nossa plataforma.
            </p>
          </section>

          <section>
            <h2>2. Informacoes que Coletamos</h2>
            <h3>2.1 Informacoes de Cadastro</h3>
            <ul>
              <li>Nome e dados de contato</li>
              <li>Informacoes da clinica (nome, endereco, CNPJ)</li>
              <li>Dados de profissionais (nome, especialidade, CRM)</li>
            </ul>

            <h3>2.2 Informacoes de Pacientes</h3>
            <ul>
              <li>Nome e telefone</li>
              <li>Historico de agendamentos</li>
              <li>Dados de convenio (quando aplicavel)</li>
            </ul>

            <h3>2.3 Informacoes de Uso</h3>
            <ul>
              <li>Logs de acesso a plataforma</li>
              <li>Metricas de uso do servico</li>
              <li>Historico de conversas com o agente de IA</li>
            </ul>
          </section>

          <section>
            <h2>3. Como Usamos suas Informacoes</h2>
            <p>Utilizamos suas informacoes para:</p>
            <ul>
              <li>Fornecer e melhorar nossos servicos</li>
              <li>Processar agendamentos e pagamentos</li>
              <li>Enviar lembretes e notificacoes</li>
              <li>Analisar o uso da plataforma</li>
              <li>Cumprir obrigacoes legais</li>
            </ul>
          </section>

          <section>
            <h2>4. Compartilhamento de Dados</h2>
            <p>
              Nao vendemos suas informacoes pessoais. Podemos compartilhar dados com:
            </p>
            <ul>
              <li>Provedores de servicos (processamento de pagamentos, hospedagem)</li>
              <li>Autoridades quando exigido por lei</li>
              <li>Parceiros tecnologicos (WhatsApp Business API, integracao PIX)</li>
            </ul>
          </section>

          <section>
            <h2>5. Seguranca dos Dados</h2>
            <p>
              Implementamos medidas de seguranca tecnicas e organizacionais para proteger suas informacoes,
              incluindo criptografia, controle de acesso e monitoramento de seguranca.
            </p>
          </section>

          <section>
            <h2>6. Seus Direitos</h2>
            <p>Conforme a LGPD, voce tem direito a:</p>
            <ul>
              <li>Acessar seus dados pessoais</li>
              <li>Corrigir dados incompletos ou inexatos</li>
              <li>Solicitar a exclusao de seus dados</li>
              <li>Portar seus dados para outro servico</li>
              <li>Revogar consentimento</li>
            </ul>
          </section>

          <section>
            <h2>7. Retencao de Dados</h2>
            <p>
              Mantemos seus dados pelo tempo necessario para fornecer nossos servicos e cumprir obrigacoes
              legais. Apos o encerramento da conta, dados podem ser retidos conforme exigencias regulatorias.
            </p>
          </section>

          <section>
            <h2>8. Cookies</h2>
            <p>
              Utilizamos cookies para melhorar sua experiencia na plataforma. Voce pode configurar
              seu navegador para recusar cookies, mas isso pode afetar a funcionalidade do servico.
            </p>
          </section>

          <section>
            <h2>9. Alteracoes nesta Politica</h2>
            <p>
              Podemos atualizar esta politica periodicamente. Notificaremos sobre alteracoes significativas
              atraves de nossos canais de comunicacao.
            </p>
          </section>

          <section>
            <h2>10. Contato</h2>
            <p>
              Para questoes sobre privacidade ou exercer seus direitos, entre em contato:
              privacidade@gendei.com
            </p>
          </section>
        </div>
      </main>

      <footer className="legal-footer">
        <div className="container">
          <p>&copy; 2025 Gendei. Todos os direitos reservados.</p>
          <div className="legal-footer-links">
            <Link to="/terms">Termos de Uso</Link>
            <Link to="/privacy">Privacidade</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Privacy
