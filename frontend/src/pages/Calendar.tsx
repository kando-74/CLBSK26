
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTablesService, type TableRecord } from '../services/tables';
import { GameTitle } from '../components/GameTitle';
import { UserLink } from '../components/UserLink';
import { Clock, MapPin } from 'lucide-react';

export function Calendar() {
  const { tables, loading, error } = useTablesService();

  const groupedTables = useMemo(() => {
    const groups: Record<string, TableRecord[]> = {};
    tables.forEach((table) => {
      const date = new Date(table.startedAt ?? Date.now()).toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(table);
    });
    return groups;
  }, [tables]);

  if (loading) {
    return <div>Cargando calendario...</div>;
  }

  if (error) {
    return <div className="text-error">Error al cargar el calendario: {error}</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="section-title">Calendario de Partidas</h2>
      {Object.entries(groupedTables).map(([date, tablesInDay]) => (
        <div key={date} className="card space-y-4 p-5">
          <h3 className="text-lg font-semibold text-text-primary">{date}</h3>
          <div className="space-y-4">
            {tablesInDay.map((table) => (
              <Link to={`/tablon#${table.id}`} key={table.id} className="block rounded-2xl border border-primary/20 p-4 hover:bg-primary/10">
                <GameTitle name={table.game} coverUrl={table.coverUrl ?? undefined} size="sm" />
                <p className="text-sm text-text-secondary">Anfitrión: <UserLink player={{ uid: table.host, alias: table.host }} /></p>
                <div className="mt-2 flex items-center gap-4 text-sm text-text-secondary">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>{table.start}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>{table.room}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
