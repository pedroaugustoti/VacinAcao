// src/components/pwa/ListaDosesSkeleton.tsx
export default function ListaDosesSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Simulando 3 blocos vazios piscando */}
      <div className="h-20 bg-gray-200 rounded-xl w-full"></div>
      <div className="h-20 bg-gray-200 rounded-xl w-full"></div>
      <div className="h-20 bg-gray-200 rounded-xl w-full"></div>
    </div>
  )
}