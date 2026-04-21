import { ImageResponse } from 'next/og'

// Maskable icon: Android adaptive launchers clip the image into arbitrary
// shapes (circle, squircle, rounded square). Spec requires the visible
// content to fit inside a centered circle of ~80% the image side.
// So no borderRadius, opaque background edge-to-edge, and a smaller glyph.
export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 240,
          background: '#0a0a0a',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fafafa',
          fontWeight: 700,
          fontFamily: 'sans-serif',
        }}
      >
        A
      </div>
    ),
    { width: 512, height: 512 },
  )
}
