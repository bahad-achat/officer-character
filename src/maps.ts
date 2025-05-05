import * as L from "leaflet"
// @ts-ignore
import leafletImage from "leaflet-image"

interface MapPoint {
  latitude: number
  longitude: number
  color: string
}

export const renderMap = async (
  width: number,
  height: number,
  center: [number, number],
  zoom: number,
  points: MapPoint[],
) => {
  const mapContainer = window.document.getElementById("mapContainer")!
  const map = window.document.createElement("div")
  const id = Math.floor(Math.random() * 10000000).toString()
  map.id = id
  map.style.height = height + "px"
  map.style.width = width + "px"
  mapContainer.appendChild(map)
  const m = L.map(id, { preferCanvas: true, zoomControl: false }).setView(
    center,
    zoom,
  )

  for (let i = 0; i + 1 < points.length; i++) {
    if (points[i].color === points[i + 1].color) {
      L.polyline(
        [
          [points[i].latitude, points[i].longitude],
          [points[i + 1].latitude, points[i + 1].longitude],
        ],
        { color: points[i].color },
      ).addTo(m)
    }
  }

  for (const point of points) {
    L.circle([point.latitude, point.longitude], {
      radius: 350,
      fillOpacity: 0.85,
      color: "black",
      fillColor: point.color,
      opacity: 1,
    }).addTo(m)
  }

  L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
  }).addTo(m)

  const pixelBounds = m.getPixelBounds()
  const minPoint = new L.Point(pixelBounds.min!.x, pixelBounds.min!.y)
  const result = await new Promise<string>((resolve) =>
    leafletImage(m, (_error: any, canvas: HTMLCanvasElement) => {
      const context = canvas.getContext("2d")!
      context.font = "12px IBM Plex Sans Hebrew"
      context.textBaseline = "middle"
      context.textAlign = "center"
      for (let i = 0; i < points.length; i++) {
        const point = points[i]
        const p = m
          .project({ lat: point.latitude, lng: point.longitude })
          .subtract(minPoint)
        context.fillText(`${i + 1}`, p.x, p.y)
      }

      resolve(canvas.toDataURL())
    }),
  )
  mapContainer.removeChild(map)
  return result
}
