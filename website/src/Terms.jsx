import { Link } from 'react-router-dom'
import './index.css'

const CURRENT_YEAR = new Date().getFullYear()

function Terms() {
  return (
    <div className="legal-page">
      <nav className="nav">
        <div className="container">
          <div className="nav-inner">
            <Link to="/" className="nav-logo logo-font">gendei</Link>
            <div className="nav-cta">
              <a href="https://go.gendei.app/pt-BR/signup" className="btn btn-primary">
                COMEÇAR AGORA
              </a>
            </div>
          </div>
        </div>
      </nav>

      <main className="legal-content">
        <div className="container">
          <h1>Termos de Uso</h1>
          <p className="legal-updated">Última atualização: fevereiro de 2026</p>

          <section>
            <h2>1. Aceitação dos Termos</h2>
            <p>
              Ao acessar ou utilizar a plataforma Gendei, você declara que leu, compreendeu e concorda com estes Termos de Uso.
              Caso não concorde com qualquer disposição, não utilize os serviços.
            </p>
          </section>

          <section>
            <h2>2. Descrição do Serviço</h2>
            <p>
              A Gendei é uma plataforma de automação de agendamentos e comunicação via WhatsApp para clínicas e profissionais de saúde.
              Entre as funcionalidades, podem estar incluídas:
            </p>
            <ul>
              <li>Agendamento automatizado de consultas e sessões</li>
              <li>Cobrança de sinal via PIX</li>
              <li>Lembretes automáticos de consulta</li>
              <li>Painel de gestão com dados operacionais</li>
              <li>Recursos de atendimento humano quando necessário</li>
            </ul>
          </section>

          <section>
            <h2>3. Cadastro e Conta</h2>
            <p>
              Para utilizar os serviços, você deve criar uma conta com informações verdadeiras, atualizadas e completas.
              Você é responsável por manter a confidencialidade de suas credenciais e por toda atividade realizada na sua conta.
            </p>
          </section>

          <section>
            <h2>4. Uso da Plataforma</h2>
            <p>Ao utilizar a plataforma, você concorda em:</p>
            <ul>
              <li>Utilizar os serviços apenas para finalidades legítimas</li>
              <li>Cumprir leis e regulamentos aplicáveis, inclusive os de saúde e proteção de dados</li>
              <li>Não tentar violar, interromper ou degradar o funcionamento da plataforma</li>
              <li>Não usar os serviços para spam, fraude ou conteúdo ilícito</li>
            </ul>
          </section>

          <section>
            <h2>5. Pagamentos</h2>
            <p>
              Os serviços da Gendei são prestados mediante contratação e pagamento conforme plano escolhido.
              Valores, condições comerciais e regras de cobrança são apresentados no momento da contratação.
            </p>
          </section>

          <section>
            <h2>6. Privacidade</h2>
            <p>
              O tratamento de dados pessoais é regido pela nossa <Link to="/privacy">Política de Privacidade</Link>.
              Ao utilizar os serviços, você concorda com as práticas descritas nesse documento.
            </p>
          </section>

          <section>
            <h2>7. Propriedade Intelectual</h2>
            <p>
              O software, marca, layout, conteúdos e demais elementos da plataforma são protegidos por direitos de propriedade intelectual
              e pertencem à Gendei ou a seus licenciadores.
            </p>
          </section>

          <section>
            <h2>8. Limitação de Responsabilidade</h2>
            <p>
              A Gendei envida esforços para manter os serviços disponíveis e seguros, mas não garante ausência de indisponibilidade pontual.
              Na extensão permitida por lei, a Gendei não será responsável por danos indiretos, lucros cessantes ou perdas consequenciais.
            </p>
          </section>

          <section>
            <h2>9. Alterações destes Termos</h2>
            <p>
              Estes Termos podem ser atualizados periodicamente.
              Alterações relevantes serão comunicadas pelos canais oficiais da plataforma.
            </p>
          </section>

          <section>
            <h2>10. Contato</h2>
            <p>
              Em caso de dúvidas sobre estes Termos de Uso, entre em contato:
              contato@gendei.com
            </p>
          </section>
        </div>
      </main>

      <footer className="legal-footer">
        <div className="container">
          <p>&copy; {CURRENT_YEAR} Gendei. Todos os direitos reservados.</p>
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
