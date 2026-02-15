export default function CheckoutCancelPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold text-gray-700 mb-2">
          Pagamento cancelado
        </h1>
        <p className="text-gray-600 mb-6">
          O pagamento nao foi concluido. Volte ao WhatsApp para tentar novamente ou escolher outro metodo de pagamento.
        </p>
      </div>
    </div>
  );
}
