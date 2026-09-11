import { ImageResponse } from 'next/og'

export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export default function OpengraphImage() {
  const title = 'Ginie — Build, Deploy and Scale with AI'
  const subtitle = 'Generate • Deploy • Audit • Orchestrate'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          padding: '64px 72px',
          background: '#000',
          color: '#fff',
          fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif',
        }}
      >
        <div
          style={{
            display: 'block',
            padding: '8px 14px',
            borderRadius: 999,
            background: 'rgba(255,255,255,0.06)',
            fontSize: 24,
            marginBottom: 24,
          }}
        >
          Ginie
        </div>
        <div style={{ fontSize: 80, lineHeight: 1.05, fontWeight: 700, letterSpacing: -1 }}>
          {title}
        </div>
        <div style={{ fontSize: 36, marginTop: 18, opacity: 0.7 }}>{subtitle}</div>
        <div
          style={{
            position: 'absolute',
            right: 72,
            bottom: 72,
            width: 300,
            height: 180,
            borderRadius: 24,
            background: 'linear-gradient(135deg,#ff6d01 0%,#ff8c00 60%,#fbbf24 100%)',
            boxShadow: '0 20px 70px rgba(0,0,0,0.35)'
          }}
        />
      </div>
    ),
    {
      ...size,
    }
  )
}
