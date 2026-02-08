import { Link } from 'react-router-dom'
import './index.css'

const CURRENT_YEAR = new Date().getFullYear()

function Privacy() {
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
          <h1>Política de Privacidade</h1>
          <p className="legal-updated">Última atualização: fevereiro de 2026</p>

          <section>
            <h2>1. Introdução</h2>
            <p>
              A Gendei está comprometida com a proteção de dados pessoais.
              Esta Política explica como coletamos, utilizamos, armazenamos e protegemos informações quando você utiliza nossa plataforma.
            </p>
          </section>

          <section>
            <h2>2. Dados que Coletamos</h2>
            <h3>2.1 Dados de Cadastro</h3>
            <ul>
              <li>Nome, e-mail, telefone e dados de acesso</li>
              <li>Informações da clínica (nome, endereço, CNPJ, dados operacionais)</li>
              <li>Dados de profissionais cadastrados na plataforma</li>
            </ul>

            <h3>2.2 Dados de Pacientes Inseridos pela Clínica</h3>
            <ul>
              <li>Nome e telefone</li>
              <li>Histórico de agendamentos e interações</li>
              <li>Dados de convênio e pagamento, quando aplicável</li>
            </ul>

            <h3>2.3 Dados de Uso e Operação</h3>
            <ul>
              <li>Logs técnicos de acesso e segurança</li>
              <li>Métricas de uso da plataforma</li>
              <li>Histórico de conversas para execução do serviço</li>
            </ul>
          </section>

          <section>
            <h2>3. Como Utilizamos os Dados</h2>
            <p>Utilizamos os dados para:</p>
            <ul>
              <li>Fornecer e aprimorar os serviços contratados</li>
              <li>Processar agendamentos e pagamentos</li>
              <li>Enviar lembretes e notificações</li>
              <li>Gerar relatórios operacionais</li>
              <li>Cumprir obrigações legais e regulatórias</li>
            </ul>
          </section>

          <section>
            <h2>4. Compartilhamento de Dados</h2>
            <p>
              Não vendemos dados pessoais. O compartilhamento pode ocorrer apenas quando necessário para execução dos serviços, por exemplo:
            </p>
            <ul>
              <li>Provedores de infraestrutura, mensageria e pagamento</li>
              <li>Parceiros tecnológicos para integração com APIs externas</li>
              <li>Autoridades públicas, quando houver obrigação legal</li>
            </ul>
          </section>

          <section>
            <h2>5. Segurança dos Dados</h2>
            <p>
              Aplicamos medidas técnicas e administrativas de segurança, como controle de acesso, monitoramento, segregação de ambientes e boas práticas de proteção de dados.
            </p>
          </section>

          <section>
            <h2>6. Seus Direitos</h2>
            <p>Nos termos da LGPD, você pode solicitar:</p>
            <ul>
              <li>Confirmação do tratamento e acesso aos dados</li>
              <li>Correção de dados incompletos, inexatos ou desatualizados</li>
              <li>Anonimização, bloqueio ou eliminação, quando cabível</li>
              <li>Portabilidade, quando aplicável</li>
              <li>Informações sobre compartilhamento e revogação de consentimento</li>
            </ul>
          </section>

          <section>
            <h2>7. Retenção de Dados</h2>
            <p>
              Mantemos os dados pelo período necessário para prestação dos serviços e cumprimento de obrigações legais.
              Após encerramento da conta, determinados dados podem ser mantidos pelos prazos exigidos em lei.
            </p>
          </section>

          <section>
            <h2>8. Cookies</h2>
            <p>
              Utilizamos cookies e tecnologias similares para melhorar a experiência de navegação, segurança e desempenho.
              Você pode ajustar preferências no navegador, observando que isso pode impactar funcionalidades.
            </p>
          </section>

          <section>
            <h2>9. Alterações desta Política</h2>
            <p>
              Esta Política pode ser atualizada periodicamente.
              Em caso de alterações relevantes, comunicaremos pelos canais oficiais.
            </p>
          </section>

          <section>
            <h2>10. Contato</h2>
            <p>
              Para dúvidas sobre privacidade ou exercício de direitos relacionados a dados pessoais:
              privacidade@gendei.com
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

export default Privacy
