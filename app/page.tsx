import MapContainer from '@/components/Map/MapContainer'
import { AirportCacheProvider } from '@/components/Cache/AirportCacheProvider'
import SplashScreen from '@/components/SplashScreen'

export default function Home() {
  return (
    <main className="relative w-full h-screen">
      <SplashScreen />
      <AirportCacheProvider>
        <MapContainer />
      </AirportCacheProvider>
    </main>
  )
}
