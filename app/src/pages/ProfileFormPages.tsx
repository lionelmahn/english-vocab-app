import { Camera, Check, Trash } from 'lucide-react'
import { motion } from 'motion/react'
import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Avatar } from '../components/Avatar'
import { BackButton, Chip, Select } from '../components/kit'
import { Button, Card, FormMessage, Page, SectionTitle, TextField } from '../components/ui'
import {
  deviceTimeZone,
  PURPOSES,
  sameTimeZone,
  SELF_LEVELS,
  timeZoneOffset,
  WEEK_ORDER,
  WEEKDAY_SHORT,
  weekdaysLabel,
  type ProfileData,
  type SelfLevel,
} from '../core/profile'
import { resizeAvatar } from '../lib/image'
import { showToast } from '../lib/toast'
import { updateProfile, useProfile } from '../services/profile'
import { useAuth } from '../services/auth'

// ---- Hồ sơ người học (R1.4) ---------------------------------------------------------------------

export function ProfileEditPage() {
  const profile = useProfile()
  return (
    <Page title="Hồ sơ" subtitle="Tên, ảnh, trình độ và mục đích học" back={<BackButton fallback="/me" />}>
      {profile && <ProfileForm profile={profile} />}
    </Page>
  )
}

/** Tách chuỗi mục đích đã lưu thành các mục gợi ý đã chọn và phần tự ghi. */
function splitPurpose(value: string | undefined): { picked: string[]; other: string } {
  const parts = (value ?? '').split(',').map((p) => p.trim()).filter(Boolean)
  return { picked: parts.filter((p) => PURPOSES.includes(p)), other: parts.filter((p) => !PURPOSES.includes(p)).join(', ') }
}

function ProfileForm({ profile }: { profile: ProfileData }) {
  const navigate = useNavigate()
  const auth = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const initial = splitPurpose(profile.learningPurpose)
  const [name, setName] = useState(profile.displayName)
  const [avatar, setAvatar] = useState(profile.avatarUrl)
  const [level, setLevel] = useState<SelfLevel | undefined>(profile.selfLevel)
  const [picked, setPicked] = useState(initial.picked)
  const [other, setOther] = useState(initial.other)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const fallbackName = name || (auth.status === 'signed_in' ? auth.email : 'Bạn')

  async function onPhoto(file: File | undefined) {
    if (!file) return
    setError(null)
    try {
      setAvatar(await resizeAvatar(file))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function save() {
    setBusy(true)
    try {
      const purpose = [...picked, ...other.split(',').map((p) => p.trim())].filter(Boolean).join(', ')
      await updateProfile({ displayName: name, avatarUrl: avatar, selfLevel: level, learningPurpose: purpose || undefined })
      showToast('Đã lưu hồ sơ')
      navigate('/me', { replace: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onPhoto(e.target.files?.[0])} />
      <Card>
        <div className="flex items-center gap-4">
          <Avatar src={avatar} name={fallbackName} size={80} />
          <div className="flex flex-col items-start gap-1">
            <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 text-sm font-semibold text-accent">
              <Camera aria-hidden className="h-4 w-4" /> {avatar ? 'Đổi ảnh' : 'Chọn ảnh đại diện'}
            </button>
            {avatar && (
              <button type="button" onClick={() => setAvatar(undefined)} className="flex items-center gap-1.5 text-sm font-semibold text-muted">
                <Trash aria-hidden className="h-4 w-4" /> Bỏ ảnh
              </button>
            )}
          </div>
        </div>
        <div className="mt-4">
          <TextField label="Tên hiển thị" value={name} maxLength={50} placeholder="Tên bạn muốn app gọi" onChange={(e) => setName(e.target.value)} />
        </div>
        <FormMessage message={error ? { tone: 'error', text: error } : null} />
      </Card>

      <Card>
        <SectionTitle className="mb-1">Trình độ hiện tại</SectionTitle>
        <p className="mb-3 text-sm text-muted">Tự đánh giá; dùng để gợi ý bộ từ và số từ mới phù hợp.</p>
        <div className="flex flex-col gap-2">
          {SELF_LEVELS.map((l) => {
            const on = level === l.value
            return (
              <motion.button
                key={l.value}
                type="button"
                whileTap={{ scale: 0.98 }}
                aria-pressed={on}
                onClick={() => setLevel(on ? undefined : l.value)}
                className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition-colors ${on ? 'border-accent bg-accent-soft' : 'border-line bg-surface'}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold">{l.label}</p>
                  <p className="text-[13px] text-muted">{l.hint}</p>
                </div>
                {on && <Check aria-hidden className="h-5 w-5 shrink-0 text-accent" strokeWidth={2.6} />}
              </motion.button>
            )
          })}
        </div>
      </Card>

      <Card>
        <SectionTitle className="mb-1">Mục đích học</SectionTitle>
        <p className="mb-3 text-sm text-muted">Chọn một hoặc nhiều.</p>
        <div className="flex flex-wrap gap-2">
          {PURPOSES.map((p) => (
            <Chip key={p} active={picked.includes(p)} onClick={() => setPicked((x) => (x.includes(p) ? x.filter((y) => y !== p) : [...x, p]))}>
              {p}
            </Chip>
          ))}
        </div>
        <div className="mt-4">
          <TextField label="Khác" value={other} maxLength={120} placeholder="Ví dụ: đọc truyện, xem phim không phụ đề" onChange={(e) => setOther(e.target.value)} />
        </div>
      </Card>

      <Button variant="primary" className="w-full disabled:opacity-70" disabled={busy} onClick={() => void save()}>
        {busy ? 'Đang lưu…' : 'Lưu hồ sơ'}
      </Button>
    </>
  )
}

// ---- Mục tiêu (R1.5) và lịch học (R9.2) ------------------------------------------------------------

const NEW_WORDS = [5, 10, 15, 20, 30, 50]
const MINUTES = [5, 10, 15, 20, 30, 45, 60]

/** Danh sách múi giờ của trình duyệt (trình duyệt cũ không có thì dùng vài múi giờ phổ biến). */
function timeZones(current: string): string[] {
  let all: string[]
  try {
    all = Intl.supportedValuesOf('timeZone')
  } catch {
    all = ['Asia/Ho_Chi_Minh', 'Asia/Bangkok', 'Asia/Singapore', 'Asia/Tokyo', 'Europe/London', 'America/New_York', 'UTC']
  }
  return [...new Set([current, deviceTimeZone(), ...all])]
}

export function GoalsPage() {
  const profile = useProfile()
  return (
    <Page title="Mục tiêu và lịch học" subtitle="Áp dụng cho mọi thiết bị đã đăng nhập" back={<BackButton fallback="/me" />}>
      {profile && <GoalsForm profile={profile} />}
    </Page>
  )
}

function GoalsForm({ profile }: { profile: ProfileData }) {
  const zones = useMemo(() => timeZones(profile.timeZone), [profile.timeZone])
  const device = deviceTimeZone()
  const days = new Set(profile.studyWeekdays)
  const set = (patch: Partial<ProfileData>) => void updateProfile(patch)

  return (
    <>
      <Card>
        <SectionTitle className="mb-1">Từ mới mỗi ngày</SectionTitle>
        <p className="mb-3 text-sm text-muted">Mục tiêu trên trang Hôm nay và số từ mặc định mỗi buổi học mới.</p>
        <div className="flex flex-wrap gap-2">
          {[...new Set([...NEW_WORDS, profile.dailyNewWords])]
            .sort((a, b) => a - b)
            .map((n) => (
              <Chip key={n} active={profile.dailyNewWords === n} onClick={() => set({ dailyNewWords: n })}>
                {n} từ
              </Chip>
            ))}
        </div>
      </Card>

      <Card>
        <SectionTitle className="mb-1">Thời gian học mỗi ngày</SectionTitle>
        <p className="mb-3 text-sm text-muted">Gồm cả học từ mới và ôn tập.</p>
        <div className="flex flex-wrap gap-2">
          {[...new Set([...MINUTES, profile.dailyMinutes])]
            .sort((a, b) => a - b)
            .map((n) => (
              <Chip key={n} active={profile.dailyMinutes === n} onClick={() => set({ dailyMinutes: n })}>
                {n} phút
              </Chip>
            ))}
        </div>
      </Card>

      <Card>
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <SectionTitle className="">Ngày học trong tuần</SectionTitle>
          <span className="text-sm font-semibold text-accent">{days.size} ngày/tuần</span>
        </div>
        <p className="mb-3 text-sm text-muted">{weekdaysLabel(profile.studyWeekdays)}. Ngày nghỉ vẫn học bình thường nếu bạn muốn.</p>
        <div className="grid grid-cols-7 gap-1.5">
          {WEEK_ORDER.map((d) => {
            const on = days.has(d)
            return (
              <motion.button
                key={d}
                type="button"
                whileTap={{ scale: 0.9 }}
                aria-pressed={on}
                aria-label={d === 0 ? 'Chủ nhật' : `Thứ ${d + 1}`}
                onClick={() => set({ studyWeekdays: on ? profile.studyWeekdays.filter((x) => x !== d) : [...profile.studyWeekdays, d] })}
                className={`flex aspect-square items-center justify-center rounded-2xl border-2 text-sm font-bold transition-colors ${
                  on ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface text-muted'
                }`}
              >
                {WEEKDAY_SHORT[d]}
              </motion.button>
            )
          })}
        </div>
      </Card>

      <Card>
        <SectionTitle className="mb-1">Giờ học</SectionTitle>
        <p className="mb-3 text-sm text-muted">Giờ bạn thường học mỗi ngày. Bật nhắc nhở (Cá nhân → Nhắc nhở) thì app nhắc học vào giờ này.</p>
        <div className="flex items-center gap-3">
          <label className="flex h-12 flex-1 items-center rounded-2xl border border-line bg-surface px-4 focus-within:border-accent">
            <input
              type="time"
              aria-label="Giờ học"
              value={profile.studyTime ?? ''}
              onChange={(e) => set({ studyTime: e.target.value || undefined })}
              className="h-full w-full bg-transparent text-[15px] outline-none"
            />
          </label>
          {profile.studyTime && (
            <Button variant="ghost" className="h-12 px-3" onClick={() => set({ studyTime: undefined })}>
              Bỏ giờ
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <SectionTitle className="mb-1">Múi giờ</SectionTitle>
        <p className="mb-3 text-sm text-muted">Dùng để tính ngày học (bắt đầu lúc 4:00 sáng), chuỗi ngày và giờ nhắc, giống nhau trên mọi thiết bị.</p>
        <Select label="Múi giờ" value={profile.timeZone} onChange={(e) => set({ timeZone: e.target.value })}>
          {zones.map((z) => (
            <option key={z} value={z}>
              {z.replace(/_/g, ' ')} ({timeZoneOffset(z)}){z === device ? ' · máy này' : ''}
            </option>
          ))}
        </Select>
        {!sameTimeZone(profile.timeZone, device) && (
          <button type="button" onClick={() => set({ timeZone: device })} className="mt-2 text-sm font-semibold text-accent">
            Dùng múi giờ của máy này ({device.replace(/_/g, ' ')})
          </button>
        )}
      </Card>
    </>
  )
}
