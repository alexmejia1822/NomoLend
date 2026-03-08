interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  color?: string;
}

export default function StatCard({ title, value, subtitle, color = "text-white" }: StatCardProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <p className="text-sm text-gray-400 mb-1">{title}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
}
