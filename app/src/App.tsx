import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Route, Routes, useLocation, useNavigate } from 'react-router'
import { TabBar } from './components/TabBar'
import { pageTransition, pageVariants } from './lib/motion'
import { useSettings } from './lib/settings'
import { tabIndexOf } from './lib/tabs'
import { LoginPage } from './pages/LoginPage'
import { LookupPage } from './pages/LookupPage'
import { NotebookPage } from './pages/NotebookPage'
import { ProfilePage } from './pages/ProfilePage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { StatsPage } from './pages/StatsPage'
import { TodayPage } from './pages/TodayPage'
import { openedFromRecoveryLink, startAuth } from './services/auth'

export default function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const { reduceMotion } = useSettings()
  const index = tabIndexOf(location.pathname)

  useEffect(() => {
    const toReset = () => navigate('/reset-password', { replace: true })
    if (openedFromRecoveryLink) toReset()
    startAuth(toReset)
  }, [navigate])

  // Hướng trượt: sang tab bên phải thì nội dung trượt từ phải vào, và ngược lại.
  const [nav, setNav] = useState({ index, direction: 0 })
  if (nav.index !== index) setNav({ index, direction: index > nav.index ? 1 : -1 })

  useEffect(() => {
    document.documentElement.dataset.reduceMotion = String(reduceMotion)
  }, [reduceMotion])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <MotionConfig reducedMotion={reduceMotion ? 'always' : 'user'}>
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
        <main className="relative flex-1 overflow-x-clip pb-[calc(4.75rem+env(safe-area-inset-bottom))]">
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
                <Route path="/notebook" element={<NotebookPage />} />
                <Route path="/lookup" element={<LookupPage />} />
                <Route path="/stats" element={<StatsPage />} />
                <Route path="/me" element={<ProfilePage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="*" element={<TodayPage />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </main>
        <TabBar />
      </div>
    </MotionConfig>
  )
}
