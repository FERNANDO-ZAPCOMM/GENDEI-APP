import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100">
      <div className="text-center space-y-6 p-8">
        <h1 className="text-6xl font-bold text-gray-900">
          Welcome to <span className="text-emerald-600 logo-font">Gendei</span>
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          WhatsApp-native Clinic Appointment Scheduling Platform
        </p>
        <div className="flex gap-4 justify-center pt-4">
          <Link
            href="/pt-BR/dashboard"
            className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
          >
            Acessar Painel
          </Link>
          <Link
            href="/pt-BR/signin"
            className="px-6 py-3 border-2 border-emerald-600 text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors font-medium"
          >
            Entrar
          </Link>
        </div>
      </div>
    </div>
  );
}
