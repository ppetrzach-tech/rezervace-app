import Link from "next/link";

export const metadata = {
  title: "Rezervační systém",
  description: "Vlastní rezervační stránka pro váš byznys za 5 minut.",
};

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-5 flex justify-between items-center">
          <Link href="/" className="text-xl font-semibold text-brand-700">
            📅 Rezervace
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/login" className="text-slate-600 hover:text-brand-700">
              Přihlášení
            </Link>
            <Link href="/signup" className="btn-primary">
              Vyzkoušet zdarma
            </Link>
          </nav>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-6 py-20 text-center">
        <h1 className="text-5xl font-bold mb-6">
          Vlastní rezervační stránka<br />za 5 minut
        </h1>
        <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto">
          Pro kadeřníky, realitky, lékaře, konzultanty a kohokoliv, kdo potřebuje
          přijímat rezervace online. Klienti si vyberou termín, vy dostanete
          potvrzení.
        </p>
        <div className="flex justify-center gap-3">
          <Link href="/signup" className="btn-primary text-lg px-6 py-3">
            Vytvořit účet
          </Link>
          <Link
            href="/salon-krasy"
            className="btn-secondary text-lg px-6 py-3"
          >
            Vyzkoušet demo
          </Link>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-16 grid sm:grid-cols-3 gap-6">
        <div className="card">
          <div className="text-3xl mb-3">⚡</div>
          <h3 className="font-semibold text-lg mb-2">Spuštění za 5 minut</h3>
          <p className="text-slate-600 text-sm">
            Vytvořte si účet, nastavte typy schůzek, pracovní dobu a sdílejte
            odkaz s klienty.
          </p>
        </div>
        <div className="card">
          <div className="text-3xl mb-3">📧</div>
          <h3 className="font-semibold text-lg mb-2">Email + SMS</h3>
          <p className="text-slate-600 text-sm">
            Klient i vy dostanete potvrzení. Den předem odejde automatická
            připomínka.
          </p>
        </div>
        <div className="card">
          <div className="text-3xl mb-3">🎨</div>
          <h3 className="font-semibold text-lg mb-2">Vaše barvy a název</h3>
          <p className="text-slate-600 text-sm">
            Stránka v barvách vaší firmy. Klient vidí jen váš název, ne nás.
          </p>
        </div>
      </section>

      <footer className="border-t border-slate-200 mt-20">
        <div className="max-w-6xl mx-auto px-6 py-6 text-sm text-slate-500 flex justify-between">
          <span>© {new Date().getFullYear()} Rezervační systém</span>
          <span>
            <Link href="/login" className="hover:text-brand-700">
              Přihlášení
            </Link>
          </span>
        </div>
      </footer>
    </main>
  );
}
