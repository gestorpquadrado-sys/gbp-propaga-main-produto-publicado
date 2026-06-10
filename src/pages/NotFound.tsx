import { Link } from 'react-router-dom';

const NotFound = () => (
  <div className="min-h-screen flex flex-col items-center justify-center gap-4">
    <h1 className="text-4xl font-bold text-foreground">404</h1>
    <p className="text-muted-foreground">Página não encontrada</p>
    <Link to="/" className="text-primary underline">Voltar ao início</Link>
  </div>
);

export default NotFound;
