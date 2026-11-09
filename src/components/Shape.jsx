// Cada nível tem forma e cor próprias, para ler sem depender da cor.
const SHAPES = {
  sem: (stroke, sw) => <circle r="7" fill="#7FA392" stroke={stroke} strokeWidth={sw} />,
  amarelo: (stroke, sw) => <path d="M0 -9 L9 0 L0 9 L-9 0 Z" fill="#F2C230" stroke={stroke} strokeWidth={sw} />,
  laranja: (stroke, sw) => <rect x="-7" y="-7" width="14" height="14" rx="1.5" fill="#E8741F" stroke={stroke} strokeWidth={sw} />,
  vermelho: (stroke, sw) => <path d="M0 -9 L9 7 L-9 7 Z" fill="#C8382E" stroke={stroke} strokeWidth={sw} />,
  info: (stroke, sw) => (
    <>
      <circle r="9" fill="none" stroke={stroke} strokeWidth={sw} />
      <path d="M0 -1 V5 M0 -5 V-4" stroke={stroke} strokeWidth={sw + 0.5} strokeLinecap="round" />
    </>
  ),
}

export default function Shape({ level, size = 20, stroke = '#0F1B26', strokeWidth = 1.5 }) {
  const draw = SHAPES[level] || SHAPES.info
  return (
    <svg width={size} height={size} viewBox="-12 -12 24 24" aria-hidden="true" focusable="false">
      {draw(stroke, strokeWidth)}
    </svg>
  )
}
