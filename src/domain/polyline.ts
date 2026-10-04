/**
 * Google's encoded-polyline format (precision 5, ~1 m). A route of thousands of points becomes a
 * short string, which keeps what is shared through the free database small.
 * Coordinates are GeoJSON order: [lng, lat].
 */
const FACTOR = 1e5;

function encodeValue(value: number): string {
  let v = value < 0 ? ~(value << 1) : value << 1;
  let out = '';
  while (v >= 0x20) {
    out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  return out + String.fromCharCode(v + 63);
}

export function encodePolyline(coordinates: Array<[number, number]>): string {
  let prevLat = 0;
  let prevLng = 0;
  let out = '';
  for (const [lng, lat] of coordinates) {
    const latE5 = Math.round(lat * FACTOR);
    const lngE5 = Math.round(lng * FACTOR);
    out += encodeValue(latE5 - prevLat) + encodeValue(lngE5 - prevLng);
    prevLat = latE5;
    prevLng = lngE5;
  }
  return out;
}

export function decodePolyline(encoded: string): Array<[number, number]> {
  const coordinates: Array<[number, number]> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  const next = (): number => {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length + 1);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };

  while (index < encoded.length) {
    lat += next();
    lng += next();
    coordinates.push([lng / FACTOR, lat / FACTOR]);
  }
  return coordinates;
}
