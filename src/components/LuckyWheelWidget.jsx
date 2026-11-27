import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getWheelStatusApi, spinDemoWheelApi, spinWheelApi } from '../services/wheelApi.js'
import './LuckyWheelWidget.css'

const DEFAULT_SLICES = [
  { index: 0, discountPercent: 5, label: '5%' },
  { index: 1, discountPercent: 12, label: '12%' },
  { index: 2, discountPercent: 8, label: '8%' },
  { index: 3, discountPercent: 20, label: '20%' },
  { index: 4, discountPercent: 10, label: '10%' },
  { index: 5, discountPercent: 16, label: '16%' },
  { index: 6, discountPercent: 15, label: '15%' },
  { index: 7, discountPercent: 18, label: '18%' },
]

// 8 màu nổi bật tương phản tốt với chữ trắng
const SLICE_COLORS = [
  '#ef4444', // Đỏ
  '#f97316', // Cam
  '#eab308', // Vàng
  '#22c55e', // Xanh lá
  '#06b6d4', // Xanh ngọc
  '#3b82f6', // Xanh dương
  '#8b5cf6', // Chàm tím
  '#ec4899', // Hồng
]

// 7 sắc cầu vồng cho icon vòng quay nổi
const RAINBOW_ICON_COLORS = [
  '#ef4444',
  '#f97316',
  '#facc15',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#a855f7',
]

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  }
}

function buildSlicePath(cx, cy, r, startDeg, endDeg) {
  const start = polarToCartesian(cx, cy, r, startDeg)
  const end = polarToCartesian(cx, cy, r, endDeg)
  const largeArcFlag = endDeg - startDeg <= 180 ? '0' : '1'
  return [
    `M ${cx} ${cy}`,
    `L ${start.x.toFixed(2)} ${start.y.toFixed(2)}`,
    `A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`,
    'Z',
  ].join(' ')
}

function playPegTickSound(audioCtxRef) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioCtx()
    }
    const ctx = audioCtxRef.current
    if (ctx.state === 'suspended') {
      ctx.resume()
    }
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(980, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 0.032)
    gain.gain.setValueAtTime(0.08, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.035)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.04)
  } catch {
    // Bỏ qua nếu trình duyệt chặn audio
  }
}

function extractRotationDeg(element) {
  const style = window.getComputedStyle(element)
  const transform = style.transform
  if (!transform || transform === 'none') return 0
  const matrix = new DOMMatrixReadOnly(transform)
  const rad = Math.atan2(matrix.b, matrix.a)
  return ((rad * 180) / Math.PI + 360) % 360
}

function RainbowWheelSvgIcon() {
  const step = 360 / RAINBOW_ICON_COLORS.length
  return (
    <span className="lucky-wheel-fab-spinner" aria-hidden="true">
      <svg className="lucky-wheel-fab-icon" viewBox="0 0 100 100">
        {RAINBOW_ICON_COLORS.map((color, idx) => {
          const start = -90 + idx * step
          const end = start + step
          return (
            <path
              key={color}
              d={buildSlicePath(50, 50, 46, start, end)}
              fill={color}
              stroke="#ffffff"
              strokeWidth="2"
            />
          )
        })}
        <circle cx="50" cy="50" r="14" fill="#ffffff" stroke="#1e293b" strokeWidth="3" />
        <circle cx="50" cy="50" r="6" fill="#f59e0b" />
      </svg>
    </span>
  )
}

function LuckyWheelWidgetInner({ currentUser, token }) {
  const navigate = useNavigate()
  const dismissKey = currentUser ? `mw_wheel_hidden_${currentUser.id}` : 'mw_wheel_hidden_guest'

  const [hidden, setHidden] = useState(() => sessionStorage.getItem(dismissKey) === '1')
  const [modalOpen, setModalOpen] = useState(false)
  const [status, setStatus] = useState(null)
  const [spinning, setSpinning] = useState(false)
  const [hasSpunAnimation, setHasSpunAnimation] = useState(false)
  const [wheelRotation, setWheelRotation] = useState(0)
  const [pointerTicking, setPointerTicking] = useState(false)
  const [wonResult, setWonResult] = useState(null)
  const [spinError, setSpinError] = useState('')
  const [copiedCode, setCopiedCode] = useState(false)

  const rotorRef = useRef(null)
  const audioCtxRef = useRef(null)
  const spinTimerRef = useRef(null)
  const rafRef = useRef(null)
  const tickTimeoutRef = useRef(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (spinTimerRef.current) clearTimeout(spinTimerRef.current)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (tickTimeoutRef.current) clearTimeout(tickTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (!token || !currentUser || currentUser.role !== 'CUSTOMER') {
      return
    }
    const controller = new AbortController()
    getWheelStatusApi(token, { signal: controller.signal })
      .then((data) => {
        if (mountedRef.current) {
          setStatus(data)
        }
      })
      .catch(() => {
        // Không làm phiền UI nếu network tạm gián đoạn
      })
    return () => controller.abort()
  }, [token, currentUser])

  const isStaff = Boolean(currentUser && currentUser.role !== 'CUSTOMER')
  const isUnlimitedDemo = status ? Boolean(status.unlimitedDemo) : true
  const isCustomerLockedOut = Boolean(
    currentUser?.role === 'CUSTOMER' &&
      status &&
      !isUnlimitedDemo &&
      !status.eligible &&
      !wonResult
  )

  if (isStaff || hidden || isCustomerLockedOut) {
    return null
  }

  const slices = status?.slices?.length === 8 ? status.slices : DEFAULT_SLICES
  const canSpin = !spinning && (currentUser ? Boolean(status?.eligible ?? true) : true)

  function handleDismissFab(e) {
    e.stopPropagation()
    sessionStorage.setItem(dismissKey, '1')
    setHidden(true)
    setModalOpen(false)
  }

  function startPegTickTracker() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    let lastSector = -1
    const track = () => {
      if (!rotorRef.current) return
      const deg = extractRotationDeg(rotorRef.current)
      const sector = Math.floor(deg / 45)
      if (lastSector !== -1 && sector !== lastSector) {
        setPointerTicking(true)
        playPegTickSound(audioCtxRef)
        if (tickTimeoutRef.current) clearTimeout(tickTimeoutRef.current)
        tickTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current) setPointerTicking(false)
        }, 70)
      }
      lastSector = sector
      rafRef.current = requestAnimationFrame(track)
    }
    rafRef.current = requestAnimationFrame(track)
  }

  async function handleSpin() {
    if (!canSpin) return
    setSpinError('')
    setCopiedCode(false)
    setSpinning(true)

    try {
      const data = token && currentUser?.role === 'CUSTOMER'
        ? await spinWheelApi(token)
        : await spinDemoWheelApi()

      if (!mountedRef.current) return
      if (!data || typeof data.sliceIndex !== 'number') {
        throw new Error('Phản hồi vòng quay không hợp lệ.')
      }

      const { sliceIndex, discountPercent, voucher, demoOnly } = data
      const sliceCount = slices.length || 8
      const sliceAngle = 360 / sliceCount
      // Tâm ô sliceIndex ban đầu nằm ở góc (sliceIndex * 45 + 22.5) độ theo chiều kim đồng hồ từ 12 giờ
      const sliceCenterDeg = sliceIndex * sliceAngle + sliceAngle / 2
      // Nhiễu ngẫu nhiên nhỏ trong [-11°, +11°] để kim rơi tự nhiên trong lòng ô thưởng, tránh sát vạch chia
      const jitter = (Math.random() - 0.5) * 22
      const targetMod = (((360 - sliceCenterDeg + jitter) % 360) + 360) % 360
      const currentMod = ((wheelRotation % 360) + 360) % 360
      const deltaMod = (targetMod - currentMod + 360) % 360
      const nextRotation = wheelRotation + 7 * 360 + deltaMod

      setHasSpunAnimation(true)
      setWheelRotation(nextRotation)
      startPegTickTracker()

      spinTimerRef.current = setTimeout(() => {
        if (!mountedRef.current) return
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
        setPointerTicking(false)
        setSpinning(false)
        setWonResult({ discountPercent, voucher, demoOnly })
        if (voucher) {
          setStatus((prev) =>
            prev
              ? {
                  ...prev,
                  eligible: Boolean(prev.unlimitedDemo),
                  hasSpunWelcomeWheel: true,
                  vouchers: [voucher, ...(prev.vouchers || [])],
                }
              : prev
          )
        }
      }, 4900)
    } catch (err) {
      if (!mountedRef.current) return
      setSpinning(false)
      setSpinError(err.message || 'Không thể thực hiện lượt quay.')
    }
  }

  function handleCopyCode(code) {
    if (!code) return
    navigator.clipboard?.writeText(code).catch(() => {})
    setCopiedCode(true)
    setTimeout(() => {
      if (mountedRef.current) setCopiedCode(false)
    }, 2000)
  }

  function handleUseNow() {
    setModalOpen(false)
    navigate('/checkout', {
      state: wonResult?.voucher?.code ? { voucherCode: wonResult.voucher.code } : undefined,
    })
  }

  return (
    <>
      {/* Button nổi cố định trên màn hình dù lướt lên hay xuống */}
      <div className="lucky-wheel-fab-wrap">
        {!modalOpen && (
          <span className="lucky-wheel-fab-badge">
            Quay giảm 5%–20%
          </span>
        )}
        <div className="lucky-wheel-fab-shell">
          <button
            type="button"
            className="lucky-wheel-fab-btn"
            aria-label="Mở vòng quay mã giảm giá 5% đến 20%"
            title="Vòng quay may mắn"
            onClick={() => setModalOpen(true)}
          >
            <RainbowWheelSvgIcon />
          </button>
          <button
            type="button"
            className="lucky-wheel-fab-close"
            aria-label="Tắt nút vòng quay may mắn"
            title="Ẩn vòng quay"
            onClick={handleDismissFab}
          >
            ×
          </button>
        </div>
      </div>

      {modalOpen && (
        <div
          className="lucky-wheel-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lucky-wheel-title"
          onClick={() => {
            if (!spinning) setModalOpen(false)
          }}
        >
          <div className="lucky-wheel-modal" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="lucky-wheel-modal-close"
              aria-label="Đóng hộp thoại vòng quay"
              disabled={spinning}
              onClick={() => setModalOpen(false)}
            >
              ×
            </button>

            <h2 id="lucky-wheel-title" className="lucky-wheel-title">
              Vòng Quay May Mắn 5% – 20%
            </h2>
            <p className="lucky-wheel-subtitle">
              Bấm vào nút <strong>&quot;Bấm để quay&quot;</strong> ở giữa tâm vòng quay để nhận ưu đãi giảm giá tổng đơn hàng.
            </p>

            <div
              className={`lucky-wheel-stage${canSpin ? ' is-clickable' : ''}`}
              onClick={canSpin ? handleSpin : undefined}
              title={canSpin ? 'Bấm vào vòng quay để quay' : undefined}
            >
              {/* Kim chỉ thưởng cố định tại vị trí 12 giờ */}
              <svg
                className={`lucky-wheel-pointer${pointerTicking ? ' is-ticking' : ''}`}
                width="36"
                height="44"
                viewBox="0 0 36 44"
                aria-hidden="true"
              >
                <path
                  d="M18 42 L4 12 A14 14 0 1 1 32 12 Z"
                  fill="#fbbf24"
                  stroke="#ffffff"
                  strokeWidth="2.5"
                />
                <circle cx="18" cy="14" r="5" fill="#7c2d12" />
              </svg>

              {/* Đĩa vòng quay 8 ô */}
              <div
                ref={rotorRef}
                className={`lucky-wheel-rotor${hasSpunAnimation ? ' is-animating' : ''}`}
                style={{
                  transform: `rotate(${wheelRotation}deg)`,
                }}
              >
                <svg viewBox="0 0 320 320" width="100%" height="100%">
                  {slices.map((slice, idx) => {
                    const startDeg = -90 + idx * 45
                    const endDeg = startDeg + 45
                    const midDeg = startDeg + 22.5
                    const labelPos = polarToCartesian(160, 160, 102, midDeg)
                    const pegPos = polarToCartesian(160, 160, 148, startDeg)
                    const color = SLICE_COLORS[idx % SLICE_COLORS.length]
                    return (
                      <g key={slice.index}>
                        <path
                          d={buildSlicePath(160, 160, 154, startDeg, endDeg)}
                          fill={color}
                          stroke="#ffffff"
                          strokeWidth="2.2"
                        />
                        <text
                          x={labelPos.x}
                          y={labelPos.y}
                          fill="#ffffff"
                          fontSize="19"
                          fontWeight="800"
                          textAnchor="middle"
                          dominantBaseline="central"
                          transform={`rotate(${midDeg + 90}, ${labelPos.x}, ${labelPos.y})`}
                          style={{ textShadow: '0 2px 4px rgba(0,0,0,0.45)' }}
                        >
                          {slice.label}
                        </text>
                        <circle
                          cx={pegPos.x}
                          cy={pegPos.y}
                          r="4"
                          fill="#fef3c7"
                          stroke="#b45309"
                          strokeWidth="1.5"
                        />
                      </g>
                    )
                  })}
                  <circle
                    cx="160"
                    cy="160"
                    r="154"
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="5"
                  />
                </svg>
              </div>

              {/* Nút tâm vòng quay luôn hiển thị: "Bấm để quay" */}
              <button
                type="button"
                className="lucky-wheel-center-btn"
                disabled={!canSpin}
                onClick={(e) => {
                  e.stopPropagation()
                  handleSpin()
                }}
              >
                {spinning ? (
                  <>
                    <span>Đang</span>
                    <span>quay...</span>
                  </>
                ) : (
                  <>
                    <span>Bấm để</span>
                    <span>quay</span>
                  </>
                )}
              </button>
            </div>

            {spinError && (
              <div className="lucky-wheel-error" role="alert">
                {spinError}
              </div>
            )}

            {wonResult && (
              <div className="lucky-wheel-result-card">
                <div style={{ fontWeight: 700, color: '#a7f3d0', fontSize: '1rem' }}>
                  Chúc mừng! Bạn trúng mức giảm {wonResult.discountPercent}% tổng giá trị đơn hàng
                </div>
                {wonResult.voucher ? (
                  <>
                    <div className="lucky-wheel-code-box">
                      <span className="lucky-wheel-code-text">{wonResult.voucher.code}</span>
                      <button
                        type="button"
                        className="lucky-wheel-copy-btn"
                        onClick={() => handleCopyCode(wonResult.voucher.code)}
                      >
                        {copiedCode ? 'Đã chép' : 'Sao chép mã'}
                      </button>
                    </div>
                    <button
                      type="button"
                      className="lucky-wheel-primary-btn"
                      onClick={handleUseNow}
                    >
                      Áp dụng ngay tại Giỏ hàng / Thanh toán
                    </button>
                  </>
                ) : (
                  <div className="lucky-wheel-info-note">
                    Đang chạy ở chế độ <strong>Demo quay thử</strong> (chưa đăng nhập). Đăng nhập tài khoản khách hàng nếu muốn lưu mã giảm giá vào ví để thanh toán.
                  </div>
                )}
              </div>
            )}

            {!wonResult && (
              <div className="lucky-wheel-info-note">
                {currentUser?.role === 'CUSTOMER'
                  ? 'Chế độ demo: Bạn có thể bấm trực tiếp vào tâm vòng quay để quay thử nhiều lần và nhận mã thật vào ví.'
                  : 'Chế độ demo: Bấm vào nút "Bấm để quay" ở giữa vòng quay để chạy thử hiệu ứng quay thưởng nhiều lần.'}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function LuckyWheelWidget() {
  const { currentUser, token } = useAuth()
  return (
    <LuckyWheelWidgetInner
      key={currentUser?.id ?? 'guest'}
      currentUser={currentUser}
      token={token}
    />
  )
}

export default LuckyWheelWidget
