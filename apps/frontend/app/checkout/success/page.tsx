export default function CheckoutSuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold text-green-700 mb-2">
          Pagamento confirmado!
        </h1>
        <p className="text-gray-600 mb-6">
          Seu pagamento foi processado com sucesso. Pode fechar esta pagina e voltar ao WhatsApp.
        </p>
        <p className="text-sm text-gray-400">
          Voce recebera uma confirmacao no WhatsApp em instantes.
        </p>
      </div>
    </div>
  );
}
