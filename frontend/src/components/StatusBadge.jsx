const MAP = {
  new:         ['b-new',      'Новая'   ],
  assigned:    ['b-assigned', 'Назначена'],
  in_progress: ['b-progress', 'В работе'],
  closed:      ['b-closed',   'Закрыта' ],
};

export default function StatusBadge({ status }) {
  const [cls, label] = MAP[status] ?? ['b-new', status];
  return <span className={`badge ${cls}`}>{label}</span>;
}
