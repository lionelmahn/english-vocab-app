import { BookMarked, Check, ChevronDown, ChevronRight, GraduationCap, Languages, RotateCcw, Route, Search, Target } from 'lucide-react'
import { motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Badge, BackButton, Chip, SpeakButtons } from '../components/kit'
import { Button, Card, EmptyState, Page, SectionTitle } from '../components/ui'
import {
  COURSE_GROUP_LABEL,
  courseProgress,
  filterCourses,
  fitsLevel,
  lessonProgress,
  passageParts,
  plainPassage,
  wordKey,
  type Cefr,
  type CourseGroup,
  type CourseWord,
  type Lesson,
} from '../core/courses'
import { POS_SHORT } from '../core/pos'
import { foldText } from '../core/vocab'
import { COURSES, type CourseInfo } from '../data/courses'
import type { Library } from '../db/library'
import { repo } from '../db/repo'
import type { ID } from '../db/types'
import { useLibrary } from '../lib/hooks'
import { riseIn } from '../lib/motion'
import { showToast } from '../lib/toast'
import { courseInfo, markLessonKnown, setCurrentLesson, startLesson, useCourse, useWordLookup } from '../services/courses'
import { useProfile } from '../services/profile'

/** Khóa học (R16): danh sách khóa, trang một khóa, trang một bài, thẻ “Khóa học” trên Hôm nay. */

const GROUPS: (CourseGroup | undefined)[] = [undefined, 'foundation', 'communication', 'career', 'exam']
const LEVELS: (Cefr | undefined)[] = [undefined, 'A1', 'A2', 'B1', 'B2', 'C1']
const num = new Intl.NumberFormat('vi-VN')
const levelText = (levels: readonly Cefr[]) => (levels.length > 1 ? `${levels[0]}–${levels[levels.length - 1]}` : levels[0])

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
      <motion.div className="h-full rounded-full bg-accent" initial={{ width: 0 }} animate={{ width: `${Math.min(1, value) * 100}%` }} transition={{ duration: 0.6 }} />
    </div>
  )
}

// ---- Danh sách khóa (R16.1) --------------------------------------------------------------------

export function CoursesPage() {
  const profile = useProfile()
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<CourseGroup | undefined>()
  const [level, setLevel] = useState<Cefr | undefined>()
  const list = filterCourses(COURSES, { group, level, query, fold: foldText })
  // Khóa đã có nội dung lên trước; trong mỗi phần, khóa hợp trình độ của bạn lên trước.
  const sorted = [...list].sort((a, b) => Number(!!b.load) - Number(!!a.load) || Number(fitsLevel(b.levels, profile?.selfLevel)) - Number(fitsLevel(a.levels, profile?.selfLevel)))

  return (
    <Page title="Khóa học" subtitle="Học từ theo chủ đề: mỗi bài có mục tiêu, danh sách từ và một đoạn đọc ngắn" back={<BackButton fallback="/" />}>
      <motion.label variants={riseIn} className="flex h-12 items-center gap-2.5 rounded-2xl border border-line bg-surface px-4 focus-within:border-accent">
        <Search aria-hidden className="h-5 w-5 shrink-0 text-subtle" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm khóa: du lịch, công việc…"
          aria-label="Tìm khóa học"
          autoCapitalize="none"
          className="h-full min-w-0 flex-1 bg-transparent text-[0.9375rem] outline-none placeholder:text-subtle"
        />
      </motion.label>
      <motion.div variants={riseIn} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {GROUPS.map((g) => (
          <Chip key={g ?? 'all'} active={group === g} onClick={() => setGroup(g)}>
            {g ? COURSE_GROUP_LABEL[g] : 'Tất cả'}
          </Chip>
        ))}
      </motion.div>
      <motion.div variants={riseIn} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {LEVELS.map((l) => (
          <Chip key={l ?? 'all'} active={level === l} onClick={() => setLevel(l)}>
            {l ?? 'Mọi trình độ'}
          </Chip>
        ))}
      </motion.div>
      {sorted.map((c) => (
        <CourseCard key={c.id} info={c} fits={fitsLevel(c.levels, profile?.selfLevel)} />
      ))}
      {sorted.length === 0 && <p className="text-sm text-muted">Không có khóa nào khớp. Thử bỏ bớt bộ lọc.</p>}
    </Page>
  )
}

function CourseCard({ info, fits }: { info: CourseInfo; fits: boolean }) {
  const lib = useLibrary()
  const lookup = useWordLookup(lib)
  const course = useCourse(info.load ? info.id : undefined)
  const progress = course ? courseProgress(course, lookup) : undefined
  const body = (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone="accent">{COURSE_GROUP_LABEL[info.group]}</Badge>
        <Badge>{levelText(info.levels)}</Badge>
        {fits && info.load && <Badge tone="warning">Hợp với bạn</Badge>}
        {!info.load && <Badge>Sắp có</Badge>}
      </div>
      <p className="mt-2 text-[1.0625rem] leading-snug font-bold">{info.title}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted">{info.description}</p>
      <p className="mt-2 text-xs font-semibold text-subtle">
        {course ? course.lessons.length : info.lessons} bài · {num.format(info.words)} từ
      </p>
      {progress?.started && (
        <div className="mt-3 flex flex-col gap-1.5">
          <ProgressBar value={progress.learned / Math.max(1, progress.words)} />
          <p className="text-xs text-muted">
            Đã học {num.format(progress.learned)}/{num.format(progress.words)} từ · xong {progress.lessonsDone}/{course!.lessons.length} bài
          </p>
        </div>
      )}
    </>
  )
  if (!info.load) return <motion.div variants={riseIn} className="rounded-3xl border border-dashed border-line bg-surface p-4 opacity-70">{body}</motion.div>
  return (
    <motion.div variants={riseIn}>
      <Link to={`/courses/${info.id}`} className="block rounded-3xl border border-line bg-surface p-4 active:bg-surface-2">
        {body}
      </Link>
    </motion.div>
  )
}

// ---- Một khóa (R16.2, R16.3, R16.5) -------------------------------------------------------------

export function CoursePage() {
  const { courseId } = useParams()
  const navigate = useNavigate()
  const info = courseInfo(courseId)
  const course = useCourse(courseId)
  const lib = useLibrary()
  const lookup = useWordLookup(lib)
  const progress = useMemo(() => (course ? courseProgress(course, lookup) : undefined), [course, lookup])
  const [open, setOpen] = useState<Set<number> | null>(null)

  if (!info) {
    return (
      <Page title="Không tìm thấy khóa" back={<BackButton fallback="/courses" />}>
        <p className="text-sm text-muted">Khóa này không có trong app.</p>
      </Page>
    )
  }
  const back = <BackButton fallback="/courses" />
  if (course === null) {
    return (
      <Page title={info.title} back={back}>
        <EmptyState icon={Route} title="Khóa này sắp có" body={info.description} />
      </Page>
    )
  }
  if (!course || !progress || !lib) return <Page title={info.title} back={back}>{null}</Page>

  // Mặc định mở chương có bài nên học tiếp.
  const openSet = open ?? new Set([progress.next?.chapter ?? 0])
  const toggle = (i: number) => setOpen(() => {
    const next = new Set(openSet)
    if (next.has(i)) next.delete(i)
    else next.add(i)
    return next
  })
  const go = (lesson: Lesson) => {
    void setCurrentLesson(info, lesson)
    navigate(`/courses/${info.id}/${lesson.no}`)
  }

  return (
    <Page title={info.title} subtitle={`${COURSE_GROUP_LABEL[info.group]} · ${levelText(info.levels)} · ${course.lessons.length} bài · ${num.format(progress.words)} từ`} back={back}>
      <Card>
        <p className="text-sm leading-relaxed text-muted">{info.description}</p>
        <div className="mt-3 flex flex-col gap-1.5">
          <ProgressBar value={progress.learned / Math.max(1, progress.words)} />
          <p className="text-xs text-muted">
            Đã học {num.format(progress.learned)}/{num.format(progress.words)} từ · xong {progress.lessonsDone}/{course.lessons.length} bài
          </p>
        </div>
        {progress.next ? (
          <Button variant="primary" icon={GraduationCap} className="mt-4 h-auto! min-h-12 w-full py-2 whitespace-normal!" onClick={() => go(progress.next!)}>
            {progress.started ? `Học tiếp: Bài ${progress.next.no} · ${progress.next.title}` : 'Bắt đầu khóa'}
          </Button>
        ) : (
          <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-accent">
            <Check aria-hidden className="h-4 w-4" /> Bạn đã học xong mọi bài của khóa này.
          </p>
        )}
      </Card>

      {course.chapters.map((ch, ci) => {
        const done = ch.lessons.filter((l) => lessonProgress(l, lookup).done).length
        const isOpen = openSet.has(ci)
        return (
          <motion.section key={ci} variants={riseIn} className="rounded-3xl border border-line bg-surface p-1.5">
            <button type="button" onClick={() => toggle(ci)} aria-expanded={isOpen} className="flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left active:bg-surface-2">
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold tracking-wide text-subtle uppercase">Chương {ci + 1}</span>
                <span className="block text-[0.9375rem] font-bold">{ch.title}</span>
              </span>
              <span className="shrink-0 text-xs font-semibold text-muted tabular-nums">
                {done}/{ch.lessons.length} bài
              </span>
              <ChevronDown aria-hidden className={`h-5 w-5 shrink-0 text-subtle transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
              <ul className="flex flex-col">
                {ch.lessons.map((l) => {
                  const p = lessonProgress(l, lookup)
                  return (
                    <li key={l.no}>
                      <button type="button" onClick={() => go(l)} className="flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left active:bg-surface-2">
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ${p.done ? 'bg-accent text-on-accent' : 'bg-surface-2 text-muted'}`}
                        >
                          {p.done ? <Check aria-hidden className="h-4 w-4" strokeWidth={3} /> : l.no}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[0.9375rem] leading-snug font-semibold">{l.title}</span>
                          <span className="block text-xs text-muted">
                            {p.done ? 'Hoàn thành' : p.learned > 0 ? `Đã học ${p.learned}/${p.total} từ` : `${p.total} từ`}
                          </span>
                        </span>
                        {progress.next?.no === l.no && <Badge tone="warning">Học tiếp</Badge>}
                        <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-subtle" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </motion.section>
        )
      })}
      {info.attribution && <p className="mt-2 text-xs leading-relaxed text-subtle">{info.attribution}</p>}
    </Page>
  )
}

// ---- Một bài (R16.4, R16.6) ---------------------------------------------------------------------

export function LessonPage() {
  const { courseId, lessonNo } = useParams()
  const navigate = useNavigate()
  const info = courseInfo(courseId)
  const course = useCourse(courseId)
  const lib = useLibrary()
  const lookup = useWordLookup(lib)
  const lesson = course?.lessons[Number(lessonNo) - 1]
  const [picked, setPicked] = useState<{ no: number; keys: Set<string> } | null>(null)
  const [showVi, setShowVi] = useState(false)
  const [focus, setFocus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [undo, setUndo] = useState<{ no: number; ids: ID[] } | null>(null)

  const back = <BackButton fallback={info ? `/courses/${info.id}` : '/courses'} />
  if (!info || course === null || (course && !lesson)) {
    return (
      <Page title="Không tìm thấy bài" back={back}>
        <p className="text-sm text-muted">Bài này không có trong khóa.</p>
      </Page>
    )
  }
  if (!course || !lesson || !lib) return <Page title="Bài học" back={back}>{null}</Page>

  const progress = lessonProgress(lesson, lookup)
  const state = (w: CourseWord) => lookup(w.term, w.partOfSpeech)
  // Mặc định chọn mọi từ chưa học; từ đã học không chọn được.
  const keys = picked?.no === lesson.no ? picked.keys : new Set(lesson.words.filter((w) => !state(w)?.learned).map((w) => wordKey(w.term, w.partOfSpeech)))
  const chosen = lesson.words.filter((w) => keys.has(wordKey(w.term, w.partOfSpeech)) && !state(w)?.learned)
  const toggle = (w: CourseWord) => {
    const next = new Set(keys)
    const k = wordKey(w.term, w.partOfSpeech)
    if (next.has(k)) next.delete(k)
    else next.add(k)
    setPicked({ no: lesson.no, keys: next })
  }
  const focusWord = focus ? lesson.words.find((w) => w.term.toLowerCase() === focus.toLowerCase()) : undefined
  const nextLesson = course.lessons[lesson.no]
  const prevLesson = course.lessons[lesson.no - 2]

  async function learn() {
    if (!info || !lesson || busy) return
    setBusy(true)
    try {
      if (await startLesson(info, lesson, chosen, lookup)) navigate('/study')
      else showToast('Các từ đã chọn đều đã học')
    } finally {
      setBusy(false)
    }
  }
  async function known() {
    if (!info || !lesson || busy) return
    setBusy(true)
    try {
      const ids = await markLessonKnown(info, lesson, chosen, lookup)
      setUndo({ no: lesson.no, ids })
      setPicked(null)
      showToast(`Đã đánh dấu ${ids.length} từ là đã biết`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page title={`Bài ${lesson.no}: ${lesson.title}`} subtitle={`${info.title} · Chương ${lesson.chapter + 1}: ${course.chapters[lesson.chapter].title}`} back={back}>
      <Card>
        <p className="flex gap-2.5 text-[0.9375rem] leading-relaxed">
          <Target aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
          <span>{lesson.goal}</span>
        </p>
        <div className="mt-3 flex flex-col gap-1.5">
          <ProgressBar value={progress.learned / Math.max(1, progress.total)} />
          <p className="text-xs text-muted">{progress.done ? 'Hoàn thành: mọi từ của bài đã học' : `Đã học ${progress.learned}/${progress.total} từ`}</p>
        </div>
      </Card>

      {lesson.passage && (
        <Card>
          <div className="mb-3 flex items-center justify-between gap-2">
            <SectionTitle className="">Đoạn đọc</SectionTitle>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setShowVi((v) => !v)} aria-pressed={showVi} className="flex items-center gap-1.5 text-sm font-semibold text-accent">
                <Languages aria-hidden className="h-4 w-4" /> {showVi ? 'Ẩn bản dịch' : 'Bản dịch'}
              </button>
              <SpeakButtons text={plainPassage(lesson.passage)} size="sm" />
            </div>
          </div>
          <p className="text-[1.0625rem] leading-loose">
            {passageParts(lesson.passage).map((part, i) =>
              part.term ? (
                <button
                  key={i}
                  type="button"
                  data-sfx="select"
                  onClick={() => setFocus(part.term)}
                  aria-pressed={focus?.toLowerCase() === part.term.toLowerCase()}
                  className={`rounded-md px-0.5 font-semibold text-accent underline decoration-dotted underline-offset-4 ${focus?.toLowerCase() === part.term.toLowerCase() ? 'bg-accent-soft' : ''}`}
                >
                  {part.text}
                </button>
              ) : (
                <span key={i}>{part.text}</span>
              ),
            )}
          </p>
          {focusWord && (
            <div className="mt-3 flex items-start gap-3 rounded-2xl bg-surface-2 px-3.5 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[0.9375rem]">
                  <b>{focusWord.term}</b> <span className="text-xs font-semibold text-muted">{POS_SHORT[focusWord.partOfSpeech]}</span>{' '}
                  {focusWord.ipaUs && <span className="text-sm text-muted">{focusWord.ipaUs}</span>}
                </p>
                <p className="text-sm">{focusWord.meaningVi}</p>
              </div>
              <SpeakButtons text={focusWord.term} size="sm" />
            </div>
          )}
          {showVi && <p className="mt-3 text-sm leading-relaxed text-muted italic">{lesson.passageVi}</p>}
          <p className="mt-2 text-xs text-subtle">Chạm từ tô xanh để xem nghĩa.</p>
        </Card>
      )}

      <Card className="p-2">
        <div className="flex items-center justify-between px-2 pt-1 pb-2">
          <SectionTitle className="">Từ trong bài ({lesson.words.length})</SectionTitle>
          <span className="text-xs text-muted">Chọn từ muốn học</span>
        </div>
        <ul className="flex flex-col">
          {lesson.words.map((w) => {
            const s = state(w)
            const on = keys.has(wordKey(w.term, w.partOfSpeech))
            return (
              <li key={wordKey(w.term, w.partOfSpeech)} className="flex items-center gap-2">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={s?.learned ? true : on}
                  disabled={s?.learned}
                  data-sfx="select"
                  onClick={() => toggle(w)}
                  className="flex min-w-0 flex-1 items-start gap-3 rounded-2xl px-2 py-2.5 text-left active:bg-surface-2 disabled:active:bg-transparent"
                >
                  <span
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 ${
                      s?.learned ? 'border-accent bg-accent-soft text-accent' : on ? 'border-accent bg-accent text-on-accent' : 'border-line'
                    }`}
                  >
                    {(s?.learned || on) && <Check aria-hidden className="h-4 w-4" strokeWidth={3} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.9375rem]">
                      <b>{w.term}</b> <span className="text-xs font-semibold text-muted">{POS_SHORT[w.partOfSpeech]}</span>
                      {w.ipaUs && <span className="ml-1.5 text-xs text-muted">{w.ipaUs}</span>}
                    </span>
                    <span className="block text-sm leading-snug text-muted">{w.meaningVi}</span>
                  </span>
                  {s?.learned ? <Badge tone="accent">Đã học</Badge> : s ? <Badge>Trong sổ tay</Badge> : null}
                </button>
                <SpeakButtons text={w.term} size="sm" slow={false} />
              </li>
            )
          })}
        </ul>
      </Card>

      {!progress.done && (
        <div className="flex flex-col gap-2">
          <Button variant="primary" icon={GraduationCap} disabled={busy || chosen.length === 0} onClick={() => void learn()}>
            {chosen.length ? `Học ${chosen.length} từ đã chọn` : 'Chọn từ muốn học'}
          </Button>
          <Button icon={Check} disabled={busy || chosen.length === 0} onClick={() => void known()}>
            Mình đã biết {chosen.length || ''} từ này
          </Button>
          <p className="px-1 text-xs leading-relaxed text-subtle">
            “Học” lưu từ vào sổ tay (bộ “Khóa: {info.title}”) rồi mở buổi học từ mới. “Mình đã biết” lưu từ và hẹn ôn lại sau vài ngày, không cần học.
          </p>
        </div>
      )}
      {undo?.no === lesson.no && undo.ids.length > 0 && (
        <button
          type="button"
          onClick={async () => {
            await repo.resetProgress(undo.ids)
            setUndo(null)
            showToast('Đã hoàn tác')
          }}
          className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-accent"
        >
          <RotateCcw aria-hidden className="h-4 w-4" /> Hoàn tác đánh dấu đã biết ({undo.ids.length} từ)
        </button>
      )}

      <div className="flex flex-col gap-2 pt-1">
        {nextLesson && (
          <Link to={`/courses/${info.id}/${nextLesson.no}`} className="flex items-center gap-3 rounded-3xl border border-line bg-surface px-4 py-3.5 active:bg-surface-2">
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-subtle">Bài tiếp theo</span>
              <span className="block text-[0.9375rem] font-semibold">
                Bài {nextLesson.no}: {nextLesson.title}
              </span>
            </span>
            <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-subtle" />
          </Link>
        )}
        {prevLesson && (
          <Link to={`/courses/${info.id}/${prevLesson.no}`} className="px-1 text-sm font-semibold text-muted">
            ← Bài {prevLesson.no}: {prevLesson.title}
          </Link>
        )}
      </div>
    </Page>
  )
}

// ---- Thẻ trên Hôm nay (R16.3) --------------------------------------------------------------------

export function TodayCourseCard({ lib }: { lib: Library }) {
  const navigate = useNavigate()
  const profile = useProfile()
  const info = courseInfo(profile?.course?.id)
  const course = useCourse(info?.id)
  const lookup = useWordLookup(lib)
  if (!info || !course) {
    return (
      <Link to="/courses" className="flex items-center gap-3 rounded-3xl border border-line bg-surface px-4 py-3.5 active:bg-surface-2">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <BookMarked aria-hidden className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.9375rem] font-semibold">Khóa học theo chủ đề</span>
          <span className="block text-[0.8125rem] leading-snug text-muted">Học từ theo bài, mỗi bài có đoạn đọc ngắn và lộ trình rõ ràng</span>
        </span>
        <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-subtle" />
      </Link>
    )
  }
  const progress = courseProgress(course, lookup)
  const next = progress.next
  return (
    <Card>
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-subtle">
            <BookMarked aria-hidden className="h-3.5 w-3.5" /> Khóa học
          </p>
          <p className="leading-snug font-bold">{info.title}</p>
          <p className="truncate text-sm text-muted">{next ? `Bài ${next.no}: ${next.title}` : 'Đã học xong mọi bài'}</p>
          <div className="mt-2">
            <ProgressBar value={progress.learned / Math.max(1, progress.words)} />
          </div>
        </div>
        <Button className="shrink-0 px-4" onClick={() => navigate(next ? `/courses/${info.id}/${next.no}` : `/courses/${info.id}`)}>
          {next ? 'Học tiếp' : 'Xem'}
        </Button>
      </div>
      <Link to="/courses" className="mt-3 inline-block text-sm font-semibold text-accent">
        Xem các khóa khác
      </Link>
    </Card>
  )
}
