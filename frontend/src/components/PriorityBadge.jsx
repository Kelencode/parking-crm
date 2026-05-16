const MAP = {
  critical: ['b-critical', 'Критичный'],
  high:     ['b-high',     'Высокий'  ],
  medium:   ['b-medium',   'Средний'  ],
  low:      ['b-low',      'Низкий'   ],
};

export default function PriorityBadge({ priority }) {
  const [cls, label] = MAP[priority] ?? ['b-low', priority];
  return <span className={`badge ${cls}`}>{label}</span>;
}
