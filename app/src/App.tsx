import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Route, Routes, useLocation, useNavigate } from 'react-router'
import { TabBar } from './components/TabBar'
import { Toaster } from './components/kit'
import { pageTransition, pageVariants } from './lib/motion'
import { useSettings } from './lib/settings'
import { isFocusMode, tabIndexOf } from './lib/tabs'
import { DeckAddWordsPage, DeckDetailPage, DeckFormPage } from './pages/DeckPages'
import { ImportPage } from './pages/ImportPage'
import { LoginPage } from './pages/LoginPage'
import { LookupPage } from './pages/LookupPage'
import { NotebookPage } from './pages/NotebookPage'
import { ProfilePage } from './pages/ProfilePage'
import { VoiceClipsPage } from './pages/VoiceClipsPage'
import { VoiceClipBar } from './components/VoiceClip'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { StatsPage } from './pages/StatsPage'
import { StudyPage } from './pages/StudyPage'
import { TodayPage } from './pages/TodayPage'
import { WordDetailPage } from './pages/WordDetailPage'
import { WordFormPage } from './pages/WordFormPage'
import { openedFromRecoveryLink, startAuth } from './services/auth'
import { startSync } from './services/sync'
import { usePending } from './services/voiceClips'

function depthOf(pathname: string): number {
  return pathname.split('/').filter(Boolean).length
}

export default function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const { reduceMotion } = useSettings()
  const index = tabIndexOf(location.pathname)
  const depth = depthOf(location.pathname)
  const focus = isFocusMode(location.pathname)
  // Thanh "Dán âm thanh" nổi phía dưới: chừa chỗ để không che nội dung cuối trang.
  const clipBar = !!usePending() && location.pathname !== '/voice'

  useEffect(() => {
    const toReset = () => navigate('/reset-password', { replace: true })
    if (openedFromRecoveryLink) toReset()
    startAuth(toReset)
    startSync()
  }, [navigate])

  // Hướng trượt: đổi tab thì theo thứ tự tab; cùng tab thì đi sâu trượt từ phải, quay lại trượt từ trái.
  const [nav, setNav] = useState({ path: location.pathname, index, depth, direction: 0 })
  if (nav.path !== location.pathname) {
    const direction = index !== nav.index ? (index > nav.index ? 1 : -1) : depth !== nav.depth ? (depth > nav.depth ? 1 : -1) : 0
    setNav({ path: location.pathname, index, depth, direction })
  }

  useEffect(() => {
    document.documentElement.dataset.reduceMotion = String(reduceMotion)
  }, [reduceMotion])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <MotionConfig reducedMotion={reduceMotion ? 'always' : 'user'}>
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
        <main
          className={`relative flex-1 overflow-x-clip ${
            focus ? (clipBar ? 'pb-36' : '') : clipBar ? 'pb-[calc(13.5rem+env(safe-area-inset-bottom))]' : 'pb-[calc(4.75rem+env(safe-area-inset-bottom))]'
          }`}
        >
          <AnimatePresence mode="popLayout" initial={false} custom={nav.direction}>
            <motion.div
              key={location.pathname}
              custom={nav.direction}
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={pageTransition}
              className="w-full"
            >
              <Routes location={location}>
                <Route path="/" element={<TodayPage />} />
                <Route path="/notebook" element={<NotebookPage view="words" />} />
                <Route path="/notebook/decks" element={<NotebookPage view="decks" />} />
                <Route path="/words/new" element={<WordFormPage />} />
                <Route path="/words/:id" element={<WordDetailPage />} />
                <Route path="/words/:id/edit" element={<WordFormPage />} />
                <Route path="/decks/new" element={<DeckFormPage />} />
                <Route path="/decks/:id" element={<DeckDetailPage />} />
                <Route path="/decks/:id/edit" element={<DeckFormPage />} />
                <Route path="/decks/:id/add" element={<DeckAddWordsPage />} />
                <Route path="/import" element={<ImportPage />} />
                <Route path="/learn" element={<StudyPage mode="learn" />} />
                <Route path="/review" element={<StudyPage mode="review" />} />
                <Route path="/study" element={<StudyPage mode="resume" />} />
                <Route path="/lookup" element={<LookupPage />} />
                <Route path="/stats" element={<StatsPage />} />
                <Route path="/me" element={<ProfilePage />} />
                <Route path="/voice" element={<VoiceClipsPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="*" element={<TodayPage />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </main>
        {!focus && <TabBar />}
        <VoiceClipBar raised={!focus} />
        <Toaster />
      </div>
    </MotionConfig>
  )
}
