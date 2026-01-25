import { calculateRouteAsync, RouteRequest } from './route'

addEventListener('message', async (event: MessageEvent<RouteRequest>) => {
    try {
        const routeRequest = event.data
        const results = await calculateRouteAsync(routeRequest)
        postMessage({ success: true, results })
    } catch (error) {
        console.error('Route calculation worker error:', error)
        postMessage({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown worker error'
        })
    }
})
