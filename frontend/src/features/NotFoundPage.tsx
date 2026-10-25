import { Link } from 'react-router-dom';
import { pt } from '../i18n/pt';

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <h1 className="text-xl font-semibold">{pt.notFound.title}</h1>
      <p className="text-sm text-muted">{pt.notFound.text}</p>
      <Link to="/">{pt.notFound.back}</Link>
    </div>
  );
}
