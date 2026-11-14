import {
  Bell,
  Bot,
  Brain,
  CalendarDays,
  ChevronRight,
  CircleHelp,
  DatabaseBackup,
  FileUp,
  Flag,
  GraduationCap,
  HardDriveDownload,
  LogIn,
  LogOut,
  Palette,
  ShieldCheck,
  Smartphone,
  SlidersHorizontal,
  Volume2,
} from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Avatar } from '../components/Avatar'
import { CloudStatus } from '../components/CloudStatus'
import { HelpTitle } from '../components/Guide'
import { SELF_LEVELS, timeZoneOffset, weekdaysLabel } from '../core/profile'
import { useProfile } from '../services/profile'
import { Button, Card, MenuGroup, MenuRow, Page, SectionTitle } from '../components/ui'
import { useSettings } from '../lib/settings'
import { isInstalled } from '../lib/device'
import { APP_VERSION } from '../lib/version'
import { readPlacementLast } from '../lib/placementLast'
import { signOut, useAuth } from '../services/auth'
import { hasExactVoice, speechAvailable, useVoicesReady } from '../services/speech'

const SPEED_LABEL = { slower: 'rất chậm', slow: 'chậm', normal: 'vừa', fast: 'nhanh' } as const
const THEME_LABEL = { system: 'Theo máy', light: 'Sáng', dark: 'Tối' } as const
const SIZE_LABEL = { small: 'nhỏ', normal: 'vừa', large: 'lớn', larger: 'rất lớn' } as const

/**
 * Cá nhân: hồ sơ, rồi các mục chia nhóm như trang Cài đặt của iPhone. Mỗi dòng ghi giá trị đang dùng; cài đặt chi
 * tiết nằm ở trang con.
 */
export function ProfilePage() {
  const settings = useSettings()
  const auth = useAuth()
  const navigate = useNavigate()
  const installed = isInstalled()
  const [signingOut, setSigningOut] = useState(false)
  const [placement] = useState(readPlacementLast)
  useVoicesReady()

  const profile = useProfile()

  const signedIn = auth.status === 'signed_in'
  const name = profile?.displayName || (signedIn ? auth.email : 'Bạn')
  const level = SELF_LEVELS.find((l) => l.value === profile?.selfLevel)?.label
  const about = [level, profile?.learningPurpose].filter(Boolean).join(' · ')
  const voiceMissing = speechAvailable() && !hasExactVoice(settings.accent)
  const placementLevel = placement ? SELF_LEVELS.find((l) => l.value === placement.level)?.label : undefined
  const reminders = profile ? [profile.reminders.study && 'Nhắc giờ học', profile.reminders.due && 'nhắc ôn'].filter(Boolean).join(', ') : ''

  return (
    <Page title="Cá nhân">
      <Card>
        <button type="button" onClick={() => navigate('/me/profile')} className="flex w-full items-center gap-4 text-left">
          <Avatar src={profile?.avatarUrl} name={name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[1.0625rem] font-semibold">{name}</p>
            <p className="truncate text-sm text-muted">{about || 'Thêm tên, ảnh, trình độ và mục đích học'}</p>
            <p className="truncate text-xs text-subtle">
              {signedIn ? `Đã đăng nhập · ${auth.email}` : auth.status === 'signed_out' ? 'Chưa đăng nhập' : 'Dữ liệu lưu trên thiết bị này'}
            </p>
          </div>
          <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-subtle" />
        </button>
        {auth.status === 'signed_out' && (
          <Button variant="primary" icon={LogIn} className="mt-4 w-full" onClick={() => navigate('/login')}>
            Đăng nhập
          </Button>
        )}
      </Card>

      <MenuGroup title="Học tập">
        <MenuRow
          icon={CalendarDays}
          title="Mục tiêu và lịch học"
          detail={
            profile
              ? `${profile.dailyNewWords} từ mới · ${profile.dailyMinutes} phút · ${weekdaysLabel(profile.studyWeekdays)}${profile.studyTime ? ` lúc ${profile.studyTime}` : ''} · ${timeZoneOffset(profile.timeZone)}`
              : undefined
          }
          onClick={() => navigate('/me/goals')}
        />
        <MenuRow icon={Bell} title="Nhắc nhở" detail={reminders ? reminders.charAt(0).toUpperCase() + reminders.slice(1) : 'Đang tắt'} onClick={() => navigate('/me/reminders')} />
        <MenuRow
          icon={SlidersHorizontal}
          title="Cách học và ôn"
          detail={`${settings.reviewStyle === 'exercises' ? 'Bài luyện' : 'Thẻ tự đánh giá'} · tối đa ${settings.reviewLimit} từ mỗi buổi`}
          onClick={() => navigate('/me/study')}
        />
        <MenuRow
          icon={Volume2}
          title="Giọng đọc"
          detail={voiceMissing ? `Máy chưa có giọng ${settings.accent === 'uk' ? 'Anh–Anh' : 'Anh–Mỹ'}` : `${settings.accent === 'uk' ? 'Anh–Anh' : 'Anh–Mỹ'} · tốc độ ${SPEED_LABEL[settings.speechSpeed]}`}
          warn={voiceMissing}
          onClick={() => navigate('/me/speech')}
        />
        <MenuRow icon={Brain} title="Mục tiêu ghi nhớ" detail={profile ? `Nhớ khoảng ${Math.round(profile.fsrs.retention * 100)}% khi đến lúc ôn` : undefined} onClick={() => navigate('/me/memory')} />
        <MenuRow icon={Bot} title="Trợ lý AI" detail={profile ? (profile.ai.enabled ? 'Đang bật' : 'Đang tắt') : undefined} onClick={() => navigate('/me/ai')} />
        <MenuRow
          icon={GraduationCap}
          title="Kiểm tra trình độ"
          detail={
            placement
              ? `Lần gần nhất: khoảng ${new Intl.NumberFormat('vi-VN').format(placement.estimate)} từ${placementLevel ? `, ${placementLevel}` : ''}`
              : 'Khoảng 5 phút, ước lượng vốn từ của bạn'
          }
          onClick={() => navigate('/placement')}
        />
      </MenuGroup>

      <Card>
        <HelpTitle topic="sync">Máy chủ và đồng bộ</HelpTitle>
        <CloudStatus />
      </Card>

      <MenuGroup title="Ứng dụng">
        <MenuRow
          icon={Palette}
          title="Giao diện và âm thanh"
          detail={`${THEME_LABEL[settings.theme]} · chữ ${SIZE_LABEL[settings.textSize]} · ${settings.soundEffects ? 'có âm thanh' : 'tắt âm thanh'}`}
          onClick={() => navigate('/me/appearance')}
        />
        <MenuRow icon={HardDriveDownload} title="Dùng khi không có mạng" detail="Tải sẵn âm thanh, xem dung lượng" onClick={() => navigate('/me/offline')} />
        <MenuRow icon={DatabaseBackup} title="Sao lưu, khôi phục, xuất file" onClick={() => navigate('/backup')} />
        <MenuRow icon={FileUp} title="Nhập từ file Excel/CSV" onClick={() => navigate('/import')} />
        <MenuRow icon={ShieldCheck} title="Tài khoản và quyền riêng tư" detail="Mật khẩu, máy đã đăng nhập, xóa tài khoản" onClick={() => navigate('/me/account')} />
      </MenuGroup>

      <MenuGroup title="Hỗ trợ">
        <MenuRow icon={CircleHelp} title="Hướng dẫn sử dụng" detail="Thêm từ, học, ôn và ý nghĩa các con số" onClick={() => navigate('/help')} />
        <MenuRow icon={Flag} title="Báo lỗi và góp ý" detail="Gửi báo lỗi, xem các báo lỗi đã gửi" onClick={() => navigate('/me/feedback')} />
      </MenuGroup>

      {!installed && (
        <Card>
          <SectionTitle>Cài app lên điện thoại</SectionTitle>
          <div className="flex flex-col gap-3 text-sm leading-relaxed text-muted">
            <p>
              <span className="font-semibold text-text">iPhone:</span> mở bằng Safari, chạm nút Chia sẻ, chọn “Thêm vào MH chính”.
            </p>
            <p>
              <span className="font-semibold text-text">Android:</span> mở bằng Chrome, chạm menu ⋮, chọn “Cài đặt ứng dụng” hoặc “Thêm vào màn hình chính”.
            </p>
          </div>
        </Card>
      )}

      {signedIn && (
        <Button
          icon={LogOut}
          className="w-full disabled:opacity-70"
          disabled={signingOut}
          onClick={async () => {
            setSigningOut(true)
            await signOut()
            setSigningOut(false)
          }}
        >
          {signingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
        </Button>
      )}

      <p className="flex items-center justify-center gap-1.5 pt-2 text-center text-xs text-subtle">
        {installed && <Smartphone aria-hidden className="h-3.5 w-3.5" />}
        Phiên bản {APP_VERSION}
        {installed ? ' · bản đã cài' : ''}
      </p>
    </Page>
  )
}
