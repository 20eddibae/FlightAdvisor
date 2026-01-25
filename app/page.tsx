import MapContainer from '@/components/Map/MapContainer'
import { AirportCacheProvider } from '@/components/Cache/AirportCacheProvider'

export default function Home() {
  return (
    <main className="relative w-full h-screen">
      <AirportCacheProvider>
        <MapContainer />
      </AirportCacheProvider>
    </main>
  )
}
