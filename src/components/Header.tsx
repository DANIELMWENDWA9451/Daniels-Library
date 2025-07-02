import { useRouter } from 'next/router';
import Logo from './Logo';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';

const PROVERB = "A book is a dream you hold in your hands.";

const Header = () => {
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-30 w-full bg-gradient-to-b from-slate-950/95 to-slate-900/80 shadow-xl border-b border-slate-800 backdrop-blur-lg">
      <div className="flex flex-col sm:flex-row justify-between items-center py-4 px-4 sm:px-8 gap-2">
        <div className="flex items-center gap-3 cursor-pointer select-none" onClick={() => router.push("/")}> 
          <Logo />
          <span className="text-2xl font-extrabold tracking-tight text-slate-100 drop-shadow-lg">Daniels Library</span>
        </div>
        <div className="flex flex-col items-center sm:items-end gap-1">
          <span className="italic text-slate-300 text-sm font-medium max-w-xs text-center">{PROVERB}</span>
          <button
            className="mt-1 p-2 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors shadow"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5 text-yellow-300" /> : <Moon className="w-5 h-5 text-slate-700" />}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;