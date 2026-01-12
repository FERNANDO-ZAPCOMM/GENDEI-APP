import { Link } from 'react-router-dom'
import './index.css'

function Terms() {
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
          <h1>Termos de Uso</h1>
          <p className="legal-updated">Ultima atualizacao: Janeiro de 2025</p>

          <section>
            <h2>1. Aceitacao dos Termos</h2>
            <p>
              Ao acessar ou usar a plataforma Gendei, voce concorda em ficar vinculado a estes Termos de Uso.
              Se voce nao concordar com algum termo, nao utilize nossos servicos.
            </p>
          </section>

          <section>
            <h2>2. Descricao do Servico</h2>
            <p>
              Gendei e uma plataforma de agendamento inteligente que utiliza inteligencia artificial para
              automatizar o processo de agendamento de consultas via WhatsApp. Nossos servicos incluem:
            </p>
            <ul>
              <li>Agendamento automatizado de consultas via WhatsApp</li>
              <li>Cobranca de sinal via PIX</li>
              <li>Envio de lembretes automaticos</li>
              <li>Painel de gestao para clinicas</li>
              <li>Relatorios e metricas de agendamentos</li>
            </ul>
          </section>

          <section>
            <h2>3. Cadastro e Conta</h2>
            <p>
              Para utilizar nossos servicos, voce deve criar uma conta fornecendo informacoes precisas e completas.
              Voce e responsavel por manter a confidencialidade de suas credenciais de acesso.
            </p>
          </section>

          <section>
            <h2>4. Uso da Plataforma</h2>
            <p>Voce concorda em:</p>
            <ul>
              <li>Utilizar a plataforma apenas para fins legitimos</li>
              <li>Nao violar leis ou regulamentos aplicaveis</li>
              <li>Nao interferir no funcionamento da plataforma</li>
              <li>Nao utilizar a plataforma para enviar spam ou conteudo indesejado</li>
            </ul>
          </section>

          <section>
            <h2>5. Pagamentos</h2>
            <p>
              Os servicos Gendei sao oferecidos mediante pagamento mensal. Os valores e formas de pagamento
              estao disponiveis em nossa pagina de precos. Pagamentos sao processados de forma segura.
            </p>
          </section>

          <section>
            <h2>6. Privacidade</h2>
            <p>
              O uso dos seus dados pessoais e regulado pela nossa <Link to="/privacy">Politica de Privacidade</Link>.
              Ao utilizar nossos servicos, voce concorda com a coleta e uso de informacoes conforme descrito.
            </p>
          </section>

          <section>
            <h2>7. Propriedade Intelectual</h2>
            <p>
              Todo o conteudo da plataforma, incluindo textos, graficos, logos, icones e software,
              e propriedade da Gendei ou de seus licenciadores e e protegido por leis de propriedade intelectual.
            </p>
          </section>

          <section>
            <h2>8. Limitacao de Responsabilidade</h2>
            <p>
              A Gendei nao sera responsavel por danos indiretos, incidentais, especiais ou consequenciais
              resultantes do uso ou impossibilidade de uso de nossos servicos.
            </p>
          </section>

          <section>
            <h2>9. Modificacoes</h2>
            <p>
              Reservamo-nos o direito de modificar estes termos a qualquer momento. Notificaremos sobre
              alteracoes significativas atraves de nossos canais de comunicacao.
            </p>
          </section>

          <section>
            <h2>10. Contato</h2>
            <p>
              Para duvidas sobre estes Termos de Uso, entre em contato conosco atraves do email:
              contato@gendei.com
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

export default Terms
