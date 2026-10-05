import React, { useState, useEffect, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  Navigation, MapPin, Loader2, CheckCircle2,
  LocateFixed, ExternalLink
} from 'lucide-react'

// Fix Leaflet's default icon issue with bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// Custom teal marker icon
const customIcon = new L.Icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

interface WaterLocationPickerProps {
  onLocationChange: (data: {
    lat: number
    lng: number
    googleMapsUrl: string
    district: string
    streetAddress: string
  }) => void
  initialDistrict?: string
  initialStreetAddress?: string
}

// Default center: Saudi Arabia (Riyadh area)
const DEFAULT_CENTER: [number, number] = [24.7136, 46.6753]
const DEFAULT_ZOOM = 6
const LOCATED_ZOOM = 16

// Reverse geocoding via free Nominatim OSM API
async function reverseGeocode(lat: number, lng: number): Promise<{ district: string; street: string }> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ar&zoom=18&addressdetails=1`,
      { headers: { 'User-Agent': 'KhalidResortWaterApp/1.0' } }
    )
    const data = await res.json()
    const addr = data.address || {}
    
    const district =
      addr.suburb ||
      addr.neighbourhood ||
      addr.city_district ||
      addr.town ||
      addr.city ||
      addr.county ||
      ''
    
    const street =
      addr.road ||
      addr.pedestrian ||
      addr.footway ||
      ''
    
    return { district, street }
  } catch {
    return { district: '', street: '' }
  }
}

// Sub-component: Handles map click events
function MapClickHandler({
  onMapClick,
}: {
  onMapClick: (lat: number, lng: number) => void
}) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

// Sub-component: Flies map to a specific location
function FlyToLocation({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.5 })
  }, [center, zoom, map])
  return null
}

// Sub-component: Draggable marker
function DraggableMarker({
  position,
  onDragEnd,
}: {
  position: [number, number]
  onDragEnd: (lat: number, lng: number) => void
}) {
  const markerRef = useRef<L.Marker>(null)

  const eventHandlers = {
    dragend() {
      const marker = markerRef.current
      if (marker) {
        const pos = marker.getLatLng()
        onDragEnd(pos.lat, pos.lng)
      }
    },
  }

  return (
    <Marker
      draggable={true}
      eventHandlers={eventHandlers}
      position={position}
      ref={markerRef}
      icon={customIcon}
    />
  )
}

export const WaterLocationPicker: React.FC<WaterLocationPickerProps> = ({
  onLocationChange,
  initialDistrict = '',
  initialStreetAddress = '',
}) => {
  const [markerPos, setMarkerPos] = useState<[number, number] | null>(null)
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null)
  const [flyZoom, setFlyZoom] = useState(DEFAULT_ZOOM)
  const [locating, setLocating] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [locationConfirmed, setLocationConfirmed] = useState(false)
  const [detectedDistrict, setDetectedDistrict] = useState(initialDistrict)
  const [detectedStreet, setDetectedStreet] = useState(initialStreetAddress)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Handle position update (from GPS, click, or drag)
  const handlePositionUpdate = useCallback(
    async (lat: number, lng: number) => {
      setMarkerPos([lat, lng])
      setLocationConfirmed(true)
      setErrorMsg(null)

      const googleMapsUrl = `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`

      // Reverse geocode
      setGeocoding(true)
      const { district, street } = await reverseGeocode(lat, lng)
      setDetectedDistrict(district)
      setDetectedStreet(street)
      setGeocoding(false)

      onLocationChange({
        lat,
        lng,
        googleMapsUrl,
        district: district || initialDistrict,
        streetAddress: street || initialStreetAddress,
      })
    },
    [onLocationChange, initialDistrict, initialStreetAddress]
  )

  // GPS locate me
  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
      setErrorMsg('متصفحك لا يدعم خاصية تحديد الموقع الجغرافي ⚠️')
      return
    }

    setLocating(true)
    setErrorMsg(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        setFlyTarget([lat, lng])
        setFlyZoom(LOCATED_ZOOM)
        handlePositionUpdate(lat, lng)
        setLocating(false)
      },
      (err) => {
        setLocating(false)
        setErrorMsg('تعذّر تحديد موقعك — يرجى تفعيل GPS أو تحديد الموقع يدوياً على الخريطة')
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    )
  }, [handlePositionUpdate])

  // Handle map click
  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      setFlyTarget([lat, lng])
      setFlyZoom(LOCATED_ZOOM)
      handlePositionUpdate(lat, lng)
    },
    [handlePositionUpdate]
  )

  // Handle marker drag end
  const handleMarkerDragEnd = useCallback(
    (lat: number, lng: number) => {
      handlePositionUpdate(lat, lng)
    },
    [handlePositionUpdate]
  )

  const googleMapsUrl = markerPos
    ? `https://www.google.com/maps?q=${markerPos[0].toFixed(6)},${markerPos[1].toFixed(6)}`
    : null

  return (
    <div className="space-y-4">
      {/* Map Container */}
      <div className="relative rounded-2xl overflow-hidden border-2 border-teal-500/30 shadow-xl shadow-teal-500/10">
        {/* Locate Me Button - Floating over map */}
        <button
          type="button"
          onClick={handleLocateMe}
          disabled={locating}
          className="absolute top-3 right-3 z-[1000] px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-teal-500/30 transition-all hover:scale-105 active:scale-95 disabled:opacity-60"
        >
          {locating ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              <span>جاري التحديد...</span>
            </>
          ) : (
            <>
              <LocateFixed size={15} />
              <span>حدد موقعي 📍</span>
            </>
          )}
        </button>

        {/* Leaflet Map */}
        <div className="h-64 sm:h-72 w-full" style={{ direction: 'ltr' }}>
          <MapContainer
            center={DEFAULT_CENTER}
            zoom={DEFAULT_ZOOM}
            scrollWheelZoom={true}
            className="h-full w-full z-0"
            style={{ background: '#1a2332' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapClickHandler onMapClick={handleMapClick} />
            {flyTarget && <FlyToLocation center={flyTarget} zoom={flyZoom} />}
            {markerPos && (
              <DraggableMarker
                position={markerPos}
                onDragEnd={handleMarkerDragEnd}
              />
            )}
          </MapContainer>
        </div>

        {/* Map instruction overlay (shown when no marker) */}
        {!markerPos && !locating && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center pointer-events-none">
            <div className="px-5 py-3 rounded-2xl bg-black/70 backdrop-blur-md border border-white/10 text-center space-y-1 pointer-events-none">
              <MapPin size={24} className="text-teal-400 mx-auto animate-bounce" />
              <p className="text-xs text-white font-semibold">اضغط على الخريطة لتحديد موقعك</p>
              <p className="text-[10px] text-gray-400">أو اضغط "حدد موقعي" لالتقاط GPS تلقائياً</p>
            </div>
          </div>
        )}
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
          <span>⚠️</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Location Confirmation Status */}
      {locationConfirmed && markerPos && (
        <div className="p-4 rounded-2xl bg-teal-500/10 border border-teal-500/25 space-y-3">
          {/* Coordinates & Status */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-teal-400" />
              <span className="text-sm font-bold text-teal-200">تم تحديد الموقع بنجاح</span>
            </div>
            {geocoding && (
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <Loader2 size={12} className="animate-spin" />
                <span>جاري كشف اسم الحي...</span>
              </div>
            )}
          </div>

          {/* Coordinates Display */}
          <div className="flex items-center gap-3 flex-wrap text-[11px] font-mono text-gray-400">
            <span dir="ltr">
              📍 {markerPos[0].toFixed(6)}, {markerPos[1].toFixed(6)}
            </span>
            {googleMapsUrl && (
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-teal-300 hover:text-teal-200 underline transition-colors"
              >
                <ExternalLink size={11} />
                <span>معاينة على Google Maps</span>
              </a>
            )}
          </div>

          {/* Detected District & Street */}
          {(detectedDistrict || detectedStreet) && !geocoding && (
            <div className="pt-2 border-t border-teal-500/15 space-y-1.5">
              {detectedDistrict && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-gray-400">الحي المكتشف:</span>
                  <span className="text-white font-semibold bg-teal-500/15 px-2 py-0.5 rounded-lg">
                    {detectedDistrict}
                  </span>
                </div>
              )}
              {detectedStreet && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-gray-400">الشارع:</span>
                  <span className="text-white font-medium">{detectedStreet}</span>
                </div>
              )}
            </div>
          )}

          {/* Drag hint */}
          <p className="text-[10px] text-gray-500 flex items-center gap-1">
            <Navigation size={10} />
            يمكنك سحب الدبوس لتعديل الموقع بدقة أكبر
          </p>
        </div>
      )}
    </div>
  )
}

export default WaterLocationPicker
