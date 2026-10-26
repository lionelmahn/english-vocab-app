import { useLiveQuery } from 'dexie-react-hooks'
import { BookOpenCheck, Check, GraduationCap, LogIn } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Buddy } from '../components/Buddy'
import { BackButton, Chip, Segmented } from '../components/kit'
import { Button, Card, Page, SectionTitle } from '../components/ui'
import { PURPOSES, SELF_LEVELS, WEEK_ORDER, WEEKDAY_SHORT, weekdaysLabel, type ProfileData } from '../core/profile'
import { STARTER_DECKS, type StarterDeck } from '../data/starter'
import { db } from '../db/db'
import { repo } from '../db/repo'
import { duration, ease } from '../lib/motion'
import { showToast } from '../lib/toast'
import { useAuth } from '../services/auth'
import { updateProfile, useProfile } from '../services/profile'
import { isCloudConfigured } from '../services/supabase'
import { markWelcomeDone } from '../lib/welcome'

const num = new Intl.NumberFormat('vi-VN')

// ---- Thêm bộ từ có sẵn ---------------------------------------------------------------------------

/** Thêm một bộ từ khởi đầu vào sổ tay (tải nội dung khi cần). Trả về mã bộ, hoặc null nếu lỗi. */
function useAddStarter() {
  const [adding, setAdding] = useState<string | null>(null)
  async function add(deck: StarterDeck): Promise<string | null> {
    setAdding(deck.id)
    try {
      const res = await repo.addStarterDeck(deck.name, await deck.load())
      showToast(res.created > 0 ? `Đã thêm ${num.format(res.created)} từ vào bộ “${deck.name}”` : `Bộ “${deck.name}” đã có đủ từ`)
      return res.deckId
    } catch (e) {
      showToast(`Không thêm được bộ từ: ${(e as Error).message}`)
      return null
    } finally {
      setAdding(null)
    }
  }
  return { adding, add }
}

/** Bộ cùng tên đã có trong sổ tay (và số từ trong bộ). */
function useExistingDecks() {
  return useLiveQuery(async () => {
    const decks = (await db.decks.toArray()).filter((d) => d.deletedAt === null)
    const links = (await db.deckItems.toArray()).filter((l) => l.deletedAt === null)
    return new Map(
      STARTER_DECKS.map((s) => {
        const d = decks.find((x) => x.name.trim().toLowerCase() === s.name.toLowerCase())
        return [s.id, d ? { id: d.id, count: links.filter((l) => l.deckId === d.id).length } : null] as const
      }),
    )
  }, [])
}

/** Thư viện bộ từ có sẵn (R1.7): thêm bất cứ lúc nào, không chỉ lúc thiết lập lần đầu. */
export function StarterDecksPage() {
  const navigate = useNavigate()
  const existing = useExistingDecks()
  const { adding, add } = useAddStarter()

  return (
    <Page title="Bộ từ có sẵn" subtitle="Thêm vào sổ tay để học ngay" back={<BackButton fallback="/notebook/decks" />}>
      {STARTER_DECKS.map((deck) => {
        const have = existing?.get(deck.id)
        const busy = adding === deck.id
        return (
          <Card key={deck.id}>
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-soft">
                <BookOpenCheck aria-hidden className="h-6 w-6 text-accent" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[1rem] font-semibold">{deck.name}</p>
                <p className="text-[0.8125rem] text-muted">{num.format(deck.count)} từ{have ? ` · đã có trong sổ tay (${num.format(have.count)} từ)` : ''}</p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted">{deck.description}</p>
            <div className="mt-4 flex flex-col gap-2">
              {have ? (
                <>
                  <Button variant="primary" className="w-full" onClick={() => navigate(`/decks/${have.id}`)}>
                    Mở bộ từ
                  </Button>
                  {have.count < deck.count && (
                    <Button className="w-full disabled:opacity-70" disabled={busy} onClick={() => void add(deck)}>
                      {busy ? 'Đang thêm…' : 'Thêm các từ còn thiếu'}
                    </Button>
                  )}
                </>
              ) : (
                <Button
                  variant="primary"
                  className="w-full disabled:opacity-70"
                  disabled={busy}
                  onClick={async () => {
                    const id = await add(deck)
                    if (id) navigate(`/decks/${id}`, { replace: true })
                  }}
                >
                  {busy ? `Đang thêm ${num.format(deck.count)} từ…` : 'Thêm vào sổ tay'}
                </Button>
              )}
            </div>
            <p className="mt-3 text-[0.6875rem] leading-relaxed text-subtle">{deck.attribution}</p>
          </Card>
        )
      })}
      <p className="px-1 text-xs leading-relaxed text-subtle">
        Từ đã có trong sổ tay (cùng từ, loại từ, nghĩa) không bị thêm trùng. Khi học, từ nào bạn đã biết thì chọn “Mình đã biết từ này” để app bỏ qua.
      </p>
    </Page>
  )
}

// ---- Thiết lập lần đầu (R1.7) ---------------------------------------------------------------------

const STEPS = 5
const NEW_WORDS = [5, 10, 15, 20, 30]
const MINUTES = [5, 10, 15, 20, 30, 45, 60]

export function WelcomePage() {
  const profile = useProfile()
  if (!profile) return null
  return <Welcome profile={profile} />
}

function Welcome({ profile }: { profile: ProfileData }) {
  const navigate = useNavigate()
  const auth = useAuth()
  // Quay về từ bài kiểm tra trình độ: tiếp tục ở bước sau bước Trình độ.
  const resume = (useLocation().state as { step?: number } | null)?.step
  const [step, setStep] = useState(resume ?? 0)
  const [dir, setDir] = useState(1)
  const deck = STARTER_DECKS[0]
  const [withDeck, setWithDeck] = useState(true)
  const { adding, add } = useAddStarter()
  const purposes = (profile.learningPurpose ?? '').split(',').map((p) => p.trim()).filter(Boolean)
  const days = new Set(profile.studyWeekdays)
  const set = (patch: Partial<ProfileData>) => void updateProfile(patch)

  function go(next: number) {
    setDir(next > step ? 1 : -1)
    setStep(next)
  }

  function skip() {
    markWelcomeDone()
    navigate('/', { replace: true })
  }

  async function finish() {
    if (withDeck && !(await add(deck))) return
    markWelcomeDone()
    navigate('/', { replace: true })
  }

  return (
    <div className="flex min-h-dvh flex-col px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5" aria-label={`Bước ${step + 1} trên ${STEPS}`}>
          {Array.from({ length: STEPS }, (_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i <= step ? 'w-6 bg-accent' : 'w-3 bg-line'}`} />
          ))}
        </div>
        <button type="button" onClick={skip} className="h-10 px-2 text-sm font-semibold text-muted">
          Bỏ qua
        </button>
      </div>

      <AnimatePresence mode="popLayout" initial={false} custom={dir}>
        <motion.div
          key={step}
          custom={dir}
          initial={{ opacity: 0, x: dir * 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: dir * -40 }}
          transition={{ duration: duration.base, ease: ease.out }}
          className="flex flex-1 flex-col gap-4 pt-6"
        >
          {step === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
              <Buddy size={110} mood="cheer" />
              <h1 className="text-[1.625rem] leading-tight font-bold">Chào bạn!</h1>
              <p className="max-w-xs text-[0.9375rem] leading-relaxed text-muted">
                Vài bước ngắn để app hợp với bạn: trình độ, mục tiêu, lịch học và một bộ từ để bắt đầu ngay.
              </p>
              {isCloudConfigured && auth.status === 'signed_out' && (
                <Button variant="ghost" icon={LogIn} onClick={() => navigate('/login')}>
                  Tôi đã có tài khoản
                </Button>
              )}
            </div>
          )}

          {step === 1 && (
            <>
              <h1 className="text-[1.5rem] leading-tight font-bold">Trình độ và mục đích</h1>
              <button
                type="button"
                onClick={() => navigate('/placement', { state: { from: 'welcome' } })}
                className="flex items-center gap-3 rounded-2xl bg-accent-soft px-4 py-3 text-left text-accent"
              >
                <GraduationCap aria-hidden className="h-5 w-5 shrink-0" />
                <span className="min-w-0 flex-1 text-sm font-semibold">Chưa chắc trình độ? Làm bài kiểm tra khoảng 5 phút</span>
              </button>
              <div className="flex flex-col gap-2">
                {SELF_LEVELS.map((l) => {
                  const on = profile.selfLevel === l.value
                  return (
                    <button
                      key={l.value}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set({ selfLevel: l.value })}
                      className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-2.5 text-left transition-colors ${on ? 'border-accent bg-accent-soft' : 'border-line bg-surface'}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[0.9375rem] font-semibold">{l.label}</p>
                        <p className="text-[0.8125rem] text-muted">{l.hint}</p>
                      </div>
                      {on && <Check aria-hidden className="h-5 w-5 shrink-0 text-accent" strokeWidth={2.6} />}
                    </button>
                  )
                })}
              </div>
              <SectionTitle className="mt-1">Bạn học tiếng Anh để…</SectionTitle>
              <div className="flex flex-wrap gap-2">
                {PURPOSES.map((p) => (
                  <Chip
                    key={p}
                    active={purposes.includes(p)}
                    onClick={() => set({ learningPurpose: (purposes.includes(p) ? purposes.filter((x) => x !== p) : [...purposes, p]).join(', ') || undefined })}
                  >
                    {p}
                  </Chip>
                ))}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="text-[1.5rem] leading-tight font-bold">Mục tiêu mỗi ngày</h1>
              <SectionTitle className="">Số từ mới</SectionTitle>
              <div className="flex flex-wrap gap-2">
                {NEW_WORDS.map((n) => (
                  <Chip key={n} active={profile.dailyNewWords === n} onClick={() => set({ dailyNewWords: n })}>
                    {n} từ
                  </Chip>
                ))}
              </div>
              <SectionTitle className="mt-2">Thời gian học (gồm cả ôn tập)</SectionTitle>
              <div className="flex flex-wrap gap-2">
                {MINUTES.map((n) => (
                  <Chip key={n} active={profile.dailyMinutes === n} onClick={() => set({ dailyMinutes: n })}>
                    {n} phút
                  </Chip>
                ))}
              </div>
              <p className="text-sm text-muted">Bắt đầu vừa sức rồi tăng dần. Đổi lúc nào cũng được trong Cá nhân.</p>
            </>
          )}

          {step === 3 && (
            <>
              <h1 className="text-[1.5rem] leading-tight font-bold">Giọng và lịch học</h1>
              <SectionTitle className="">Giọng đọc</SectionTitle>
              <Segmented
                layoutId="welcome-accent"
                value={profile.accent}
                onChange={(v) => set({ accent: v })}
                options={[
                  { value: 'us', label: 'Anh–Mỹ' },
                  { value: 'uk', label: 'Anh–Anh' },
                ]}
              />
              <SectionTitle className="mt-2">Ngày học · {weekdaysLabel(profile.studyWeekdays)}</SectionTitle>
              <div className="grid grid-cols-7 gap-1.5">
                {WEEK_ORDER.map((d) => {
                  const on = days.has(d)
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={on}
                      aria-label={d === 0 ? 'Chủ nhật' : `Thứ ${d + 1}`}
                      onClick={() => set({ studyWeekdays: on ? profile.studyWeekdays.filter((x) => x !== d) : [...profile.studyWeekdays, d] })}
                      className={`flex aspect-square items-center justify-center rounded-2xl border-2 text-sm font-bold transition-colors ${
                        on ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface text-muted'
                      }`}
                    >
                      {WEEKDAY_SHORT[d]}
                    </button>
                  )
                })}
              </div>
              <SectionTitle className="mt-2">Giờ học (không bắt buộc)</SectionTitle>
              <label className="flex h-12 items-center rounded-2xl border border-line bg-surface px-4 focus-within:border-accent">
                <input
                  type="time"
                  aria-label="Giờ học"
                  value={profile.studyTime ?? ''}
                  onChange={(e) => set({ studyTime: e.target.value || undefined })}
                  className="h-full w-full bg-transparent text-[0.9375rem] outline-none"
                />
              </label>
            </>
          )}

          {step === 4 && (
            <>
              <h1 className="text-[1.5rem] leading-tight font-bold">Bộ từ để bắt đầu</h1>
              <button
                type="button"
                aria-pressed={withDeck}
                onClick={() => setWithDeck((v) => !v)}
                className={`flex items-start gap-3 rounded-3xl border-2 p-4 text-left transition-colors ${withDeck ? 'border-accent bg-accent-soft' : 'border-line bg-surface'}`}
              >
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${withDeck ? 'border-accent bg-accent text-on-accent' : 'border-line'}`}
                >
                  {withDeck && <Check aria-hidden className="h-4 w-4" strokeWidth={3} />}
                </span>
                <span className="min-w-0">
                  <span className="block text-[1rem] font-semibold">{deck.name}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-muted">{deck.description}</span>
                </span>
              </button>
              <p className="text-sm leading-relaxed text-muted">
                Mỗi ngày app đưa ra {profile.dailyNewWords} từ mới theo thứ tự phổ biến. Từ nào đã biết, chọn “Mình đã biết từ này” khi học để bỏ qua. Bạn cũng có thể tự thêm từ, nhập từ file hoặc tra từ để lưu.
              </p>
              <p className="text-[0.6875rem] leading-relaxed text-subtle">{deck.attribution}</p>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="flex flex-col gap-2 pt-4">
        {step < STEPS - 1 ? (
          <Button variant="primary" className="w-full" onClick={() => go(step + 1)}>
            {step === 0 ? 'Bắt đầu' : 'Tiếp tục'}
          </Button>
        ) : (
          <Button variant="primary" className="w-full disabled:opacity-70" disabled={!!adding} onClick={() => void finish()}>
            {adding ? `Đang thêm ${num.format(deck.count)} từ…` : withDeck ? 'Hoàn tất và thêm bộ từ' : 'Hoàn tất'}
          </Button>
        )}
        {step > 0 && (
          <Button variant="ghost" className="w-full" disabled={!!adding} onClick={() => go(step - 1)}>
            Quay lại
          </Button>
        )}
      </div>
    </div>
  )
}
